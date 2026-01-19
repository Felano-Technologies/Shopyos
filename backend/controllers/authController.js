const repositories = require('../db/repositories');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  const { name, email, password, fullPhoneNumber } = req.body;
  
  try {
    // Check if user exists
    const existingUser = await repositories.users.findByEmail(email);

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user (password will be auto-hashed by repository)
    const user = await repositories.users.createUser({
      email,
      password,
      full_name: name,
      phone: fullPhoneNumber
    });

    // Generate token
    generateToken(res, user.id);

    res.status(201).json({
      message: 'User created successfully'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const { email, password, latitude, longitude } = req.body;

  try {
    const user = await repositories.users.findByEmail(email);

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await repositories.users.verifyPassword(user.id, password);

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update user location if provided
    if (latitude && longitude) {
      await repositories.users.update(user.id, {
        last_latitude: latitude,
        last_longitude: longitude,
        last_location_update: new Date().toISOString()
      });
    }

    // Get user roles for backward compatibility
    const userWithRoles = await repositories.users.getUserWithRoles(user.id);
    const role = userWithRoles?.roles?.[0]?.role_name || 'none';

    const token = generateToken(res, user.id);

    res.status(200).json({
      token,
      role,
      message: 'Login successful'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await repositories.users.findByEmail(email);

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await repositories.users.setPasswordResetToken(user.id, token, expiresAt);

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${token}`;

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: 'Password Reset',
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
        Please click on the following link, or paste this into your browser to complete the process:\n\n
        ${resetUrl}\n\n
        If you did not request this, please ignore this email and your password will remain unchanged.\n`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Recovery email sent' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getUserData = async (req, res) => {
  try {
    const user = await repositories.users.getUserWithProfile(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Format response for backward compatibility
    const userData = {
      id: user.id,
      email: user.email,
      name: user.user_profiles?.full_name || user.email,
      fullPhoneNumber: user.user_profiles?.phone,
      latitude: user.last_latitude,
      longitude: user.last_longitude,
      role: user.roles?.[0]?.role_name || 'none',
      email_verified: user.email_verified
    };

    res.status(200).json(userData);
  } catch (error) {
    console.error('Error getting user data:', error);
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



// @desc    Update user role
// @route   PUT /api/auth/update-role
// @access  Private
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.user.id; // From auth middleware

    // Validate role input
    if (!role) {
      return res.status(400).json({
        success: false,
        error: 'Role is required'
      });
    }

    // Validate role value (map old names to new if needed)
    const roleMapping = {
      'customer': 'buyer',
      'buyer': 'buyer',
      'seller': 'seller',
      'driver': 'driver',
      'none': 'none'
    };
    
    const mappedRole = roleMapping[role];
    if (!mappedRole) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be one of: customer, buyer, seller, driver, none'
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

    // Set role (replaces all existing roles)
    await repositories.users.setRole(userId, mappedRole);

    res.status(200).json({
      success: true,
      message: 'Role updated successfully',
    });

  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating role'
    });
  }
};

module.exports = {
  register,
  login,
  resetPassword,
  getUserData,
  updateUserRole
};