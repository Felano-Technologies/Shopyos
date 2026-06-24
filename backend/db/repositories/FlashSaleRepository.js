const BaseRepository = require('./BaseRepository');
const { getPool } = require('../../config/postgres');

class FlashSaleRepository extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'flash_sales');
  }

  /** Returns the single currently-running flash sale with its products */
  async getActiveSale() {
    const now = new Date().toISOString();

    const { data: sale, error } = await this.db
      .from('flash_sales')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', now)
      .gte('ends_at', now)
      .order('starts_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // no active sale
      throw error;
    }

    // Fetch products for this sale, joining product details
    const { data: items, error: itemsErr } = await this.db
      .from('flash_sale_products')
      .select(`
        flash_price,
        stock_limit,
        sold_count,
        product:products (
          id, title, description, price, compare_at_price,
          category, images, average_rating, total_reviews, store_id
        )
      `)
      .eq('flash_sale_id', sale.id);

    if (itemsErr) throw itemsErr;

    return { sale, items: items || [] };
  }

  /** Expire sales whose ends_at has passed — called by cron every minute */
  async expireEnded() {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('flash_sales')
      .update({ is_active: false, status: 'ended', updated_at: now })
      .eq('is_active', true)
      .lt('ends_at', now)
      .select('id');

    if (error) throw error;
    return data || [];
  }

  async createSale(data) {
    const { data: sale, error } = await this.db
      .from('flash_sales')
      .insert(data)
      .select('*')
      .single();

    if (error) throw error;
    return sale;
  }

  async addProducts(flashSaleId, products, storeId = null) {
    const rows = products.map((p) => ({
      flash_sale_id: flashSaleId,
      product_id: p.productId,
      flash_price: p.flashPrice,
      stock_limit: p.stockLimit || null,
      reserved_quantity: p.stockLimit || 0,
      store_id: storeId
    }));

    const { data, error } = await this.db
      .from('flash_sale_products')
      .insert(rows)
      .select('*');

    if (error) throw error;
    return data;
  }

  async endSale(id) {
    const { data, error } = await this.db
      .from('flash_sales')
      .update({ is_active: false, status: 'ended', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  // --- New Methods for Slot management & approval workflows ---

  async createSlot(data) {
    const { data: slot, error } = await this.db
      .from('flash_sale_slots')
      .insert(data)
      .select('*')
      .single();
    if (error) throw error;
    return slot;
  }

  async getSlots({ upcoming = false } = {}) {
    let query = this.db.from('flash_sale_slots').select('*');
    if (upcoming) {
      query = query.gte('end_time', new Date().toISOString());
    }
    const { data, error } = await query.order('start_time', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async getSellerSales(storeId, status = null) {
    let query = this.db
      .from('flash_sales')
      .select(`
        *,
        slot:flash_sale_slots (*),
        flash_sale_products (
          *,
          product:products (*)
        )
      `)
      .eq('store_id', storeId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getAdminSales(status = null) {
    let query = this.db
      .from('flash_sales')
      .select(`
        *,
        slot:flash_sale_slots (*),
        store:stores (store_name),
        flash_sale_products (
          *,
          product:products (*)
        )
      `);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async checkProductAvailability(productId) {
    // A product can only be in one active/upcoming flash sale at a time.
    const { data, error } = await this.db
      .from('flash_sale_products')
      .select(`
        id,
        flash_sale:flash_sales (
          id, starts_at, ends_at, status
        )
      `)
      .eq('product_id', productId);

    if (error) throw error;
    if (!data || data.length === 0) return true;

    // Check if any associated flash sale is live, approved, or pending_approval
    const activeSale = data.find(item => 
      ['pending_approval', 'approved', 'live'].includes(item.flash_sale?.status)
    );
    return !activeSale;
  }

  async activateApprovedSales() {
    const now = new Date().toISOString();
    const { data: sales, error } = await this.db
      .from('flash_sales')
      .update({ status: 'live', is_active: true, updated_at: now })
      .eq('status', 'approved')
      .lte('starts_at', now)
      .select('id');

    if (error) throw error;
    return sales || [];
  }

  async expireEndedSales() {
    const now = new Date().toISOString();
    const { data: sales, error } = await this.db
      .from('flash_sales')
      .update({ status: 'ended', is_active: false, updated_at: now })
      .eq('status', 'live')
      .lte('ends_at', now)
      .select('id');

    if (error) throw error;

    const db = getPool();
    for (const sale of (sales || [])) {
      await releaseReservedInventory(db, sale.id);
    }

    return sales || [];
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

module.exports = FlashSaleRepository;
