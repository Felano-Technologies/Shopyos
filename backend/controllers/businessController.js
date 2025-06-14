const Business = require('../models/Business');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// @desc    Register new business
// @route   POST /api/business/register
// @access  Public
const registerBusiness = async (req, res) => {
  const { businessName, email, password, phone } = req.body;

  try {
    // Check if business exists
    const businessExists = await Business.findOne({ email });
    if (businessExists) {
      return res.status(400).json({ error: 'Business already exists' });
    }

    // Create business
    const business = await Business.create({
      businessName,
      email,
      password,
      phone,
    });


    res.status(201).json({
      message: 'Business registered successfully',
    });
  } catch (error) {
    console.error('Business registration error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Authenticate business
// @route   POST /api/business/login
// @access  Public
const loginBusiness = async (req, res) => {
  const { email, password } = req.body;

  try {
    const business = await Business.findOne({ email });
    
    if (!business) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await business.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }


    // Generate token (using JWT)
    const token = generateToken(res, business._id);

    // Return only the token in response
    res.status(200).json({
      token,
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('Business login error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get business profile
// @route   GET /api/business/profile
// @access  Private (Business)
const getBusinessProfile = async (req, res) => {
  try {
    const business = await Business.findById(req.user._id).select('-password');
    
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.status(200).json(business);
  } catch (error) {
    console.error('Get business profile error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Update business profile
// @route   PUT /api/business/profile
// @access  Private (Business)
const updateBusinessProfile = async (req, res) => {
  try {
    const business = await Business.findByIdAndUpdate(
      req.user._id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      message: 'Profile updated successfully',
      business
    });
  } catch (error) {
    console.error('Update business profile error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};


// Generate JWT token and set cookie
const generateToken = (res, userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });

  // Set cookie
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  return token;
};

module.exports = {
  registerBusiness,
  loginBusiness,
  getBusinessProfile,
  updateBusinessProfile
};