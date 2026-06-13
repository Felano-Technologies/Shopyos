const repositories = require('../db/repositories');
const { resolveImageUrl } = require('../config/storage');
const {
  uploadMultipleFilesToCloudinary,
  deleteImage,
  extractPublicId
} = require('../utils/uploadHelpers');
const { logger } = require('../config/logger');
const { invalidateProduct } = require('../config/cacheInvalidation');

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
      attributes
    } = req.body;

    // Validate required fields
    if (!storeId || !name || !price) {
      return res.status(400).json({
        success: false,
        error: 'Please provide store ID, product name, and price'
      });
    }

    // Verify store ownership
    const store = await repositories.stores.findById(storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    if (store.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to add products to this store'
      });
    }

    // Check listing limits and tier
    const { count: productCount } = await repositories.products.db
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .is('deleted_at', null);

    if (productCount >= 100 && store.listing_tier !== 'paid') {
      return res.status(402).json({
        success: false,
        error: 'Free listing limit reached.',
        code: 'LISTING_FEE_REQUIRED',
        message: 'Pay a one-time â‚µ50 platform fee to unlock unlimited listings.',
        paymentUrl: '/api/v1/payments/listing-fee/initialize'
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
      is_active: true
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

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: {
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
      }
    });

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
      return res.status(200).json({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 0, currentPage: 1, itemsPerPage: Number.parseInt(limit), hasNext: false, hasPrev: false, sortConfig: null }
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

    // Format for backward compatibility
    const formattedProducts = await Promise.all(rawProducts.map(async p => ({
      _id: p.id,
      businessId: p.store_id,
      name: p.title,
      description: p.description,
      price: p.price,
      images: await Promise.all((p.product_images || []).map(img => resolveImageUrl(img.image_url))),
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

    res.status(200).json({
      success: true,
      data: formattedProducts,
      pagination: {
        totalItems: totalCount,
        totalPages: totalPages,
        currentPage: currentPage,
        itemsPerPage: limitNum,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
        sortConfig: null // inherited default order
      }
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
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const product = await repositories.products.getProductDetails(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Do not expose products from unverified stores
    if (!product.stores?.is_verified) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
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
      images: await Promise.all((product.product_images || []).map(img => resolveImageUrl(img.image_url))),
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
      createdAt: product.created_at,
      updatedAt: product.updated_at
    };

    res.status(200).json({
      success: true,
      product: formattedProduct
    });

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

    res.status(200).json({
      success: true,
      categories
    });
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
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Verify store ownership
    const store = await repositories.stores.findById(product.store_id);
    if (store.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this product'
      });
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
    if (mappedData.price !== undefined && updated.price < oldPrice) {
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

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: {
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
      }
    });

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
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Verify store ownership
    const store = await repositories.stores.findById(product.store_id);
    if (store.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this product'
      });
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

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });

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
      return res.status(400).json({
        success: false,
        error: 'No images uploaded'
      });
    }

    // Get product and verify ownership
    const product = await repositories.products.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const store = await repositories.stores.findById(product.store_id);
    if (store.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Limit to 5 images
    if (req.files.length > 5) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 5 images allowed per product'
      });
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

    res.status(200).json({
      success: true,
      message: `${uploadResults.length} images uploaded successfully`,
      images: await Promise.all(uploadResults.map(r => resolveImageUrl(r.url)))
    });

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
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const store = await repositories.stores.findById(product.store_id);
    if (store.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Get image record
    const { data: image } = await repositories.products.db
      .from('product_images')
      .select('*')
      .eq('id', imageId)
      .eq('product_id', id)
      .single();

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
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

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });

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
      sortAscending = false;
    } else if (sortBy === 'rating') {
      sortColumn = 'average_rating';
      sortAscending = false;
    } else if (sortBy === 'popular') {
      // Use canonical schema column for popularity sorting
      sortColumn = 'total_sales';
      sortAscending = false;
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
      images: await Promise.all((p.product_images || []).map(img => resolveImageUrl(img.image_url))),
      category: p.category,
      gender: p.gender,
      salesCount: p.total_sales || p.sales_count || 0,
      averageRating: p.avg_rating || 0,
      reviewCount: p.review_count || 0,
      store: p.stores ? {
        store_name: p.stores.store_name,  // keep canonical field name
        name: p.stores.store_name,        // alias for legacy frontend reads
        slug: p.stores.slug,
        logo_url: await resolveImageUrl(p.stores.logo_url),
        rating: p.stores.average_rating
      } : null
    })));

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: formattedProducts,
      pagination: {
        totalItems: totalCount,
        totalPages: totalPages,
        currentPage: currentPage,
        itemsPerPage: limitNum,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
        sortConfig: { field: sortBy, direction: sortAscending ? 'asc' : 'desc' }
      }
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
