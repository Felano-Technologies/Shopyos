const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');
const { resolveImageUrl, resolveImageUrls } = require('../config/storage');
const {
  uploadMultipleFilesToCloudinary,
  deleteImage,
  extractPublicId
} = require('../utils/uploadHelpers');
const { logger } = require('../config/logger');
const { invalidateProduct } = require('../config/cacheInvalidation');
const feeConfigService = require('../services/feeConfigService');

async function persistProductVariants(productId, variants, variantOptions) {
  if (!Array.isArray(variants) || !variants.length) return [[], []];
  const createdVariants = await repositories.productVariants.replaceVariants(productId, variants);
  const createdOptions = Array.isArray(variantOptions) && variantOptions.length
    ? await repositories.productVariants.replaceOptions(productId, variantOptions)
    : [];
  return [createdVariants, createdOptions];
}

// @desc    Create a new product
// @route   POST /api/products
// @access  Private (Seller)
const createProduct = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const {
      storeId,
      name,
      title,
      description,
      price,
      compareAtPrice,
      category,
      gender,
      stockQuantity,
      sku,
      weight,
      dimensions,
      brand,
      tags,
      variants,
      variantOptions,
      attributes,
      bargainingEnabled,
      minBargainPrice
    } = req.body;

    // Validate required fields
    if (!storeId || !name || !price) {
      return ApiResponse.error(res, 'Please provide store ID, product name, and price', 400);
    }

    // Verify store ownership
    const store = await repositories.stores.findById(storeId);
    if (!store) {
      return ApiResponse.error(res, 'Store not found', 404);
    }

    if (store.owner_id !== userId) {
      return ApiResponse.error(res, 'Not authorized to add products to this store', 403);
    }

    // Check listing limits and tier
    const { count: productCount } = await repositories.products.db
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .is('deleted_at', null);

    const freeLimit = Number(await feeConfigService.get('free_listing_limit', 100));

    if (productCount >= freeLimit && store.listing_tier !== 'paid') {
      const listingFeeAmount = await feeConfigService.get('listing_fee_amount', 50);
      return ApiResponse.error(res, 'Free listing limit reached.', 402, {
        code: 'LISTING_FEE_REQUIRED',
        message: `Pay a one-time ₵${listingFeeAmount} platform fee to unlock unlimited listings.`,
        paymentUrl: '/api/v1/payments/listing-fee/initialize'
      });
    }

    // Proactive 80% warning notification
    if (store.listing_tier !== 'paid' && productCount >= Math.floor(freeLimit * 0.8) && productCount < freeLimit) {
      setImmediate(async () => {
        try {
          const feeAmount = await feeConfigService.get('listing_fee_amount', 50);
          const notificationService = require('../services/notificationService');
          await notificationService.sendNotification({
            userId: store.owner_id,
            type: 'listing_limit_warning',
            title: 'Listing limit almost reached',
            message: `You've used ${productCount} of ${freeLimit} free listings. Pay a one-time ₵${feeAmount} fee to unlock unlimited products.`,
            relatedId: storeId,
            relatedType: 'store',
            push: { data: { screen: 'business/dashboard', storeId } }
          });
          logger.info(`[ListingLimit] Sent 80% warning to store ${storeId} (${productCount}/${freeLimit})`);
        } catch (e) {
          logger.error('[ListingLimit] Warning notification failed:', e.message);
        }
      });
    }

    // Create product
    let parsedTags = null;
    if (tags) {
      parsedTags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    }
    const product = await repositories.products.create({
      store_id: storeId,
      title: title || name,
      description: description || '',
      price: Number.parseFloat(price),
      compare_at_price: compareAtPrice ? Number.parseFloat(compareAtPrice) : null,
      category: category || 'general',
      gender: gender || 'Unisex',
      sku: sku || null,
      weight_kg: weight ? Number.parseFloat(weight) : null,
      dimensions: dimensions || null,
      brand: brand || null,
      tags: parsedTags,
      attributes: attributes && typeof attributes === 'object' ? attributes : null,
      is_active: true,
      bargaining_enabled: true,
      min_bargain_price: minBargainPrice ? Number.parseFloat(minBargainPrice) : null
    });

    // Create inventory record
    await repositories.products.db
      .from('inventory')
      .insert({
        product_id: product.id,
        quantity: stockQuantity ? Number.parseInt(stockQuantity) : 0,
        reserved_quantity: 0,
        low_stock_threshold: 10
      });

    // Persist variants and option metadata if provided
    const [createdVariants, createdOptions] = await persistProductVariants(product.id, variants, variantOptions);

    ApiResponse.withEntity(res, 'product', {
      _id: product.id,
      businessId: storeId,
      name: product.title,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compare_at_price,
      category: product.category,
      gender: product.gender,
      images: [],
      variants: createdVariants,
      variantOptions: createdOptions,
      createdAt: product.created_at,
      updatedAt: product.updated_at
    }, 'Product created successfully', null, 201);

    await invalidateProduct(product.id, storeId);

  } catch (error) {
    next(error);
  }
};

