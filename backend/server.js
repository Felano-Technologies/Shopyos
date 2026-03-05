const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const validateEnv = require('./utils/validateEnv');
validateEnv();

const { logger, httpLogMiddleware } = require('./config/logger');
const { getRedis, healthCheck: redisHealthCheck, disconnect: redisDisconnect } = require('./config/redis');
const { performanceMiddleware, getMetrics } = require('./middleware/performanceMonitor');
const { supabaseAdmin } = require('./config/supabase');
const { initializeSocket } = require('./config/socket');
const { registerMessagingHandlers } = require('./sockets/messagingSocket');

const redis = getRedis();

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

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter, authLimiter, uploadLimiter, orderLimiter, messageLimiter } = require('./middleware/rateLimiter');
const productionConfig = require('./config/production');

const app = express();

// Required for express-rate-limit behind reverse proxies (Render, Railway)
app.set('trust proxy', 1);

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

app.use(httpLogMiddleware);
app.use(performanceMiddleware);

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

app.use(cors(productionConfig.cors));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  let timeout = productionConfig.timeout || 30000;

  // Extend timeout for file uploads
  if (req.path.startsWith('/api/v1/upload')) {
    timeout = 60000;
  }

  req.setTimeout(timeout, () => {
    let err = new Error('Request Timeout');
    err.status = 408;
    next(err);
  });

  res.setTimeout(timeout, () => {
    let err = new Error('Service Unavailable - Timeout');
    err.status = 503;
    next(err);
  });

  // TCP level timeout to aggressively free sockets
  if (req.socket) {
    req.socket.setTimeout(timeout);
  }

  // Inject AbortController for Supabase queries
  req.abortController = new AbortController();
  req.on('aborted', () => req.abortController.abort());
  req.on('close', () => req.abortController.abort());

  next();
});

app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.status(200).send('Shopyos API is live.'));

app.get('/health', async (req, res) => {
  // Run Supabase and Redis health checks in parallel
  const supabaseStart = Date.now();
  const [supabaseResult, redisResult, appMetrics] = await Promise.all([
    supabaseAdmin.from('stores').select('id', { count: 'exact', head: true }).limit(1)
      .then(() => ({ connected: true, latency: `${Date.now() - supabaseStart}ms` }))
      .catch(err => ({ connected: false, reason: err.message })),
    redisHealthCheck(),
    Promise.resolve(getMetrics())
  ]);

  const overallStatus = supabaseResult.connected ? 'healthy' : 'degraded';

  res.status(overallStatus === 'healthy' ? 200 : 503).json({
    success: true,
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: appMetrics.uptime,
    startedAt: appMetrics.startedAt,
    environment: process.env.NODE_ENV || 'development',
    checks: {
      redis: redisResult,
      supabase: supabaseResult,
      memory: appMetrics.memory
    },
    performance: appMetrics.performance,
    cache: appMetrics.cache,
    requests: appMetrics.requests
  });
});

// Detailed metrics endpoint (for internal monitoring)
app.get('/metrics', async (req, res) => {
  const appMetrics = getMetrics();
  res.status(200).json({
    success: true,
    ...appMetrics,
    redis: await redisHealthCheck()
  });
});

app.get('/api', (req, res) => {
  res.status(200).json({
    success: true, message: 'Shopyos API', version: '1.0.0',
    currentVersion: 'v1', endpoints: { v1: '/api/v1', health: '/health' }, availableVersions: ['v1']
  });
});

app.get('/api/v1', (req, res) => {
  res.status(200).json({
    success: true, message: 'Shopyos API v1', version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth', stores: '/api/v1/business', products: '/api/v1/products',
      cart: '/api/v1/cart', orders: '/api/v1/orders', messaging: '/api/v1/messaging',
      deliveries: '/api/v1/deliveries', reviews: '/api/v1/reviews',
      notifications: '/api/v1/notifications', favorites: '/api/v1/favorites',
      admin: '/api/v1/admin', advertising: '/api/v1/advertising', paymentMethods: '/api/v1/payment-methods'
    }
  });
});

app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
app.use('/api/v1/upload', uploadLimiter);
app.use('/api/v1/orders/create', orderLimiter);
app.use('/api/v1/messaging', messageLimiter);
app.use('/api', apiLimiter);

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

// Legacy route forwarding for backward compatibility
const legacyRoutes = {
  '/api/auth': authRoutes, '/api/business': businessRoutes, '/api/products': productRoutes,
  '/api/upload': uploadRoutes, '/api/cart': cartRoutes, '/api/orders': orderRoutes,
  '/api/messaging': messagingRoutes, '/api/deliveries': deliveryRoutes, '/api/reviews': reviewRoutes,
  '/api/notifications': notificationRoutes, '/api/favorites': favoriteRoutes,
  '/api/admin': adminRoutes, '/api/advertising': advertisingRoutes,
};
Object.entries(legacyRoutes).forEach(([prefix, handler]) => {
  app.use(prefix, (req, res, next) => {
    req.url = prefix.replace('/api/', '/api/v1/') + req.url.substring(prefix.length);
    handler(req, res, next);
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = initializeSocket(server);
registerMessagingHandlers(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}] | Redis: ${redis ? 'enabled' : 'disabled'}`);
});

const gracefulShutdown = async (signal) => {
  logger.warn(`Received ${signal}, shutting down...`);

  // Close Socket.IO connections
  if (io) {
    io.close(() => {
      logger.info('Socket.IO connections closed');
    });
  }

  server.close(async () => {
    await redisDisconnect();
    process.exit(0);
  });
  setTimeout(() => { process.exit(1); }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

// Log but don't crash — a single rejected promise shouldn't kill the server
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

module.exports = app;
