// controllers/businessController.js
const Business = require('../models/Business');
const User = require('../models/User');

// @desc    Create a new business
// @route   POST /api/business/create
// @access  Private
const createBusiness = async (req, res) => {
  try {
    const userId = req.user._id;
    
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
      coverImage
    } = req.body;

    // Validate required fields
    if (!businessName || !description || !category || !address || !city || !country || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Please fill all required fields'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if business name already exists for this user
    const existingBusiness = await Business.findOne({
      owner: userId,
      businessName
    });

    if (existingBusiness) {
      return res.status(400).json({
        success: false,
        error: 'You already have a business with this name'
      });
    }

    // Create business
    const business = await Business.create({
      owner: userId,
      businessName,
      description,
      category,
      address,
      city,
      country,
      phone,
      website: website || '',
      socialMedia: {
        instagram: instagram || '',
        facebook: facebook || ''
      },
      logo: logo || '',
      coverImage: coverImage || '',
      verificationStatus: 'pending'
    });

    // Populate the created business
    const populatedBusiness = await Business.findById(business._id)
      .select('-__v')
      .populate('owner', 'name email');

    res.status(201).json({
      success: true,
      message: 'Business created successfully',
      business: populatedBusiness
    });

  } catch (error) {
    console.error('Error creating business:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Business name already exists'
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
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
    const userId = req.user._id;

    const businesses = await Business.find({ owner: userId })
      .select('-__v')
      .populate('owner', 'name email')
      .sort({ createdAt: -1 });

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
    const userId = req.user._id;

    const business = await Business.findOne({
      _id: businessId,
      owner: userId
    })
    .select('-__v')
    .populate('owner', 'name email');

    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }

    res.status(200).json({
      success: true,
      business
    });

  } catch (error) {
    console.error('Error fetching business:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid business ID'
      });
    }

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
    const userId = req.user._id;
    const updateData = req.body;

    // Find business and verify ownership
    const business = await Business.findOne({
      _id: businessId,
      owner: userId
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }

    // Update business
    const updatedBusiness = await Business.findByIdAndUpdate(
      businessId,
      updateData,
      { 
        new: true, 
        runValidators: true 
      }
    )
    .select('-__v')
    .populate('owner', 'name email');

    res.status(200).json({
      success: true,
      message: 'Business updated successfully',
      business: updatedBusiness
    });

  } catch (error) {
    console.error('Error updating business:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }

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
    const userId = req.user._id;

    // Find business and verify ownership
    const business = await Business.findOne({
      _id: businessId,
      owner: userId
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }

    // Soft delete (set isActive to false) or hard delete
    await Business.findByIdAndDelete(businessId);

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

module.exports = {
  createBusiness,
  getMyBusinesses,
  getBusinessById,
  updateBusiness,
  deleteBusiness
};