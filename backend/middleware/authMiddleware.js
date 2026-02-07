const jwt = require('jsonwebtoken');
const repositories = require('../db/repositories');

// Protect routes with JWT
const protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      const user = await repositories.users.findById(decoded.id);

      if (!user) {
        return res.status(401).json({ error: 'Not authorized, user not found' });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({ error: 'Account is deactivated' });
      }

      // Attach user to request (excluding password)
      req.user = {
        id: user.id,
        email: user.email,
        email_verified: user.email_verified,
        is_active: user.is_active
      };

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);

      // Handle specific JWT errors
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Not authorized, invalid token' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Not authorized, token expired' });
      }

      res.status(401).json({ error: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }
};

// Admin middleware
const admin = async (req, res, next) => {
  if (req.user && req.user.id) {
    try {
      // Check if user has admin role
      const userWithRoles = await repositories.users.getUserWithRoles(req.user.id);
      const hasAdminRole = userWithRoles?.user_roles?.some(ur =>
        ur.roles?.name === 'admin' && ur.is_active
      );

      if (hasAdminRole) {
        next();
      } else {
        res.status(403).json({ error: 'Access denied. Admin role required' });
      }
    } catch (error) {
      console.error('Admin middleware error:', error);
      res.status(500).json({ error: 'Error verifying admin status' });
    }
  } else {
    res.status(401).json({ error: 'Not authorized' });
  }
};

// Seller middleware - check if user has seller role
const seller = async (req, res, next) => {
  if (req.user && req.user.id) {
    try {
      const userWithRoles = await repositories.users.getUserWithRoles(req.user.id);
      const hasSellerRole = userWithRoles?.user_roles?.some(ur =>
        ur.roles?.name === 'seller' && ur.is_active
      );

      if (hasSellerRole) {
        next();
      } else {
        res.status(403).json({ error: 'Access denied. Seller role required' });
      }
    } catch (error) {
      console.error('Seller middleware error:', error);
      res.status(500).json({ error: 'Error verifying seller status' });
    }
  } else {
    res.status(401).json({ error: 'Not authorized' });
  }
};

// Driver middleware - check if user has driver role
const driver = async (req, res, next) => {
  if (req.user && req.user.id) {
    try {
      const userWithRoles = await repositories.users.getUserWithRoles(req.user.id);
      const hasDriverRole = userWithRoles?.user_roles?.some(ur =>
        ur.roles?.name === 'driver' && ur.is_active
      );

      if (hasDriverRole) {
        next();
      } else {
        res.status(403).json({ error: 'Access denied. Driver role required' });
      }
    } catch (error) {
      console.error('Driver middleware error:', error);
      res.status(500).json({ error: 'Error verifying driver status' });
    }
  } else {
    res.status(401).json({ error: 'Not authorized' });
  }
};

// Check for any of the specified roles
const hasAnyRole = (...roleNames) => {
  return async (req, res, next) => {
    if (req.user && req.user.id) {
      try {
        const userWithRoles = await repositories.users.getUserWithRoles(req.user.id);
        const hasRole = userWithRoles?.user_roles?.some(ur =>
          roleNames.includes(ur.roles?.name) && ur.is_active
        );

        if (hasRole) {
          next();
        } else {
          res.status(403).json({
            error: `Access denied. Required role: ${roleNames.join(' or ')}`
          });
        }
      } catch (error) {
        console.error('Role check middleware error:', error);
        res.status(500).json({ error: 'Error verifying user role' });
      }
    } else {
      res.status(401).json({ error: 'Not authorized' });
    }
  };
};

module.exports = { protect, admin, seller, driver, hasAnyRole };