// @desc    Get all products for a store
// @route   GET /api/products/store/:storeId
// @access  Public
const getStoreProducts = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { limit = 20, offset = 0, includeInactive } = req.query;

    // Only expose products from verified stores to the public
    const store = await repositories.stores.findById(storeId);
    if (!store?.is_verified) {
      return ApiResponse.paginated(res, [], {
        totalItems: 0, totalPages: 0, currentPage: 1, itemsPerPage: Number.parseInt(limit), hasNext: false, hasPrev: false, sortConfig: null
      });
    }

    const limitNum = Number.parseInt(limit);
    const offsetNum = Number.parseInt(offset);

    const { data: rawProducts, count: totalCount } = await repositories.products.findByStore(storeId, {
      limit: limitNum,
      offset: offsetNum,
      includeInactive: includeInactive === 'true',
      select: '*, inventory(quantity), product_images(image_url)'
    });

    // Format for backward compatibility with batch image resolution
    const formattedProducts = await Promise.all(rawProducts.map(async p => ({
      _id: p.id,
      businessId: p.store_id,
      name: p.title,
      description: p.description,
      price: p.price,
      images: await resolveImageUrls((p.product_images || []).map(img => img.image_url)),
      category: p.category,
      gender: p.gender,
      sku: p.sku,
      stockQuantity: Array.isArray(p.inventory) ? p.inventory[0]?.quantity : (p.inventory?.quantity || 0),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      isActive: p.is_active
    })));

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    ApiResponse.paginated(res, formattedProducts, {
      totalItems: totalCount,
      totalPages: totalPages,
      currentPage: currentPage,
      itemsPerPage: limitNum,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
      sortConfig: null
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if ID is valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    const product = await repositories.products.getProductDetails(id);

    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    // Do not expose products from unverified stores
    if (!product.stores?.is_verified) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    // Increment view count
    try {
      await repositories.products.incrementViewCount(id);
    } catch (err) {
      logger.warn('Failed to increment view count:', err.message);
    }

    // Log view event for recommendation personalization (fire-and-forget)
    if (req.user?.id) {
      repositories.products.db
        .from('user_events')
        .insert({ user_id: req.user.id, product_id: id, event_type: 'view', weight: 1 })
        .then(() => {})
        .catch(err => logger.warn('Failed to log view event:', err.message));
    }

    // Fetch variants and option metadata in parallel
    const [variants, variantOptions] = await Promise.all([
      repositories.productVariants.getByProductId(id),
      repositories.productVariants.getOptions(id)
    ]);

    // Format response
    const formattedProduct = {
      _id: product.id,
      businessId: product.store_id,
      name: product.title,
      description: product.description,
      price: product.price,
      images: await resolveImageUrls((product.product_images || []).map(img => img.image_url)),
      category: product.category,
      gender: product.gender,
      brand: product.brand,
      sku: product.sku,
      stockQuantity: Array.isArray(product.inventory) ? product.inventory[0]?.quantity : (product.inventory?.quantity || 0),
      viewCount: product.view_count,
      salesCount: product.total_sales || product.sales_count || 0,
      averageRating: product.avg_rating || 0,
      reviewCount: product.review_count || 0,
      variants,
      variantOptions,
      store: product.stores ? {
        _id: product.stores.id,
        name: product.stores.store_name,
        rating: product.stores.average_rating,
        ownerId: product.stores.owner_id,
        logo: await resolveImageUrl(product.stores.logo_url)
      } : null,
      bargaining_enabled: product.bargaining_enabled ?? true,
      min_bargain_price: product.min_bargain_price || null,
      createdAt: product.created_at,
      updatedAt: product.updated_at
    };

    ApiResponse.withEntity(res, 'product', formattedProduct);

  } catch (error) {
    next(error);
  }
};

