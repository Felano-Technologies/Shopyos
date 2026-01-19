// db/repositories/index.js
// Central export for all repository classes

const { supabaseAdmin } = require('../../config/supabase');

const UserRepository = require('./UserRepository');
const StoreRepository = require('./StoreRepository');
const ProductRepository = require('./ProductRepository');
const OrderRepository = require('./OrderRepository');
const CartRepository = require('./CartRepository');
const ConversationRepository = require('./ConversationRepository');
const MessageRepository = require('./MessageRepository');
const DeliveryRepository = require('./DeliveryRepository');
const ReviewRepository = require('./ReviewRepository');
const NotificationRepository = require('./NotificationRepository');
const AdminRepository = require('./AdminRepository');
const PromotedProductRepository = require('./PromotedProductRepository');
const ReportRepository = require('./ReportRepository');
const AuditLogRepository = require('./AuditLogRepository');

// Initialize repositories with supabase admin client
const repositories = {
  users: new UserRepository(supabaseAdmin),
  stores: new StoreRepository(supabaseAdmin),
  products: new ProductRepository(supabaseAdmin),
  orders: new OrderRepository(supabaseAdmin),
  carts: new CartRepository(supabaseAdmin),
  conversations: new ConversationRepository(supabaseAdmin),
  messages: new MessageRepository(supabaseAdmin),
  deliveries: new DeliveryRepository(supabaseAdmin),
  reviews: new ReviewRepository(supabaseAdmin),
  notifications: new NotificationRepository(supabaseAdmin),
  admin: new AdminRepository(supabaseAdmin),
  promotedProducts: new PromotedProductRepository(supabaseAdmin),
  reports: new ReportRepository(supabaseAdmin),
  auditLogs: new AuditLogRepository(supabaseAdmin)
};

module.exports = repositories;
