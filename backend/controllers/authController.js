const User = require('../models/User');
const bcrypt = require('bcryptjs');
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
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user
    user = new User({
      name,
      email,
      fullPhoneNumber,
      password
    });

    // Save user
    await user.save();

    // Generate token
    generateToken(res, user._id);

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
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update user location if provided
    if (latitude && longitude) {
      user.latitude = latitude;
      user.longitude = longitude;
      await user.save();
    }

    const token = generateToken(res, user._id);

    res.status(200).json({
      token,
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
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const token = crypto.randomBytes(20).toString('hex');

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

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
    const user = await User.findById(req.user._id).select('-password');

    res.status(200).json(user);
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

module.exports = {
  register,
  login,
  resetPassword,
  getUserData
};