// @desc    Get all categories
// @route   GET /api/products/categories
// @access  Public
const getCategories = async (req, res, next) => {
  try {
    // Fetch categories from the new table
    const { data: dbCategories, error: catError } = await repositories.products.db
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (catError) {
      logger.error('Error fetching categories table', { error: catError.message });
      // Fallback to extraction from products if table fails (or empty?)
      // But we just seeded it.
    }

    // Get product counts for these categories efficiently using RPC
    const { data: productCounts, error: countError } = await repositories.products.db
      .rpc('get_category_counts');

    const counts = {};
    if (productCounts && !countError) {
      productCounts.forEach(p => {
        counts[p.category] = Number.parseInt(p.product_count, 10);
      });
    }

    let categories = [];
    if (dbCategories && dbCategories.length > 0) {
      categories = dbCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'),
        count: counts[cat.name] || 0
      }));
    } else {
      // Fallback: extract from products alone if categories table is empty
      const uniqueCats = Object.keys(counts);
      categories = uniqueCats.map(cat => ({
        id: cat.toLowerCase().replace(/\s+/g, '-'),
        name: cat,
        count: counts[cat]
      }));
    }

    ApiResponse.withEntity(res, 'categories', categories);
  } catch (error) {
    next(error);
  }
};

function _resolveCompareAtPrice(val) {
  return val ? Number.parseFloat(val) : null;
}

function _resolveTags(tags) {
  return Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
}

function _resolveAttributes(attributes) {
  return attributes && typeof attributes === 'object' ? attributes : null;
}

