// controllers/businessController.js
const repositories = require('../db/repositories');
const { uploadFileToCloudinary, deleteImage, extractPublicId } = require('../utils/uploadHelpers');

// @desc    Create a new business/store
// @route   POST /api/business/create
// @access  Private
const createBusiness = async (req, res) => {
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
    const existingStores = await repositories.stores.findByOwner(userId);
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

    res.status(201).json({
      success: true,
      message: 'Business created successfully',
      business: response
    });

  } catch (error) {
    console.error('Error creating business:', error);
    
    // Handle unique constraint violations
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Business with this name or email already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error while creating business'
    });
  }
};

// @desc    Get user's businesses
// @route   GET /api/business/my-businesses
// @access  Private
const getMyBusinesses = async (req, res) => {
  try {
    const userId = req.user.id;

    const stores = await repositories.stores.findByOwner(userId);

    // Format response for backward compatibility
    const businesses = stores.map(store => ({
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

    res.status(200).json({
      success: true,
      count: businesses.length,
      businesses
    });

  } catch (error) {
    console.error('Error fetching businesses:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching businesses'
    });
  }
};

// @desc    Get business by ID
// @route   GET /api/business/:id
// @access  Private
const getBusinessById = async (req, res) => {
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

    // Verify ownership
    if (store.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this business'
      });
    }

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
      updatedAt: store.updated_at
    };

    res.status(200).json({
      success: true,
      business
    });

  } catch (error) {
    console.error('Error fetching business:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching business'
    });
  }
};

// @desc    Update business
// @route   PUT /api/business/update/:id
// @access  Private
const updateBusiness = async (req, res) => {
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

    res.status(200).json({
      success: true,
      message: 'Business updated successfully',
      business
    });

  } catch (error) {
    console.error('Error updating business:', error);

    res.status(500).json({
      success: false,
      error: 'Server error while updating business'
    });
  }
};

// @desc    Delete business
// @route   DELETE /api/business/:id
// @access  Private
const deleteBusiness = async (req, res) => {
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
          console.warn(`Failed to delete image ${id}:`, err.message)
        )
      ));
    }

    // Soft delete the store
    await repositories.stores.softDelete(businessId);

    res.status(200).json({
      success: true,
      message: 'Business deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting business:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting business'
    });
  }
};

// @desc    Upload business logo
// @route   POST /api/business/:id/upload-logo
// @access  Private
const uploadLogo = async (req, res) => {
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
          console.warn('Failed to delete old logo:', err.message)
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

    res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      logo: result.url
    });

  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload logo'
    });
  }
};

// @desc    Upload business banner/cover image
// @route   POST /api/business/:id/upload-banner
// @access  Private
const uploadBanner = async (req, res) => {
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
          console.warn('Failed to delete old banner:', err.message)
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

    res.status(200).json({
      success: true,
      message: 'Banner uploaded successfully',
      banner: result.url
    });

  } catch (error) {
    console.error('Error uploading banner:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload banner'
    });
  }
};

module.exports = {
  createBusiness,
  getMyBusinesses,
  getBusinessById,
  updateBusiness,
  deleteBusiness,
  uploadLogo,
  uploadBanner
};