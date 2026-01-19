const repositories = require('../db/repositories');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  const { name, email, password, fullPhoneNumber, role = 'buyer' } = req.body;
  
  try {
    // Validate role
    const validRoles = ['buyer', 'seller', 'driver'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be buyer, seller, or driver' });
    }

    // Check if user exists
    const existingUser = await repositories.users.findByEmail(email);

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user (password will be auto-hashed by repository)
    // Note: Database trigger automatically creates user_profile with default values
    const user = await repositories.users.createUser({
      email,
      password
    });

    // Update user profile with provided data (trigger creates it with defaults)
    await repositories.userProfiles.updateByUserId(user.id, {
      full_name: name,
      phone: fullPhoneNumber
    });

    // Assign selected role (buyer is default)
    const selectedRole = await repositories.roles.findByName(role);
    if (selectedRole) {
      await repositories.roles.assignRoleToUser(user.id, selectedRole.id);
    }

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

    // Update user location if provided (store in user_profiles)
    if (latitude && longitude) {
      await repositories.userProfiles.updateByUserId(user.id, {
        latitude: latitude,
        longitude: longitude
      });
    }

    // Update last login time
    await repositories.users.update(user.id, {
      last_login_at: new Date().toISOString()
    });

    // Get user roles
    const userRoles = await repositories.roles.getUserRoles(user.id);
    const role = userRoles?.[0]?.role?.name || 'none';

    const token = generateToken(res, user.id);

    res.status(200).json({
      token,
      role,
      roles: userRoles.map(r => r.role.name),
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
    const user = await repositories.users.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user profile
    const profile = await repositories.userProfiles.findByUserId(user.id);

    // Get user roles
    const userRoles = await repositories.roles.getUserRoles(user.id);

    // Format response
    const userData = {
      id: user.id,
      email: user.email,
      name: profile?.full_name || user.email,
      fullPhoneNumber: profile?.phone,
      avatar_url: profile?.avatar_url,
      address_line1: profile?.address_line1,
      address_line2: profile?.address_line2,
      city: profile?.city,
      state_province: profile?.state_province,
      postal_code: profile?.postal_code,
      country: profile?.country,
      latitude: profile?.latitude,
      longitude: profile?.longitude,
      role: userRoles?.[0]?.role?.name || 'none',
      roles: userRoles.map(r => ({
        name: r.role.name,
        displayName: r.role.display_name,
        assignedAt: r.assigned_at
      })),
      email_verified: user.email_verified,
      is_active: user.is_active,
      last_login_at: user.last_login_at,
      created_at: user.created_at
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



// @desc    Add role to user (users can have multiple roles)
// @route   POST /api/auth/add-role
// @access  Private
const addRole = async (req, res) => {
  const { role } = req.body;
  const userId = req.user.id;

  try {
    // Validate role
    const validRoles = ['buyer', 'seller', 'driver'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be buyer, seller, or driver'
      });
    }

    // Check if user already has this role
    const hasRole = await repositories.roles.userHasRole(userId, role);
    if (hasRole) {
      return res.status(400).json({
        success: false,
        error: `You already have the ${role} role`
      });
    }

    // Get role and assign to user
    const roleData = await repositories.roles.findByName(role);
    if (!roleData) {
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      });
    }

    await repositories.roles.assignRoleToUser(userId, roleData.id);

    res.status(200).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} role added successfully`
    });

  } catch (error) {
    console.error('Error adding role:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while adding role'
    });
  }
};

// @desc    Get user roles
// @route   GET /api/auth/roles
// @access  Private
const getUserRoles = async (req, res) => {
  try {
    const userId = req.user.id;
    const roles = await repositories.roles.getUserRoles(userId);

    res.status(200).json({
      success: true,
      roles: roles.map(r => ({
        id: r.id,
        name: r.role.name,
        displayName: r.role.display_name,
        description: r.role.description,
        assignedAt: r.assigned_at
      }))
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching roles'
    });
  }
};

// @desc    Update user role (DEPRECATED - use addRole instead)
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
  addRole,
  getUserRoles,
  updateUserRole
};