function buildProductUpdateData(updateData) {
  const d = {};
  if (updateData.name)        d.title = updateData.name;
  if (updateData.title)       d.title = updateData.title;
  if (updateData.description) d.description = updateData.description;
  if (updateData.price)       d.price = Number.parseFloat(updateData.price);
  if (updateData.compareAtPrice !== undefined) d.compare_at_price = _resolveCompareAtPrice(updateData.compareAtPrice);
  if (updateData.category)   d.category = updateData.category;
  if (updateData.gender)     d.gender = updateData.gender;
  if (updateData.sku)        d.sku = updateData.sku;
  if (updateData.brand)      d.brand = updateData.brand;
  if (updateData.weight)     d.weight_kg = Number.parseFloat(updateData.weight);
  if (updateData.dimensions) d.dimensions = updateData.dimensions;
  if (updateData.tags)                    d.tags = _resolveTags(updateData.tags);
  if (updateData.attributes !== undefined) d.attributes = _resolveAttributes(updateData.attributes);
  if (updateData.isActive !== undefined)  d.is_active = String(updateData.isActive) === 'true';
  if (updateData.bargainingEnabled !== undefined) d.bargaining_enabled = Boolean(updateData.bargainingEnabled);
  if (updateData.minBargainPrice !== undefined)   d.min_bargain_price = updateData.minBargainPrice === null ? null : Number.parseFloat(updateData.minBargainPrice);
  return d;
}

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Seller)
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    logger.debug('Updating product', { productId: id, requestId: req.requestId });

    // Get product and verify ownership
    const product = await repositories.products.getProductDetails(id);

    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    // Verify store ownership
    const store = await repositories.stores.findById(product.store_id);
    if (store.owner_id !== userId) {
      return ApiResponse.error(res, 'Not authorized to update this product', 403);
    }

    const mappedData = buildProductUpdateData(updateData);

    logger.debug('Mapped update data', { productId: id, fields: Object.keys(mappedData) });

    // Snapshot old price before update for price-drop detection
    const oldPrice = product.price;

    // Update product
    const updated = await repositories.products.update(id, mappedData);

    // Update inventory if provided
    if (updateData.stockQuantity != null) {
      await repositories.products.db
        .from('inventory')
        .update({ quantity: Number.parseInt(updateData.stockQuantity) })
        .eq('product_id', id);
    }

    // Update variants if provided
    if (Array.isArray(updateData.variants)) {
      await repositories.productVariants.replaceVariants(id, updateData.variants);
    }
    if (Array.isArray(updateData.variantOptions)) {
      await repositories.productVariants.replaceOptions(id, updateData.variantOptions);
    }

    // Price drop alert â€” fan-out push to users who favourited this product.
    // setImmediate so the seller's response is never blocked by fan-out latency.
    if (updated.price < oldPrice) {
      setImmediate(async () => {
        try {
          const { rows: fans } = await repositories.products.db.query(
            `SELECT user_id FROM favorites WHERE product_id = $1`,
            [id]
          );
          if (fans.length === 0) return;

          const notificationService = require('../services/notificationService');
          await Promise.allSettled(fans.map(f =>
            notificationService.sendNotification({
              userId: f.user_id,
              type: 'price_drop',
              title: 'Price dropped on your wishlist!',
              message: `${updated.title} dropped from â‚µ${oldPrice} to â‚µ${updated.price}.`,
              relatedId: id,
              relatedType: 'product',
              push: { data: { screen: 'product/details', productId: id } }
            })
          ));
          logger.info(`[PriceDrop] Notified ${fans.length} users for product ${id}`);
        } catch (e) {
          logger.error('[PriceDrop] Fan-out failed:', e.message);
        }
      });
    }

    ApiResponse.withEntity(res, 'product', {
      _id: updated.id,
      businessId: updated.store_id,
      name: updated.title,
      description: updated.description,
      price: updated.price,
      compareAtPrice: updated.compare_at_price,
      category: updated.category,
      gender: updated.gender,
      updatedAt: updated.updated_at,
      isActive: updated.is_active
    }, 'Product updated successfully');

    await invalidateProduct(id, updated.store_id);

  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Seller)
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get product and verify ownership
    const product = await repositories.products.getProductDetails(id);

    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    // Verify store ownership
    const store = await repositories.stores.findById(product.store_id);
    if (store.owner_id !== userId) {
      return ApiResponse.error(res, 'Not authorized to delete this product', 403);
    }

    // Delete product images from Cloudinary
    if (product.product_images && product.product_images.length > 0) {
      const deletePromises = product.product_images.map(img => {
        const publicId = extractPublicId(img.image_url);
        return publicId ? deleteImage(publicId).catch(err =>
          logger.warn(`Failed to delete image ${publicId}:`, err.message)
        ) : Promise.resolve();
      });
      await Promise.all(deletePromises);
    }

    // Soft delete product
    await repositories.products.softDelete(id);

    ApiResponse.success(res, null, 'Product deleted successfully');

    await invalidateProduct(id, product.store_id);

  } catch (error) {
    next(error);
  }
};

// @desc    Upload product images
// @route   POST /api/products/:id/images
// @access  Private (Seller)
const uploadProductImages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!req.files || req.files.length === 0) {
      return ApiResponse.error(res, 'No images uploaded', 400);
    }

    // Get product and verify ownership
    const product = await repositories.products.findById(id);
    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    const store = await repositories.stores.findById(product.store_id);
    if (store.owner_id !== userId) {
      return ApiResponse.error(res, 'Not authorized', 403);
    }

    // Limit to 5 images
    if (req.files.length > 5) {
      return ApiResponse.error(res, 'Maximum 5 images allowed per product', 400);
    }

    // Upload images to Cloudinary
    const uploadResults = await uploadMultipleFilesToCloudinary(
      req.files,
      'shopyos/products'
    );

    // Get current image count
    const { data: existingImages } = await repositories.products.db
      .from('product_images')
      .select('*')
      .eq('product_id', id);

    const currentCount = existingImages?.length || 0;

    // Insert image records
    const imageInserts = uploadResults.map((result, index) => ({
      product_id: id,
      image_url: result.url,
      cloudinary_public_id: result.public_id,
      display_order: currentCount + index,
      is_primary: currentCount === 0 && index === 0
    }));

    await repositories.products.db
      .from('product_images')
      .insert(imageInserts);

    ApiResponse.withEntity(res, 'images', await Promise.all(uploadResults.map(r => resolveImageUrl(r.url))), `${uploadResults.length} images uploaded successfully`);

  } catch (error) {
    next(error);
  }
};

