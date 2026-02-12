// controllers/productController.js
const repositories = require('../db/repositories');
const {
  uploadFileToCloudinary,
  uploadMultipleFilesToCloudinary,
  deleteImage,
  extractPublicId
} = require('../utils/uploadHelpers');

// @desc    Create a new product
// @route   POST /api/products
// @access  Private (Seller)
const createProduct = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      storeId,
      name,
      title,
      description,
      price,
      category,
      stockQuantity,
      sku,
      weight,
      dimensions,
      brand,
      tags
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

    // Create product
    const product = await repositories.products.create({
      store_id: storeId,
      title: title || name,
      description: description || '',
      price: parseFloat(price),
      category: category || 'general',
      sku: sku || null,
      weight_kg: weight ? parseFloat(weight) : null,
      dimensions: dimensions || null,
      brand: brand || null,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : null,
      is_active: true
    });

    // Create inventory record
    await repositories.products.db
      .from('inventory')
      .insert({
        product_id: product.id,
        quantity: stockQuantity ? parseInt(stockQuantity) : 0,
        reserved_quantity: 0,
        low_stock_threshold: 10
      });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: {
        _id: product.id,
        businessId: storeId,
        name: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        images: [],
        createdAt: product.created_at,
        updatedAt: product.updated_at
      }
    });

  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating product'
    });
  }
};

// @desc    Get all products for a store
// @route   GET /api/products/store/:storeId
// @access  Public
const getStoreProducts = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { limit = 20, offset = 0, includeInactive } = req.query;

    const products = await repositories.products.findByStore(storeId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      includeInactive: includeInactive === 'true',
      select: '*, inventory(quantity), product_images(image_url)'
    });

    // Format for backward compatibility
    const formattedProducts = products.map(p => ({
      _id: p.id,
      businessId: p.store_id,
      name: p.title,
      description: p.description,
      price: p.price,
      images: p.product_images ? p.product_images.map(img => img.image_url) : [],
      category: p.category,
      sku: p.sku,
      stockQuantity: p.inventory ? p.inventory.quantity : 0,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      isActive: p.is_active
    }));

    res.status(200).json({
      success: true,
      count: formattedProducts.length,
      products: formattedProducts
    });

  } catch (error) {
    console.error('Error fetching store products:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching products'
    });
  }
};

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
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

    // Increment view count
    try {
      await repositories.products.incrementViewCount(id);
    } catch (err) {
      // Ignore errors for view count increment (it's non-critical)
      console.warn('Failed to increment view count:', err.message);
    }

    // Format response
    const formattedProduct = {
      _id: product.id,
      businessId: product.store_id,
      name: product.title,
      description: product.description,
      price: product.price,
      images: product.product_images?.map(img => img.image_url) || [],
      category: product.category,
      brand: product.brand,
      sku: product.sku,
      stockQuantity: product.inventory?.quantity || 0,
      viewCount: product.view_count,
      salesCount: product.sales_count,
      averageRating: product.avg_rating || 0,
      reviewCount: product.review_count || 0,
      store: product.stores ? {
        _id: product.stores.id,
        name: product.stores.store_name,
        rating: product.stores.average_rating,
        ownerId: product.stores.owner_id,
        logo: product.stores.logo_url
      } : null,
      createdAt: product.created_at,
      updatedAt: product.updated_at
    };

    res.status(200).json({
      success: true,
      product: formattedProduct
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching product'
    });
  }
};

// @desc    Get all categories
// @route   GET /api/products/categories
// @access  Public
const getCategories = async (req, res) => {
  try {
    // Fetch categories from the new table
    const { data: dbCategories, error: catError } = await repositories.products.db
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (catError) {
      console.error('Error fetching categories table:', catError);
      // Fallback to extraction from products if table fails (or empty?)
      // But we just seeded it.
    }

    // Get product counts for these categories
    // efficient way: group by category
    const { data: productCounts, error: countError } = await repositories.products.db
      .from('products')
      .select('category')
      .is('deleted_at', null)
      .eq('is_active', true);

    const counts = {};
    if (productCounts) {
      productCounts.forEach(p => {
        if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
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
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Seller)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    console.log(`Updating product ${id} with data:`, JSON.stringify(updateData, null, 2));

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

    // Map fields
    const mappedData = {};
    if (updateData.name) mappedData.title = updateData.name;
    if (updateData.title) mappedData.title = updateData.title;
    if (updateData.description) mappedData.description = updateData.description;
    if (updateData.price) mappedData.price = parseFloat(updateData.price);
    if (updateData.category) mappedData.category = updateData.category;
    if (updateData.sku) mappedData.sku = updateData.sku;
    if (updateData.brand) mappedData.brand = updateData.brand;
    if (updateData.weight) mappedData.weight_kg = parseFloat(updateData.weight);
    if (updateData.dimensions) mappedData.dimensions = updateData.dimensions;
    if (updateData.tags) {
      mappedData.tags = Array.isArray(updateData.tags)
        ? updateData.tags
        : updateData.tags.split(',').map(t => t.trim());
    }

    // Handle isActive - support boolean and string
    if (updateData.isActive !== undefined) {
      mappedData.is_active = String(updateData.isActive) === 'true';
    }

    console.log('Mapped update data:', mappedData);

    // Update product
    const updated = await repositories.products.update(id, mappedData);

    // Update inventory if provided
    if (updateData.stockQuantity !== undefined) {
      await repositories.products.db
        .from('inventory')
        .update({ quantity: parseInt(updateData.stockQuantity) })
        .eq('product_id', id);
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
        category: updated.category,
        updatedAt: updated.updated_at,
        isActive: updated.is_active
      }
    });

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating product'
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Seller)
const deleteProduct = async (req, res) => {
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
          console.warn(`Failed to delete image ${publicId}:`, err.message)
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

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting product'
    });
  }
};

// @desc    Upload product images
// @route   POST /api/products/:id/images
// @access  Private (Seller)
const uploadProductImages = async (req, res) => {
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
      images: uploadResults.map(r => r.url)
    });

  } catch (error) {
    console.error('Error uploading product images:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload images'
    });
  }
};

// @desc    Delete product image
// @route   DELETE /api/products/:id/images/:imageId
// @access  Private (Seller)
const deleteProductImage = async (req, res) => {
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
        console.warn('Failed to delete from Cloudinary:', err.message)
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
    console.error('Error deleting product image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete image'
    });
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
const searchProducts = async (req, res) => {
  try {
    const {
      query,
      category,
      minPrice,
      maxPrice,
      sortBy = 'relevance',
      limit = 20,
      offset = 0
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
    } else if (sortBy === 'newest') {
      sortColumn = 'created_at';
      sortAscending = false;
    } else if (sortBy === 'relevance' && !query) {
      // If relevance but no query, fallback to newest
      sortColumn = 'created_at';
      sortAscending = false;
    }
    // If relevance and query exists, repo handles it (usually) or defaults to rank

    const products = await repositories.products.search({
      query,
      category,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      sortBy: sortColumn,
      ascending: sortAscending,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Format response
    const formattedProducts = products.map(p => ({
      _id: p.id,
      businessId: p.store_id,
      name: p.title,
      description: p.description,
      price: p.price,
      images: p.product_images?.map(img => img.image_url) || [],
      category: p.category,
      averageRating: p.avg_rating || 0,
      reviewCount: p.review_count || 0,
      store: p.stores ? {
        name: p.stores.store_name,
        rating: p.stores.avg_rating
      } : null
    }));

    res.status(200).json({
      success: true,
      count: formattedProducts.length,
      products: formattedProducts
    });

  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while searching products'
    });
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
