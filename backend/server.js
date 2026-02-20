const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');

// Load environment variables
dotenv.config();

// Validate environment variables
const validateEnv = require('./utils/validateEnv');
validateEnv();

// Import routes
const authRoutes = require('./routes/authRoutes');
const businessRoutes = require('./routes/businessRoutes');
const productRoutes = require('./routes/productRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const messagingRoutes = require('./routes/messagingRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const adminRoutes = require('./routes/adminRoutes');
const advertisingRoutes = require('./routes/advertisingRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const paymentMethodRoutes = require('./routes/paymentMethodRoutes');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  orderLimiter,
  messageLimiter
} = require('./middleware/rateLimiter');
const productionConfig = require('./config/production');

const app = express();

// Trust proxy - Required for Render.com and other reverse proxies
// This allows express-rate-limit to correctly identify users
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors(productionConfig.cors));

// Compression middleware
app.use(compression());

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout
app.use((req, res, next) => {
  req.setTimeout(productionConfig.timeout);
  res.setTimeout(productionConfig.timeout);
  next();
});

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Health check endpoint (no rate limiting)
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shopyos API',
    version: '1.0.0',
    currentVersion: 'v1',
    endpoints: {
      v1: '/api/v1',
      health: '/health'
    },
    availableVersions: ['v1']
  });
});

// API v1 info endpoint
app.get('/api/v1', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shopyos API v1',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      stores: '/api/v1/business',
      products: '/api/v1/products',
      cart: '/api/v1/cart',
      orders: '/api/v1/orders',
      messaging: '/api/v1/messaging',
      deliveries: '/api/v1/deliveries',
      reviews: '/api/v1/reviews',
      notifications: '/api/v1/notifications',
      favorites: '/api/v1/favorites',
      admin: '/api/v1/admin',
      advertising: '/api/v1/advertising',
      paymentMethods: '/api/v1/payment-methods'
    }
  });
});

// Apply rate limiters to specific routes (v1)
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
app.use('/api/v1/upload', uploadLimiter);
app.use('/api/v1/orders/create', orderLimiter);
app.use('/api/v1/messaging', messageLimiter);

// Apply general API rate limiter to all API routes
app.use('/api', apiLimiter);

// API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/business', businessRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/messaging', messagingRoutes);
app.use('/api/v1/deliveries', deliveryRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/favorites', favoriteRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/advertising', advertisingRoutes);
app.use('/api/v1/payouts', payoutRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/payment-methods', paymentMethodRoutes);

// Legacy routes (redirect to v1 for backward compatibility)
app.use('/api/auth', (req, res, next) => {
  req.url = '/api/v1/auth' + req.url.substring('/api/auth'.length);
  authRoutes(req, res, next);
});
app.use('/api/business', (req, res, next) => {
  req.url = '/api/v1/business' + req.url.substring('/api/business'.length);
  businessRoutes(req, res, next);
});
app.use('/api/products', (req, res, next) => {
  req.url = '/api/v1/products' + req.url.substring('/api/products'.length);
  productRoutes(req, res, next);
});
app.use('/api/upload', (req, res, next) => {
  req.url = '/api/v1/upload' + req.url.substring('/api/upload'.length);
  uploadRoutes(req, res, next);
});
app.use('/api/cart', (req, res, next) => {
  req.url = '/api/v1/cart' + req.url.substring('/api/cart'.length);
  cartRoutes(req, res, next);
});
app.use('/api/orders', (req, res, next) => {
  req.url = '/api/v1/orders' + req.url.substring('/api/orders'.length);
  orderRoutes(req, res, next);
});
app.use('/api/messaging', (req, res, next) => {
  req.url = '/api/v1/messaging' + req.url.substring('/api/messaging'.length);
  messagingRoutes(req, res, next);
});
app.use('/api/deliveries', (req, res, next) => {
  req.url = '/api/v1/deliveries' + req.url.substring('/api/deliveries'.length);
  deliveryRoutes(req, res, next);
});
app.use('/api/reviews', (req, res, next) => {
  req.url = '/api/v1/reviews' + req.url.substring('/api/reviews'.length);
  reviewRoutes(req, res, next);
});
app.use('/api/notifications', (req, res, next) => {
  req.url = '/api/v1/notifications' + req.url.substring('/api/notifications'.length);
  notificationRoutes(req, res, next);
});
app.use('/api/favorites', (req, res, next) => {
  req.url = '/api/v1/favorites' + req.url.substring('/api/favorites'.length);
  favoriteRoutes(req, res, next);
});
app.use('/api/admin', (req, res, next) => {
  req.url = '/api/v1/admin' + req.url.substring('/api/admin'.length);
  adminRoutes(req, res, next);
});
app.use('/api/advertising', (req, res, next) => {
  req.url = '/api/v1/advertising' + req.url.substring('/api/advertising'.length);
  advertisingRoutes(req, res, next);
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start server
const server = app.listen(PORT, () => {
  console.log('=================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log('=================================');
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\n🛑 Received shutdown signal, closing server gracefully...');

  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

module.exports = app;