// @desc    Delete product image
// @route   DELETE /api/products/:id/images/:imageId
// @access  Private (Seller)
const deleteProductImage = async (req, res, next) => {
  try {
    const { id, imageId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const product = await repositories.products.findById(id);
    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    const store = await repositories.stores.findById(product.store_id);
    if (store.owner_id !== userId) {
      return ApiResponse.error(res, 'Not authorized', 403);
    }

    // Get image record
    const { data: image } = await repositories.products.db
      .from('product_images')
      .select('*')
      .eq('id', imageId)
      .eq('product_id', id)
      .single();

    if (!image) {
      return ApiResponse.error(res, 'Image not found', 404);
    }

    // Delete from Cloudinary
    if (image.cloudinary_public_id) {
      await deleteImage(image.cloudinary_public_id).catch(err =>
        logger.warn('Failed to delete from Cloudinary:', err.message)
      );
    }

    // Delete from database
    await repositories.products.db
      .from('product_images')
      .delete()
      .eq('id', imageId);

    ApiResponse.success(res, null, 'Image deleted successfully');

  } catch (error) {
    next(error);
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
const searchProducts = async (req, res, next) => {
  try {
    const {
      query,
      category,
      gender,
      minPrice,
      maxPrice,
      minRating,
      sortBy = 'relevance',
      limit = 20,
      offset = 0,
      color,
      size,
      material,
      style,
      brand
    } = req.query;

    // Parse sort options
    let sortColumn = 'created_at';
    let sortAscending = false;

    if (sortBy === 'price_asc') {
      sortColumn = 'price';
      sortAscending = true;
    } else if (sortBy === 'price_desc') {
      sortColumn = 'price';
    } else if (sortBy === 'rating') {
      sortColumn = 'average_rating';
    } else if (sortBy === 'popular') {
      // Use canonical schema column for popularity sorting
      sortColumn = 'total_sales';
    }
    // If relevance and query exists, repo handles it (usually) or defaults to rank

    const limitNum = Number.parseInt(limit);
    const offsetNum = Number.parseInt(offset);

    const { data: rawProducts, count: totalCount } = await repositories.products.search({
      query,
      category,
      gender,
      minPrice: minPrice ? Number.parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? Number.parseFloat(maxPrice) : undefined,
      minRating: minRating ? Number.parseFloat(minRating) : undefined,
      sortBy: sortColumn,
      ascending: sortAscending,
      limit: limitNum,
      offset: offsetNum,
      color: color || undefined,
      size: size || undefined,
      material: material || undefined,
      style: style || undefined,
      brand: brand || undefined
    });

    // Format response
    const formattedProducts = await Promise.all(rawProducts.map(async p => ({
      _id: p.id,
      businessId: p.store_id,
      name: p.title,
      description: p.description,
      price: p.price,
      images: await resolveImageUrls((p.product_images || []).map(img => img.image_url)),
      category: p.category,
      gender: p.gender,
      salesCount: p.total_sales || p.sales_count || 0,
      averageRating: p.avg_rating || 0,
      reviewCount: p.review_count || 0,
      store: p.stores ? {
        store_name: p.stores.store_name,
        name: p.stores.store_name,
        slug: p.stores.slug,
        logo_url: await resolveImageUrl(p.stores.logo_url),
        rating: p.stores.average_rating
      } : null
    })));

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    ApiResponse.paginated(res, formattedProducts, {
      totalItems: totalCount,
      totalPages: totalPages,
      currentPage: currentPage,
      itemsPerPage: limitNum,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
      sortConfig: { field: sortBy, direction: sortAscending ? 'asc' : 'desc' }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getStoreProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  uploadProductImages,
  deleteProductImage,
  searchProducts,
  getCategories
};
