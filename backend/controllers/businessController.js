const repositories = require('../db/repositories');
const { uploadFileToCloudinary, deleteImage, extractPublicId } = require('../utils/uploadHelpers');
const { logger } = require('../config/logger');
const { invalidateStore } = require('../config/cacheInvalidation');

const createBusiness = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const {
      businessName,
      description,
      category,
      address,
      city,
      country,
      phone,
      website,
      instagram,
      facebook,
      logo,
      coverImage,
      email
    } = req.body;

    // Validate required fields
    if (!businessName || !description || !category || !address || !city || !country || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Please fill all required fields'
      });
    }

    // Check if user exists
    const user = await repositories.users.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if business name already exists for this user
    const existingStoresResult = await repositories.stores.findByOwner(userId);
    const existingStores = Array.isArray(existingStoresResult) ? existingStoresResult : (existingStoresResult?.data || []);
    const nameExists = existingStores.some(
      store => store.store_name.toLowerCase() === businessName.toLowerCase()
    );

    if (nameExists) {
      return res.status(400).json({
        success: false,
        error: 'You already have a business with this name'
      });
    }

    // Generate slug from business name
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now();

    // Create store
    const store = await repositories.stores.create({
      owner_id: userId,
      store_name: businessName,
      slug,
      description,
      category,
      phone,
      email: email || null,
      address_line1: address,
      city,
      country,
      website_url: website || null,
      social_instagram: instagram || null,
      social_facebook: facebook || null,
      logo_url: logo || null,
      banner_url: coverImage || null,
      verification_status: 'pending',
      is_active: true
    });

    // Get store with owner details
    const storeWithOwner = await repositories.stores.getStoreDetails(store.id);

    // Format response for backward compatibility
    const response = {
      _id: store.id,
      owner: {
        _id: userId,
        name: user.email,
        email: user.email
      },
      businessName: store.store_name,
      description: store.description,
      category: store.category,
      phone: store.phone,
      address: store.address_line1,
      city: store.city,
      country: store.country,
      website: store.website_url || '',
      socialMedia: {
        instagram: store.social_instagram || '',
        facebook: store.social_facebook || ''
      },
      logo: store.logo_url || '',
      coverImage: store.banner_url || '',
      verificationStatus: store.verification_status,
      isActive: store.is_active,
      rating: store.avg_rating || 0,
      totalReviews: store.total_reviews || 0,
      createdAt: store.created_at,
      updatedAt: store.updated_at
    };

    await invalidateStore('all');

    res.status(201).json({
      success: true,
      message: 'Business created successfully',
      business: response
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get user's businesses
// @route   GET /api/business/my-businesses
// @access  Private
const getMyBusinesses = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { limit, offset } = req.query;
    const limitNum = parseInt(limit || 20);
    const offsetNum = parseInt(offset || 0);

    const { data: rawStores, count: totalCount } = await repositories.stores.findAll({
      where: { owner_id: userId },
      orderBy: 'created_at',
      ascending: false,
      limit: limitNum,
      offset: offsetNum
    });

    // Format response for backward compatibility
    const businesses = rawStores.map(store => ({
      _id: store.id,
      owner: userId,
      businessName: store.store_name,
      description: store.description,
      category: store.category,
      phone: store.phone,
      email: store.email,
      address: store.address_line1,
      city: store.city,
      country: store.country,
      website: store.website_url || '',
      socialMedia: {
        instagram: store.social_instagram || '',
        facebook: store.social_facebook || ''
      },
      logo: store.logo_url || '',
      coverImage: store.banner_url || '',
      verificationStatus: store.verification_status,
      rejectionReason: store.rejection_reason || '',
      isActive: store.is_active,
      rating: store.avg_rating || 0,
      totalReviews: store.total_reviews || 0,
      createdAt: store.created_at,
      updatedAt: store.updated_at
    }));

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: businesses,
      pagination: {
        totalItems: totalCount,
        totalPages: totalPages,
        currentPage: currentPage,
        itemsPerPage: limitNum,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get business by ID
// @route   GET /api/business/:id
// @access  Private
const getBusinessById = async (req, res, next) => {
  try {
    const businessId = req.params.id;
    const userId = req.user.id;

    const store = await repositories.stores.findById(businessId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }

    // Verify ownership removed to allow public viewing
    /*
    if (store.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this business'
      });
    }
    */

    // Get store with details
    const storeWithDetails = await repositories.stores.getStoreDetails(businessId);

    // Format response for backward compatibility
    const business = {
      _id: store.id,
      owner: {
        _id: store.owner_id,
        email: storeWithDetails.owner?.email || ''
      },
      businessName: store.store_name,
      description: store.description,
      category: store.category,
      phone: store.phone,
      email: store.email,
      address: store.address_line1,
      city: store.city,
      country: store.country,
      website: store.website_url || '',
      socialMedia: {
        instagram: store.social_instagram || '',
        facebook: store.social_facebook || ''
      },
      logo: store.logo_url || '',
      coverImage: store.banner_url || '',
      verificationStatus: store.verification_status,
      rejectionReason: store.rejection_reason || '',
      isActive: store.is_active,
      rating: store.avg_rating || 0,
      totalReviews: store.total_reviews || 0,
      createdAt: store.created_at,
      updatedAt: store.updated_at,
      isFollowing: await repositories.stores.isFollowing(userId, businessId)
    };

    res.status(200).json({
      success: true,
      business
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Update business
// @route   PUT /api/business/update/:id
// @access  Private
const updateBusiness = async (req, res, next) => {
  try {
    const businessId = req.params.id;
    const userId = req.user.id;
    const updateData = req.body;

    // Find store and verify ownership
    const store = await repositories.stores.findById(businessId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }

    if (store.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this business'
      });
    }

    // Map old field names to new schema
    const mappedData = {};

    if (updateData.businessName) mappedData.store_name = updateData.businessName;
    if (updateData.description) mappedData.description = updateData.description;
    if (updateData.category) mappedData.category = updateData.category;
    if (updateData.phone) mappedData.phone = updateData.phone;
    if (updateData.email) mappedData.email = updateData.email;
    if (updateData.address) mappedData.address_line1 = updateData.address;
    if (updateData.city) mappedData.city = updateData.city;
    if (updateData.country) mappedData.country = updateData.country;
    if (updateData.website) mappedData.website_url = updateData.website;
    if (updateData.instagram) mappedData.social_instagram = updateData.instagram;
    if (updateData.facebook) mappedData.social_facebook = updateData.facebook;
    if (updateData.logo) mappedData.logo_url = updateData.logo;
    if (updateData.coverImage) mappedData.banner_url = updateData.coverImage;
    if (updateData.verificationStatus) mappedData.verification_status = updateData.verificationStatus;
    if (updateData.rejectionReason) mappedData.rejection_reason = updateData.rejectionReason;
    if (updateData.isActive !== undefined) mappedData.is_active = updateData.isActive;

    // Update slug if business name changed
    if (mappedData.store_name) {
      mappedData.slug = mappedData.store_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + Date.now();
    }

    // Update store
    const updatedStore = await repositories.stores.update(businessId, mappedData);

    // Format response for backward compatibility
    const business = {
      _id: updatedStore.id,
      owner: userId,
      businessName: updatedStore.store_name,
      description: updatedStore.description,
      category: updatedStore.category,
      phone: updatedStore.phone,
      email: updatedStore.email,
      address: updatedStore.address_line1,
      city: updatedStore.city,
      country: updatedStore.country,
      website: updatedStore.website_url || '',
      socialMedia: {
        instagram: updatedStore.social_instagram || '',
        facebook: updatedStore.social_facebook || ''
      },
      logo: updatedStore.logo_url || '',
      coverImage: updatedStore.banner_url || '',
      verificationStatus: updatedStore.verification_status,
      rejectionReason: updatedStore.rejection_reason || '',
      isActive: updatedStore.is_active,
      rating: updatedStore.avg_rating || 0,
      totalReviews: updatedStore.total_reviews || 0,
      updatedAt: updatedStore.updated_at
    };

    await invalidateStore(businessId);

    res.status(200).json({
      success: true,
      message: 'Business updated successfully',
      business
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Delete business
// @route   DELETE /api/business/:id
// @access  Private
const deleteBusiness = async (req, res, next) => {
  try {
    const businessId = req.params.id;
    const userId = req.user.id;

    // Find store and verify ownership
    const store = await repositories.stores.findById(businessId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }

    if (store.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this business'
      });
    }

    // Delete images from Cloudinary if they exist
    const imagesToDelete = [];

    if (store.logo_url) {
      const logoPublicId = extractPublicId(store.logo_url);
      if (logoPublicId) imagesToDelete.push(logoPublicId);
    }

    if (store.banner_url) {
      const bannerPublicId = extractPublicId(store.banner_url);
      if (bannerPublicId) imagesToDelete.push(bannerPublicId);
    }

    // Delete images from Cloudinary
    if (imagesToDelete.length > 0) {
      await Promise.all(imagesToDelete.map(id =>
        deleteImage(id).catch(err =>
          logger.warn(`Failed to delete image ${id}:`, err.message)
        )
      ));
    }

    // Soft delete the store
    await repositories.stores.softDelete(businessId);

    await invalidateStore(businessId);

    res.status(200).json({
      success: true,
      message: 'Business deleted successfully'
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Upload business logo
// @route   POST /api/business/:id/upload-logo
// @access  Private
const uploadLogo = async (req, res, next) => {
  try {
    const businessId = req.params.id;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No logo file uploaded'
      });
    }

    // Verify ownership
    const store = await repositories.stores.findById(businessId);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }

    if (store.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Delete old logo if exists
    if (store.logo_url) {
      const oldPublicId = extractPublicId(store.logo_url);
      if (oldPublicId) {
        await deleteImage(oldPublicId).catch(err =>
          logger.warn('Failed to delete old logo:', err.message)
        );
      }
    }

    // Upload new logo
    const result = await uploadFileToCloudinary(req.file, 'shopyos/store-logos');

    // Update store
    await repositories.stores.update(businessId, {
      logo_url: result.url,
      logo_cloudinary_id: result.public_id
    });

    await invalidateStore(businessId);

    res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      logo: result.url
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Upload business banner
// @route   POST /api/business/:id/upload-banner
// @access  Private
const uploadBanner = async (req, res, next) => {
  try {
    const businessId = req.params.id;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No banner file uploaded'
      });
    }

    // Verify ownership
    const store = await repositories.stores.findById(businessId);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }

    if (store.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Delete old banner if exists
    if (store.banner_url) {
      const oldPublicId = extractPublicId(store.banner_url);
      if (oldPublicId) {
        await deleteImage(oldPublicId).catch(err =>
          logger.warn('Failed to delete old banner:', err.message)
        );
      }
    }

    // Upload new banner
    const result = await uploadFileToCloudinary(req.file, 'shopyos/store-banners');

    // Update store
    await repositories.stores.update(businessId, {
      banner_url: result.url,
      banner_cloudinary_id: result.public_id
    });

    await invalidateStore(businessId);

    res.status(200).json({
      success: true,
      message: 'Banner uploaded successfully',
      banner: result.url
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get business dashboard stats
// @route   GET /api/business/dashboard/:id
// @access  Private
const getBusinessDashboard = async (req, res, next) => {
  try {
    const businessId = req.params.id;
    const userId = req.user.id;

    // Verify ownership
    const store = await repositories.stores.findById(businessId);
    if (!store) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }
    if (store.owner_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Fetch counts and recent orders in parallel
    const [totalProducts, totalOrders, pendingOrders, completedOrders, recentOrdersResult, weeklyOrders] = await Promise.all([
      repositories.products.count({ store_id: businessId, deleted_at: null }),
      repositories.orders.count({ store_id: businessId }),
      repositories.orders.count({ store_id: businessId, status: 'pending' }),
      repositories.orders.count({ store_id: businessId, status: 'completed' }),
      repositories.orders.getStoreOrders(businessId, { limit: 5 }), // Recent 5 orders
      // Fetch orders for the last 7 days for the chart
      repositories.orders.findAll({
        where: { store_id: businessId },
        select: '*, total_amount, status, created_at',
        limit: 100, // Reasonable limit for chart data
        orderBy: 'created_at',
        ascending: true,
      })
    ]);

    // Extract the data array from the getStoreOrders result
    const recentOrders = recentOrdersResult?.data || [];

    // Process chart data (Weekly Sales)
    // Filter for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // weeklyOrders.data is the actual array from findAll()
    const weeklyData = (weeklyOrders.data || []).filter(o => new Date(o.created_at) >= sevenDaysAgo);

    // Group by day
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const chartData = [0, 0, 0, 0, 0, 0, 0]; // 7 days
    const chartLabels = [];

    // Initialize labels for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      chartLabels.push(days[d.getDay()]);
    }

    weeklyData.forEach(order => {
      const orderDate = new Date(order.created_at);
      // Find which day index (0-6) this corresponds to in our chartLabels
      // This is a naive mapping, for simplicity let's just use day name matching if unique, 
      // or better, map by date string.

      // Simpler approach:
      const dayIndex = 6 - Math.floor((new Date().getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      if (dayIndex >= 0 && dayIndex <= 6) {
        // Only count paid/completed orders in revenue
        const revenueStatuses = ['paid', 'confirmed', 'ready_for_pickup', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed'];
        if (revenueStatuses.includes(order.status)) {
          chartData[dayIndex] += parseFloat(order.total_amount || 0);
        }
      }
    });

    const dashboardData = {
      stats: {
        totalProducts,
        totalOrders,
        pendingOrders,
        completedOrders
      },
      recentOrders: recentOrders.map(order => ({
        _id: order.id,
        orderNumber: order.order_number,
        totalAmount: order.total_amount || 0,
        status: order.status,
        createdAt: order.created_at
      })),
      chartData: {
        weekly: {
          labels: chartLabels,
          datasets: [{ data: chartData }]
        }
      }
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get business analytics
// @route   GET /api/business/analytics/:id
// @access  Private
const getBusinessAnalytics = async (req, res, next) => {
  try {
    const businessId = req.params.id;
    const userId = req.user.id;
    const { timeframe = 'week' } = req.query; // week, month, year

    // Verify ownership
    const store = await repositories.stores.findById(businessId);
    if (!store) return res.status(404).json({ success: false, error: 'Business not found' });
    if (store.owner_id !== userId) return res.status(403).json({ success: false, error: 'Not authorized' });

    // Calculate Date Range
    const endDate = new Date();
    const startDate = new Date();

    if (timeframe === 'month') startDate.setMonth(startDate.getMonth() - 1);
    else if (timeframe === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
    else startDate.setDate(startDate.getDate() - 7); // Default week

    // Fetch Orders in Range
    // Note: In a real production app, use DB aggregation. For now, we fetch and aggregate in JS.
    const ordersResult = await repositories.orders.findAll({
      where: {
        store_id: businessId,
        // created_at: { gte: startDate.toISOString() } // BaseRepo might not support complex filtered queries directly without customQuery
      },
      select: '*, order_items(product_title, quantity, price), payments(amount)',
      limit: 1000
    });

    const orders = ordersResult?.data || [];
    const filteredOrders = orders.filter(o => new Date(o.created_at) >= startDate);

    // Aggregate Data
    let totalRevenue = 0;
    let totalOrders = filteredOrders.length;
    const productSales = {};
    const categorySales = {}; // Need product category, but order items only have title usually. 
    // Optimization: In a real app, join products table or store category in order_items. 
    // For now, we'll skip detailed category breakdown or mock it, or fetch product details if needed.

    const revenueStatuses = ['paid', 'confirmed', 'ready_for_pickup', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed'];

    filteredOrders.forEach(order => {
      if (revenueStatuses.includes(order.status)) {
        totalRevenue += parseFloat(order.total_amount || 0);
      }

      order.order_items?.forEach(item => {
        if (!productSales[item.product_title]) {
          productSales[item.product_title] = { name: item.product_title, sales: 0, revenue: 0 };
        }
        productSales[item.product_title].sales += item.quantity;
        productSales[item.product_title].revenue += (item.price * item.quantity);
      });
    });

    // Top Products
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5)
      .map(p => ({ ...p, color: '#2563EB' })); // Add colors dynamically if needed

    // Chart Data (Revenue over time)
    const chartLabels = [];
    const chartData = [];

    if (timeframe === 'week') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        chartLabels.push(days[d.getDay()]);

        // Sum revenue for this day
        const dayRevenue = filteredOrders
          .filter(o => new Date(o.created_at).getDate() === d.getDate() && revenueStatuses.includes(o.status))
          .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
        chartData.push(dayRevenue);
      }
    } else {
      // Simplify for month/year for this MVP iteration
      // Just distributed evenly or mock slightly to show graph structure if no real data
      chartLabels.push('Start', 'End');
      chartData.push(0, totalRevenue);
    }

    res.status(200).json({
      success: true,
      data: {
        stats: {
          revenue: totalRevenue,
          orders: totalOrders,
          growth: 0 // calc vs previous period if needed
        },
        chart: {
          labels: chartLabels,
          datasets: [{ data: chartData }]
        },
        topProducts,
        categoryDistribution: [] // Placeholder
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get all businesses (Public/Customer)
// @route   GET /api/business/all
// @access  Private (Logged in user)
const getAllBusinesses = async (req, res, next) => {
  try {
    const { search, category, sortBy = 'rating', limit = 20, offset = 0, verified } = req.query;

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    // Sort allowlist
    const sortConfig = {
      rating: { column: 'average_rating', ascending: false },
      name: { column: 'store_name', ascending: true },
      newest: { column: 'created_at', ascending: false }
    };
    const sort = sortConfig[sortBy] || sortConfig.rating;

    // --- Data query ---
    let dataQuery = repositories.stores.db
      .from('stores')
      .select(`
        id,
        store_name,
        category,
        logo_url,
        average_rating,
        is_verified,
        products:products(count)
      `)
      .eq('is_active', true)
      .is('products.deleted_at', null)
      .eq('products.is_active', true);

    // Always show only verified stores to customers
    dataQuery = dataQuery.eq('is_verified', true);

    // DB-level search (replaces old in-memory filter)
    if (search) {
      dataQuery = dataQuery.ilike('store_name', `%${search}%`);
    }

    // Category filter
    if (category && category !== 'All') {
      dataQuery = dataQuery.eq('category', category);
    }

    // Apply sorting and pagination
    dataQuery = dataQuery
      .order(sort.column, { ascending: sort.ascending })
      .range(offsetNum, offsetNum + limitNum - 1);

    // --- Count query (same filters, no joins/pagination) ---
    let countQuery = repositories.stores.db
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    // Always count only verified stores
    countQuery = countQuery.eq('is_verified', true);

    if (search) {
      countQuery = countQuery.ilike('store_name', `%${search}%`);
    }
    if (category && category !== 'All') {
      countQuery = countQuery.eq('category', category);
    }

    // Execute both in parallel
    const [storesResult, countResult] = await Promise.all([dataQuery, countQuery]);

    if (storesResult.error) throw storesResult.error;
    if (countResult.error) throw countResult.error;

    const totalCount = countResult.count || 0;

    const mapped = (storesResult.data || []).map(s => ({
      id: s.id,
      name: s.store_name,
      category: s.category,
      logo: s.logo_url,
      rating: s.average_rating || 0,
      verified: s.is_verified || false,
      catalogues: s.products?.[0]?.count || 0
    }));

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: mapped,
      pagination: {
        totalItems: totalCount,
        totalPages: totalPages,
        currentPage: currentPage,
        itemsPerPage: limitNum,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
        sortConfig: { field: sortBy, direction: sort.ascending ? 'asc' : 'desc' }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Follow a business
// @route   POST /api/business/:id/follow
// @access  Private
const followBusiness = async (req, res, next) => {
  try {
    const businessId = req.params.id;
    const userId = req.user.id;

    await repositories.stores.followStore(userId, businessId);

    await invalidateStore(businessId);

    res.status(200).json({
      success: true,
      message: 'Store followed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unfollow a business
// @route   DELETE /api/business/:id/follow
// @access  Private
const unfollowBusiness = async (req, res, next) => {
  try {
    const businessId = req.params.id;
    const userId = req.user.id;

    await repositories.stores.unfollowStore(userId, businessId);

    await invalidateStore(businessId);

    res.status(200).json({
      success: true,
      message: 'Store unfollowed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all reviews for a business
// @route   GET /api/business/:id/reviews
// @access  Private (Store Owner)
const getBusinessReviews = async (req, res, next) => {
  try {
    const businessId = req.params.id;
    const userId = req.user.id;

    // Verify ownership
    const store = await repositories.stores.findById(businessId);
    if (!store) return res.status(404).json({ success: false, error: 'Business not found' });
    if (store.owner_id !== userId) return res.status(403).json({ success: false, error: 'Not authorized' });

    // 1. Fetch store reviews
    const { data: storeReviews } = await repositories.reviews.db
      .from('store_reviews')
      .select(`
        id, rating, review_text, created_at,
        user:buyer_id (
          user_profiles (full_name, avatar_url)
        )
      `)
      .eq('store_id', businessId)
      .is('deleted_at', null);

    // 2. Fetch product reviews for this store's products
    const { data: productReviews, error: prError } = await repositories.reviews.db
      .from('product_reviews')
      .select(`
        id, rating, review_text, created_at,
        products!inner ( store_id, title ),
        user:buyer_id (
          user_profiles ( full_name, avatar_url )
        )
      `)
      .eq('products.store_id', businessId)
      .is('deleted_at', null);

    if (prError) throw prError;

    // Combine and format them
    const allReviews = [];

    const formatUser = (userRel) => {
      const profiles = userRel?.user_profiles;
      const profile = Array.isArray(profiles) ? profiles[0] : profiles;
      return {
        name: profile?.full_name || 'Anonymous',
        avatar: profile?.avatar_url || null
      };
    };

    (storeReviews || []).forEach(r => {
      const u = formatUser(r.user);
      allReviews.push({
        id: r.id,
        type: 'store',
        rating: r.rating,
        comment: r.review_text,
        date: r.created_at,
        user: u.name,
        avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/png?seed=${r.id}`
      });
    });

    (productReviews || []).forEach(r => {
      const u = formatUser(r.user);
      allReviews.push({
        id: r.id,
        type: 'product',
        productName: r.products?.title,
        rating: r.rating,
        comment: r.review_text,
        date: r.created_at,
        user: u.name,
        avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/png?seed=${r.id}`
      });
    });

    // Sort by date descending
    allReviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Also fetch replies for these reviews.
    const reviewIds = allReviews.map(r => r.id);
    if (reviewIds.length > 0) {
      const { data: comments } = await repositories.reviews.db
        .from('review_comments')
        .select('review_id, comment')
        .in('review_id', reviewIds)
        .eq('user_id', userId);

      const repliesMap = {};
      (comments || []).forEach(c => {
         repliesMap[c.review_id] = c.comment;
      });

      allReviews.forEach(r => {
         r.reply = repliesMap[r.id] || null;
      });
    }

    res.status(200).json({ success: true, reviews: allReviews });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBusiness,
  getMyBusinesses,
  getAllBusinesses,
  getBusinessById,
  updateBusiness,
  deleteBusiness,
  uploadLogo,
  uploadBanner,
  getBusinessDashboard,
  getBusinessAnalytics,
  followBusiness,
  unfollowBusiness,
  getBusinessReviews
};