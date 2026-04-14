// db/repositories/index.js
// Central export for all repository classes

const { createPgClient } = require('../adapters/supabaseLikePgClient');
const repositoryClient = createPgClient();

const UserRepository = require('./UserRepository');
const UserProfileRepository = require('./UserProfileRepository');
const RoleRepository = require('./RoleRepository');
const StoreRepository = require('./StoreRepository');
const ProductRepository = require('./ProductRepository');
const OrderRepository = require('./OrderRepository');
const CartRepository = require('./CartRepository');
const ConversationRepository = require('./ConversationRepository');
const MessageRepository = require('./MessageRepository');
const DeliveryRepository = require('./DeliveryRepository');
const ReviewRepository = require('./ReviewRepository');
const NotificationRepository = require('./NotificationRepository');
const FavoriteRepository = require('./FavoriteRepository');
const AdminRepository = require('./AdminRepository');
const PromotedProductRepository = require('./PromotedProductRepository');
const BannerCampaignRepository = require('./BannerCampaignRepository');
const PayoutRepository = require('./PayoutRepository');
const ReportRepository = require('./ReportRepository');
const AuditLogRepository = require('./AuditLogRepository');
const PaymentMethodRepository = require('./PaymentMethodRepository');
const DriverRepository = require('./DriverRepository');


// Initialize repositories with selected client
const repositories = {
  users: new UserRepository(repositoryClient),
  userProfiles: new UserProfileRepository(repositoryClient),
  roles: new RoleRepository(repositoryClient),
  stores: new StoreRepository(repositoryClient),
  products: new ProductRepository(repositoryClient),
  orders: new OrderRepository(repositoryClient),
  carts: new CartRepository(repositoryClient),
  conversations: new ConversationRepository(repositoryClient),
  messages: new MessageRepository(repositoryClient),
  deliveries: new DeliveryRepository(repositoryClient),
  reviews: new ReviewRepository(repositoryClient),
  notifications: new NotificationRepository(repositoryClient),
  favorites: new FavoriteRepository(repositoryClient),
  admin: new AdminRepository(repositoryClient),
  promotedProducts: new PromotedProductRepository(repositoryClient),
  bannerCampaigns: new BannerCampaignRepository(repositoryClient),
  payouts: new PayoutRepository(repositoryClient),
  reports: new ReportRepository(repositoryClient),
  auditLogs: new AuditLogRepository(repositoryClient),
  paymentMethods: new PaymentMethodRepository(repositoryClient),
  drivers: new DriverRepository(repositoryClient),
};

module.exports = repositories;
