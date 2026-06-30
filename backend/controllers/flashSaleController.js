const repositories = require('../db/repositories');
const feeConfigService = require('../services/feeConfigService');
const { getPool } = require('../config/postgres');
const ApiResponse = require('../utils/apiResponse');

// --- Buyer/Public Endpoints ---

const getActiveSale = async (req, res, next) => {
  try {
    const result = await repositories.flashSales.getActiveSale();
    if (!result) return ApiResponse.success(res, { active: false, sale: null, products: [] });

    const { sale, items } = result;
    const products = formatFlashSaleProducts(items);

    return ApiResponse.success(res, { active: true, sale: { id: sale.id, title: sale.title, startsAt: sale.starts_at, endsAt: sale.ends_at }, products });
  } catch (error) {
    next(error);
  }
};

const getSlotsList = async (req, res, next) => {
  try {
    const upcoming = req.query.upcoming === 'true';
    const slots = await repositories.flashSales.getSlots({ upcoming });
    ApiResponse.success(res, slots);
  } catch (error) {
    next(error);
  }
};

// --- Seller Endpoints ---

const submitFlashSale = async (req, res, next) => {
  try {
    const { slotId, title, description, products } = req.body;
    const storeId = req.user.storeId; // seller store
    if (!storeId) return ApiResponse.error(res, 'Seller store profile required', 403);

    await validateSellerSubmission(slotId, products, storeId);

    const slot = await repositories.flashSales.findById(slotId, { tableName: 'flash_sale_slots' });
    const sale = await repositories.flashSales.createSale({
      title,
      description: description || null,
      starts_at: slot.start_time,
      ends_at: slot.end_time,
      store_id: storeId,
      created_by: req.user.id,
      slot_id: slotId,
      status: 'pending_approval',
      is_active: false
    });

    await repositories.flashSales.addProducts(sale.id, products, storeId);
    ApiResponse.withEntity(res, 'saleId', sale.id, 'Flash sale submitted for review', null, 201);
  } catch (error) {
    next(error);
  }
};

const getSellerSales = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    if (!storeId) return ApiResponse.error(res, 'Seller store profile required', 403);

    const sales = await repositories.flashSales.getSellerSales(storeId, req.query.status);
    ApiResponse.success(res, sales);
  } catch (error) {
    next(error);
  }
};

const cancelFlashSale = async (req, res, next) => {
  try {
    const { id } = req.params;
    const storeId = req.user.storeId;

    const sale = await repositories.flashSales.findById(id);
    if (!sale || sale.store_id !== storeId) return ApiResponse.error(res, 'Flash sale not found', 404);

    if (sale.status === 'live' || sale.status === 'ended') {
      return ApiResponse.error(res, 'Cannot cancel active or ended flash sales', 400);
    }

    const pool = getPool();
    if (sale.status === 'approved') {
      await releaseReservedInventory(pool, id);
    }

    await repositories.flashSales.update(id, { status: 'cancelled', is_active: false });
    ApiResponse.success(res, null, 'Flash sale cancelled successfully');
  } catch (error) {
    next(error);
  }
};

// --- Admin Endpoints ---

const createSlot = async (req, res, next) => {
  try {
    const { title, startTime, endTime, maxItems } = req.body;
    if (!title || !startTime || !endTime) return ApiResponse.error(res, 'title, startTime, and endTime are required', 400);

    const slot = await repositories.flashSales.createSlot({
      title,
      start_time: startTime,
      end_time: endTime,
      max_items: maxItems || 10,
      created_by: req.user.id
    });

    ApiResponse.created(res, slot);
  } catch (error) {
    next(error);
  }
};

const getAdminSales = async (req, res, next) => {
  try {
    const sales = await repositories.flashSales.getAdminSales(req.query.status);
    ApiResponse.success(res, sales);
  } catch (error) {
    next(error);
  }
};

const reviewFlashSale = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    if (!['approved', 'rejected'].includes(status)) return ApiResponse.error(res, 'Status must be approved or rejected', 400);

    const sale = await repositories.flashSales.findById(id);
    if (!sale) return ApiResponse.error(res, 'Flash sale not found', 404);

    const pool = getPool();
    if (status === 'approved' && sale.status !== 'approved') {
      await reserveInventoryForApprovedSale(pool, id);
    }

    await repositories.flashSales.update(id, {
      status,
      admin_notes: adminNotes || null,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString()
    });

    ApiResponse.success(res, null, `Flash sale has been ${status}`);
  } catch (error) {
    next(error);
  }
};

// --- Helper Functions to keep action methods under 30 lines ---

function formatFlashSaleProducts(items) {
  return items.map((item) => {
    const p = item.product;
    return {
      _id: p.id,
      name: p.title,
      description: p.description,
      price: item.flash_price,
      compare_at_price: p.price,
      images: p.images || [],
      category: p.category,
      average_rating: p.average_rating,
      store_id: p.store_id,
      stockLimit: item.stock_limit,
      soldCount: item.sold_count,
    };
  });
}

async function validateSellerSubmission(slotId, products, storeId) {
  if (!slotId || !Array.isArray(products) || products.length === 0) {
    throw new Error('slotId and at least one product with price and stock are required');
  }

  const minDiscountPct = await feeConfigService.get('flash_sale_min_discount_pct') || 10;

  for (const p of products) {
    const dbProd = await repositories.products.findById(p.productId);
    if (!dbProd || dbProd.store_id !== storeId) {
      throw new Error(`Product ${p.productId} does not belong to your store`);
    }

    const available = await repositories.flashSales.checkProductAvailability(p.productId);
    if (!available) {
      throw new Error(`Product ${dbProd.title} is already scheduled in another active/upcoming flash sale`);
    }

    const originalPrice = Number(dbProd.price);
    const discount = ((originalPrice - p.flashPrice) / originalPrice) * 100;
    if (discount < minDiscountPct) {
      throw new Error(`Product ${dbProd.title} discount must be at least ${minDiscountPct}%`);
    }
  }
}

async function reserveInventoryForApprovedSale(pool, saleId) {
  const { rows: products } = await pool.query(
    'SELECT product_id, stock_limit FROM flash_sale_products WHERE flash_sale_id = $1',
    [saleId]
  );

  for (const p of products) {
    const { rows: inv } = await pool.query(
      'SELECT quantity FROM inventory WHERE product_id = $1 FOR UPDATE',
      [p.product_id]
    );

    if (!inv[0] || inv[0].quantity < p.stock_limit) {
      throw new Error('Committed flash sale stock exceeds available inventory');
    }

    await pool.query(
      'UPDATE inventory SET quantity = quantity - $1, updated_at = NOW() WHERE product_id = $2',
      [p.stock_limit, p.product_id]
    );
  }
}

async function releaseReservedInventory(pool, saleId) {
  const { rows: products } = await pool.query(
    'SELECT product_id, reserved_quantity, sold_count FROM flash_sale_products WHERE flash_sale_id = $1',
    [saleId]
  );

  for (const p of products) {
    const refundQty = p.reserved_quantity - p.sold_count;
    if (refundQty > 0) {
      await pool.query(
        'UPDATE inventory SET quantity = quantity + $1, updated_at = NOW() WHERE product_id = $2',
        [refundQty, p.product_id]
      );
    }
  }
}

module.exports = {
  getActiveSale,
  getSlotsList,
  submitFlashSale,
  getSellerSales,
  cancelFlashSale,
  createSlot,
  getAdminSales,
  reviewFlashSale
};
