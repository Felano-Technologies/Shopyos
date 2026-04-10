const repositories = require('../db/repositories');
const { uploadFileToCloudinary, deleteImage, extractPublicId } = require('../utils/uploadHelpers');
const { logger } = require('../config/logger');
const { invalidateStore } = require('../config/cacheInvalidation');
const notificationService = require('../services/notificationService');

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
      email,
      businessCert, // from req.body or handled via files
      taxId,
      businessLicense, // via files
      bankName,
      accountName,
      accountNumber,
      proofOfBank // via files
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

    // Process uploaded files using Cloudinary
    let fileUrls = {
      logo: logo || null,
      coverImage: coverImage || null,
      businessCert: null,
      businessLicense: null,
      proofOfBank: null
    };

    if (req.files) {
      try {
        const uploadPromises = [];
        const processFile = (fieldName, folder) => {
          if (req.files[fieldName] && req.files[fieldName][0]) {
            return uploadFileToCloudinary(req.files[fieldName][0], folder)
              .then(result => { fileUrls[fieldName] = result.url; });
          }
          return Promise.resolve();
        };

        await Promise.all([
          processFile('logo', 'shopyos/store-logos'),
          processFile('coverImage', 'shopyos/store-banners'),
          processFile('businessCert', 'shopyos/store-documents'),
          processFile('businessLicense', 'shopyos/store-documents'),
          processFile('proofOfBank', 'shopyos/store-documents')
        ]);
      } catch (uploadError) {
        logger.error('Error uploading business files:', uploadError);
        return res.status(500).json({ success: false, error: 'Failed to upload documents' });
      }
    }

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
      logo_url: fileUrls.logo,
      banner_url: fileUrls.coverImage,
      business_cert_url: fileUrls.businessCert,
      tax_id: taxId || null,
      business_license_url: fileUrls.businessLicense,
      bank_name: bankName || null,
      account_name: accountName || null,
      account_number: accountNumber || null,
      payout_method: req.body.payoutMethod || 'bank',
      proof_of_bank_url: fileUrls.proofOfBank,
      verification_status: 'pending',
      is_active: true
    });

    // Notify admins
    const hasVerificationDocs = fileUrls.businessCert || fileUrls.businessLicense || fileUrls.proofOfBank;
    if (hasVerificationDocs) {
      await notificationService.notifyAdminsVerificationRequest(store.id, 'store', store.store_name);
    }

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
      logo_url: store.logo_url || '',
      coverImage: store.banner_url || '',
      banner_url: store.banner_url || '',
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

    console.log(`[MY_BUSINESSES] UserID: ${userId}, Count Found: ${totalCount}, Stores:`, rawStores?.length);

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
      logo_url: store.logo_url || '',
      coverImage: store.banner_url || '',
      banner_url: store.banner_url || '',
      verificationStatus: store.verification_status,
      rejectionReason: store.rejection_reason || '',
      isActive: store.is_active,
      isTrusted: store.is_trusted || false,
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
      isTrusted: store.is_trusted || false,
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

    // Process uploaded files using Cloudinary if present
    if (req.files) {
      try {
        const processFile = (fieldName, folder) => {
          if (req.files[fieldName] && req.files[fieldName][0]) {
            return uploadFileToCloudinary(req.files[fieldName][0], folder)
              .then(result => { mappedData[fieldName] = result.url; });
          }
          return Promise.resolve();
        };

        await Promise.all([
          processFile('logo', 'shopyos/store-logos'),
          processFile('coverImage', 'shopyos/store-banners'),
          processFile('businessCert', 'shopyos/store-documents'),
          processFile('businessLicense', 'shopyos/store-documents'),
          processFile('proofOfBank', 'shopyos/store-documents')
        ]);
        
        // Map resulting URLs to the database column names if they were uploaded
        if (mappedData.logo) mappedData.logo_url = mappedData.logo;
        if (mappedData.coverImage) mappedData.banner_url = mappedData.coverImage;
        if (mappedData.businessCert) mappedData.business_cert_url = mappedData.businessCert;
        if (mappedData.businessLicense) mappedData.business_license_url = mappedData.businessLicense;
        if (mappedData.proofOfBank) mappedData.proof_of_bank_url = mappedData.proofOfBank;
        
        // Clean up temporary mapped fields before database update
        delete mappedData.logo;
        delete mappedData.coverImage;
        delete mappedData.businessCert;
        delete mappedData.businessLicense;
        delete mappedData.proofOfBank;
      } catch (uploadError) {
        logger.error('Error uploading business files during update:', uploadError);
        return res.status(500).json({ success: false, error: 'Failed to upload documents' });
      }
    }

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
    
    // Support direct URL updates if provided in body (fallback if no file was uploaded)
    if (updateData.logo && !mappedData.logo_url) mappedData.logo_url = updateData.logo;
    if (updateData.coverImage && !mappedData.banner_url) mappedData.banner_url = updateData.coverImage;
    if (updateData.businessCert && !mappedData.business_cert_url) mappedData.business_cert_url = updateData.businessCert;
    if (updateData.businessLicense && !mappedData.business_license_url) mappedData.business_license_url = updateData.businessLicense;
    if (updateData.proofOfBank && !mappedData.proof_of_bank_url) mappedData.proof_of_bank_url = updateData.proofOfBank;
    
    // Legal & Verification Fields
    if (updateData.registrationNumber) mappedData.registration_number = updateData.registrationNumber;
    if (updateData.taxId) mappedData.tax_id = updateData.taxId;
    if (updateData.bankName) mappedData.bank_name = updateData.bankName;
    if (updateData.accountName) mappedData.account_name = updateData.accountName;
    if (updateData.accountNumber) mappedData.account_number = updateData.accountNumber;
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

    // If verification documents were uploaded, notify admins
    const hasNewDocs = mappedData.business_cert_url || mappedData.business_license_url || mappedData.proof_of_bank_url;
    if (hasNewDocs) {
      await notificationService.notifyAdminsVerificationRequest(updatedStore.id, 'store', updatedStore.store_name);
    }

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
        // Revenue should only be added when the user pays.
        // Paid statuses representing successful payment:
        const paidStatuses = ['paid', 'confirmed', 'ready_for_pickup', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed'];
        
        if (paidStatuses.includes(order.status.toLowerCase())) {
          chartData[dayIndex] += parseFloat(order.total_amount || 0);
        } else if (order.status.toLowerCase() === 'refunded') {
          // Subtract refunds from revenue if they happen within the chart window
          chartData[dayIndex] -= parseFloat(order.total_amount || 0);
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
    let totalOrders = 0;
    const productSales = {};
    const categorySales = {}; // Need product category, but order items only have title usually. 
    // Optimization: In a real app, join products table or store category in order_items. 
    // For now, we'll skip detailed category breakdown or mock it, or fetch product details if needed.

    const paidStatuses = ['paid', 'confirmed', 'ready_for_pickup', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed'];
    const completedStatuses = ['delivered', 'completed'];

    filteredOrders.forEach(order => {
      const status = order.status.toLowerCase();
      
      if (paidStatuses.includes(status)) {
        totalRevenue += parseFloat(order.total_amount || 0);
      } else if (status === 'refunded') {
        totalRevenue -= parseFloat(order.total_amount || 0);
      }

      if (completedStatuses.includes(status)) {
        totalOrders += 1;
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

        const dayRevenue = filteredOrders
          .filter(o => {
            const od = new Date(o.created_at);
            return od.getDate() === d.getDate() && od.getMonth() === d.getMonth() && revenueStatuses.includes(o.status);
          })
          .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
        chartData.push(dayRevenue);
      }
    } else if (timeframe === 'month') {
      for (let i = 3; i >= 0; i--) {
        chartLabels.push(`Wk ${4-i}`);
        
        const endWk = new Date();
        endWk.setDate(endWk.getDate() - (i*7));
        const startWk = new Date();
        startWk.setDate(endWk.getDate() - 7);

        const wkRevenue = filteredOrders
          .filter(o => {
            const od = new Date(o.created_at);
            return od >= startWk && od <= endWk && revenueStatuses.includes(o.status);
          })
          .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
        chartData.push(wkRevenue);
      }
    } else if (timeframe === 'year') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        chartLabels.push(monthNames[d.getMonth()]);

        const mthRevenue = filteredOrders
          .filter(o => {
            const od = new Date(o.created_at);
            return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear() && paidStatuses.includes(o.status.toLowerCase());
          })
          .reduce((sum, o) => {
             const amt = parseFloat(o.total_amount || 0);
             return o.status.toLowerCase() === 'refunded' ? sum - amt : sum + amt;
          }, 0);
        chartData.push(mthRevenue);
      }
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
        is_trusted,
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
      isTrusted: s.is_trusted || false,
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