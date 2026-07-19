# Shopyos — Project Knowledge Dump

> **Last updated:** 2026-07-19

## 1. Project Overview
**Shopyos** is a comprehensive multi-vendor mobile ecommerce platform. It connects buyers with independent sellers (businesses), independent delivery drivers, and parcel-transit partners, managed through both a mobile admin interface and a web-based admin dashboard.
- **Problem it solves:** Provides a unified marketplace for vendors to list products and users to buy them, complete with realtime delivery tracking, in-app messaging, bargaining, flash sales, loyalty/referral programmes, AI-powered marketing, and order management.
- **Target Audience:** General consumers (buyers), independent store owners/vendors (sellers), delivery personnel (drivers), parcel transit partners, and platform administrators.
- **Geography Focus:** Ghana (region-aware delivery, Arkesel SMS, Paystack payments, inter-regional logistics).

---

## 2. Repository Architecture (Microservices)
The repository is a **monorepo** with four distinct services plus shared infrastructure:

| Directory | Role | Runtime | Port |
|---|---|---|---|
| `/backend` | REST API server (Express.js) | Node.js 20 | 5000 |
| `/socket` | Dedicated Socket.io realtime server | Node.js | 5001 |
| `/frontend` | Mobile app (React Native / Expo) | Expo SDK 54 | 8081 |
| `/web` | Admin/Buyer web dashboard (Vite + React) | Vite 8 | 5173 |
| `/monitoring` | Prometheus + Loki + Grafana configs | Docker | 9020/3100/3000 |

---

## 3. Tech Stack

### Backend (`/backend`)
- **Framework:** Express.js 4.x with `express-async-errors`
- **Database:** PostgreSQL 16 via raw `pg` driver with a custom Supabase-like adapter (`supabaseLikePgClient.js`)
- **Caching & Rate Limiting:** Redis 7 (via `ioredis`, `rate-limit-redis`, `express-rate-limit`)
- **Authentication:** JWT (short-lived access + 7-day refresh token rotation with SHA-256 hashing, device/IP tracking, family-based revocation)
- **Object Storage:** MinIO (S3-compatible) via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- **Image Processing:** Sharp, Fluent-FFmpeg for video thumbnails
- **Email:** Nodemailer with HTML templates (`/backend/templates/`)
- **SMS:** Arkesel API
- **Push Notifications:** Expo Server SDK (`expo-server-sdk`)
- **AI Services:** Google Gemini (`@google/generative-ai`) — chatbot, knowledge base, and AI-powered marketing copy
- **Message Queue:** RabbitMQ (via `amqplib`) for async event publishing
- **Metrics:** `prom-client` (Prometheus) + `winston-loki` (Grafana Loki)
- **API Docs:** Swagger (`swagger-jsdoc` + `swagger-ui-express`)
- **Scheduled Jobs:** `node-cron` based scheduler + dedicated notification worker process
- **Data Export:** ExcelJS + fast-csv for admin exports
- **Security:** Helmet, compression, cookie-parser, bcrypt/bcryptjs, Gitleaks

### Frontend — Mobile App (`/frontend`)
- **Framework:** React Native 0.81 with Expo SDK 54
- **Routing:** Expo Router 6 (file-based routing)
- **State Management:** Zustand (authStore, cartStore, chatStore) + React Query v5 (persisted via `query-sync-storage-persister`)
- **Navigation:** React Navigation (Bottom Tabs, Material Top Tabs)
- **Realtime:** `socket.io-client`
- **Mapping:** `react-native-maps`
- **Media:** expo-camera, expo-image-picker, expo-av (audio/video), expo-image, react-native-view-shot
- **Animations:** Reanimated 4, Lottie (`@lottiefiles/dotlottie-react`, `lottie-react-native`)
- **Auth:** expo-auth-session (Google OAuth), expo-local-authentication (biometrics), expo-secure-store
- **Notifications:** expo-notifications
- **Communication:** react-native-webrtc (video/voice calling)
- **Other:** expo-location, expo-clipboard, expo-sharing, expo-print, expo-linear-gradient

### Frontend — Web Dashboard (`/web`)
- **Framework:** React 19 with Vite 8 + TypeScript 6
- **Styling:** TailwindCSS 4 (PostCSS)
- **State:** Zustand + React Query v5
- **Routing:** React Router DOM 7
- **Maps:** Leaflet + react-leaflet
- **Realtime:** socket.io-client
- **SEO:** react-helmet-async
- **PWA:** vite-plugin-pwa
- **Linting:** OxLint

### Socket Server (`/socket`)
- **Standalone Node.js service** with Socket.io 4.8
- **Redis Adapter** for horizontal scaling (`@socket.io/redis-adapter`)
- **JWT-authenticated** connections
- **Modules:** Messaging, Notifications, Presence, Voice/Video Calls
- **Events Architecture:** Redis pub/sub (`publishers/` and `subscribers/`)
- **Direct Postgres access** via `pg` for persistence

### Infrastructure & DevOps
- **Container Orchestration:** Docker Compose with 8 services:
  - `db` (Postgres 16), `redis` (Redis 7 Alpine), `storage` (MinIO), `storage-init` (bucket bootstrap)
  - `backend`, `socket`, `notification-worker` (background job processor)
  - `prometheus`, `loki`, `grafana` (observability stack)
- **CI/CD:** GitHub Actions (`.github/workflows/ci.yml`) — 8-stage pipeline:
  1. Secrets & Leaks Scan (Gitleaks)
  2. Backend Lint (ESLint)
  3. Frontend Lint (Expo/ESLint)
  4. Backend Unit Tests (Jest, Postgres + Redis service containers)
  5. Backend Integration Tests (Jest + Supertest, Postgres + Redis service containers)
  6. Frontend Tests (Jest-Expo)
  7. SonarCloud Analysis (code quality & coverage)
  8. Docker Build verification
- **Service Lifecycle Workflows:** `service-wakeup.yml`, `service-shutdown.yml`
- **Code Quality:** SonarCloud (org: `felano-technologies`, project: `Felano-Technologies_Shopyos`)
- **Production Deployment:** Railway (`railway.toml`)

---

## 4. Project Structure (Detailed)

### Backend (`/backend`)

```
server.js                  — App entry, Express setup, middleware chain, graceful shutdown
config/
  auth.js                  — JWT config (secrets, expiry, cookie settings)
  cacheInvalidation.js     — Cache key patterns + invalidation helpers
  envConfig.js             — Centralized env var access
  logger.js                — Winston logger (JSON structured, Loki transport)
  metrics.js               — Prometheus metrics registry + custom counters/histograms
  postgres.js              — PG pool creation and management
  production.js            — Production-specific hardening
  redis.js                 — Redis client + connection handling
  socketBridge.js          — Backend → Socket server event bridge (Redis pub/sub)
  storage.js               — S3/MinIO client, presigned URL generation, upload helpers
  swagger.js               — Swagger/OpenAPI spec config
controllers/ (37 files)
  authController.js        — Register, login, refresh, logout, OTP, password reset, Google OAuth, 2FA, sessions
  productController.js     — CRUD, search, categories, variants, flash sale products
  orderController.js       — Atomic order creation, status updates, cancellation, order history
  cartController.js        — Add/remove/update cart items, bargain-price cart support
  businessController.js    — Store CRUD, verification, settings, analytics, delivery config
  adminController.js       — Platform analytics, user/store management, moderation, settings
  adminExportController.js — CSV/Excel data exports for admin
  adminNotificationController.js — Admin broadcast notifications
  deliveryController.js    — Delivery assignment, status tracking, GPS updates, PIN verification
  deliveryFeeController.js — Dynamic delivery fee calculation (distance-based scaling)
  messagingController.js   — Conversations, messages, read receipts, AI chatbot integration
  reviewController.js      — Product/store reviews, comments, helpfulness voting, reporting
  paymentController.js     — Paystack payment initiation, verification, webhook handling
  payoutController.js      — Seller payout requests, processing, history
  advertisingController.js — Promoted products, impression/click tracking, campaign budgets
  bannerCampaignController.js — Banner ad campaigns
  bargainController.js     — Price negotiation (make offer, counter, accept/reject)
  flashSaleController.js   — Flash sale campaigns (time-limited discounts)
  loyaltyController.js     — Points earning, redemption, daily check-in, tier management
  loyaltyTransactionsController.js — Loyalty point transaction history
  recommendationController.js — AI-powered product recommendations
  returnController.js      — Return/refund requests, approval, processing
  snapController.js        — Short-form content (Snaps) — create, view, unique view tracking
  favoriteController.js    — Wishlist/favorites management
  categoryController.js    — Category CRUD with admin controls
  disclaimerController.js  — Product/store legal disclaimers
  driverController.js      — Driver profile, verification status
  feeConfigController.js   — Platform fee configuration (admin)
  listingFeeController.js  — Product listing fee management
  interRegionalController.js — Cross-region order logistics
  parcelPartnerController.js — Parcel transit partner management
  notificationController.js — Notification preferences, history
  promoController.js       — Promotional codes
  supportController.js     — Customer support ticket creation
  userActionController.js  — Recently viewed, user activity tracking
  buyerAnalyticsController.js — Buyer spending analytics
  paymentMethodController.js — Saved payment methods
db/
  adapters/
    supabaseLikePgClient.js — Custom Supabase-compatible query builder over raw pg
  repositories/ (34 files)
    BaseRepository.js      — Generic CRUD base class
    UserRepository.js, StoreRepository.js, ProductRepository.js,
    OrderRepository.js, CartRepository.js, DeliveryRepository.js,
    MessageRepository.js, ConversationRepository.js,
    ReviewRepository.js, FavoriteRepository.js, NotificationRepository.js,
    BargainRepository.js, FlashSaleRepository.js, LoyaltyRepository.js,
    PayoutRepository.js, ReturnRepository.js, DriverRepository.js,
    ParcelPartnerRepository.js, FeeConfigRepository.js,
    AdminRepository.js, AdminSettingsRepository.js, AuditLogRepository.js,
    BannerCampaignRepository.js, DisclaimerRepository.js,
    PromotedProductRepository.js, ProductVariantRepository.js,
    RecommendationRepository.js, ReportRepository.js, RoleRepository.js,
    ScheduledNotificationRepository.js, UserProfileRepository.js,
    PaymentMethodRepository.js, index.js (barrel export)
middleware/ (13 files)
  authMiddleware.js        — JWT verification, Redis blacklist, role caching
  businessMiddleware.js    — Seller verification status gate
  auditMiddleware.js       — Admin action audit logging
  cache.js                 — Redis response caching with stampede prevention
  errorHandler.js          — Global error handler + Sentry-ready
  idempotency.js           — Idempotent request handling (dedup via Redis)
  maintenanceMode.js       — Platform maintenance mode toggle
  performanceMonitor.js    — Request timing, latency histograms
  rateLimiter.js           — Tiered rate limiting (auth, API, admin)
  requireDisclaimer.js     — Disclaimer acceptance enforcement
  upload.js                — Multer config for file uploads
  validateRequest.js       — express-validator result checker
  validators.js            — Input validation schemas
routes/ (31 files)
  — One route file per domain (auth, products, orders, cart, delivery, messaging,
    reviews, payments, payouts, advertising, bargain, flashSale, loyalty,
    categories, favorites, notifications, admin, business, driver, returns,
    snaps, disclaimers, support, recommendations, parcelPartner, feeConfig,
    deliveryFee, uploadRoutes, userAction, buyerAnalytics, paymentMethod, promo)
services/
  ai/
    chatbot.js             — Gemini-powered AI chatbot for buyer support
    core.js                — AI client initialisation
    knowledge.js           — Knowledge base for AI context
    marketing.js           — AI-generated marketing copy, descriptions, campaigns
  notificationService.js   — Multi-channel notification dispatcher (push, email, SMS, in-app)
  expoPushService.js       — Expo push notification sender
  paystackService.js       — Paystack API integration
  recommendationService.js — Collaborative filtering + popularity-based recommendations
  moderationService.js     — Content moderation (AI-assisted)
  feeConfigService.js      — Platform fee calculation engine
  holidayService.js        — Holiday-aware delivery scheduling
  amqpPublisher.js         — RabbitMQ event publisher
  rabbitmq.js              — RabbitMQ connection management
  realtimePublisher.js     — Redis pub/sub for socket events
  transitEvents.js         — Parcel transit event handling
workers/
  scheduler.js             — Cron-based job scheduler (cleanup, analytics, alerts)
  notificationWorker.js    — Dedicated notification processing worker (runs as separate container)
  payoutScheduler.js       — Automated payout processing
  engagementAlerts.js      — Re-engagement notification triggers
jobs/
  monthlyWrap.js           — Monthly recap/summary generation
scripts/
  applyMigrations.js       — Idempotent migration runner (checksum-based)
  migrate.js               — Migration helper
  seed.js                  — Full database seeder (users, stores, products, orders, etc.)
  setup-prod.js            — Production environment bootstrap
  fix_seller_roles.js      — One-off role correction script
  test-delivery-pin.js     — Delivery PIN verification test
  test-driver-notifications.js — Driver notification test
templates/
  index.js                 — Email template engine (HTML email rendering)
  assets/                  — Email template assets
migrations/ (34+ SQL files)
  001_initial_schema.sql → 034_delivery_legs.sql — Full schema evolution
tests/
  unit/ (59 test files)    — Comprehensive unit tests for all controllers, middleware, services, utils
  integration/ (11 test files) — Integration tests (auth, business, cart, categories, favorites, health, notifications, orders, products, reviews, userActions)
  setup.js, globalSetup.js, globalTeardown.js, __mocks__/
```

### Frontend — Mobile App (`/frontend`)

```
app/                        — Expo Router screens (file-based routing)
  _layout.tsx              — Root layout (role-based tab navigation)
  index.tsx                — Splash / onboarding / landing
  home.tsx                 — Buyer home (featured products, banners, categories)
  search.tsx               — Product search with filters
  filter.tsx               — Advanced filter screen
  cart.tsx                  — Shopping cart
  checkout.tsx             — Multi-step checkout (address, delivery, payment)
  deals.tsx                — Deals & promotions
  for-you.tsx              — Personalised "For You" recommendations
  favorites.tsx            — Wishlist
  recent.tsx               — Recently viewed products
  stores.tsx               — Store discovery + listing
  notification.tsx         — Notification centre
  analytics.tsx            — Buyer spending analytics
  returns.tsx              — Return request management
  login.tsx                — Login (email/phone + Google OAuth)
  register.tsx             — Registration
  otp.tsx                  — OTP verification
  forgotPassword.tsx       — Forgot password flow
  forgotPasswordOTP.tsx    — OTP for password reset
  resetPassword.tsx        — Password reset
  force-reset-password.tsx — Admin-forced password reset
  two-factor.tsx           — 2FA setup
  role.tsx                 — Role selection (buyer/seller/driver/parcel-partner)
  getstarted.tsx           — Getting started / onboarding
  admin-login.tsx          — Admin-specific login
  userProfile.tsx          — Public user profile view
  settings.tsx             — Settings hub

  admin/ (29 screens + 3 subdirs)
    dashboard.tsx          — Admin dashboard (platform KPIs)
    stores.tsx             — Store management + details
    approvals.tsx          — Pending store/driver approvals
    orders.tsx             — All orders management
    deliveries.tsx         — Delivery management
    users.tsx              — User management
    user-buyers.tsx        — Buyer user management
    user-sellers.tsx       — Seller user management
    user-parcel-partners.tsx — Parcel partner management
    categories.tsx         — Category management
    ads.tsx                — Advertising/promotion management
    flash-sales.tsx        — Flash sale management
    fee-settings.tsx       — Platform fee configuration
    listing-fees.tsx       — Listing fee management
    payouts.tsx            — Payout processing
    revenue.tsx            — Revenue analytics
    broadcasts.tsx         — Broadcast notifications
    notifications.tsx      — Notification management
    audit-logs.tsx         — Audit trail viewer
    disclaimers.tsx        — Disclaimer management
    hubs.tsx               — Logistics hub management
    settings.tsx           — Platform settings
    support.tsx            — Support ticket management
    driverVerifications.tsx — Driver verification queue
    create-business.tsx    — Create business account
    create-driver.tsx      — Create driver account
    create-user.tsx        — Create user account
    product-form.tsx       — Product form (admin)

  business/ (21 screens + 3 subdirs)
    dashboard.tsx          — Seller dashboard (sales, orders, analytics)
    products.tsx           — Product management
    orders.tsx             — Order management
    orderDetails.tsx       — Order detail view
    inventory.tsx          — Inventory management
    analytics.tsx          — Business analytics
    earnings.tsx           — Earnings overview
    payout.tsx             — Payout requests
    transactions.tsx       — Transaction history
    promotions.tsx         — Self-serve promotions
    flash-sales.tsx        — Flash sale submissions
    flash-sale-submit.tsx  — Flash sale creation form
    bargains.tsx           — Bargain/offer management
    notifications.tsx      — Business notifications
    settings.tsx           — Store settings
    deliverySettings.tsx   — Delivery configuration
    updateProfile.tsx      — Profile editing
    register.tsx           — Business registration
    businessRegistration.tsx — Full registration flow
    verification.tsx       — Document upload for verification
    verification-status.tsx — Verification status tracking

  driver/ (10 screens)
    index.tsx              — Driver home
    dashboard.tsx          — Active deliveries dashboard
    activeOrder.tsx        — Active delivery detail + GPS tracking
    earnings.tsx           — Earnings overview
    history.tsx            — Delivery history
    notifications.tsx      — Driver notifications
    payout.tsx             — Driver payout requests
    payout-settings.tsx    — Payout bank/mobile money setup
    settings.tsx           — Driver settings
    verification.tsx       — Driver verification flow

  parcel-partner/ (6 screens)
    dashboard.tsx          — Partner dashboard
    parcels.tsx            — Parcel listing
    parcel-detail.tsx      — Parcel detail + status updates
    scan.tsx               — QR code scanning for parcel intake
    notifications.tsx      — Partner notifications
    settings.tsx           — Partner settings

  order/
    [id].tsx               — Order detail view
    tracking.tsx           — Live delivery tracking (map)
    transit-tracker.tsx    — Inter-regional transit tracking
    return-submit.tsx      — Return request form

  chat/
    index.tsx              — Conversations list (includes AI chatbot)
    conversation.tsx       — Chat conversation (text, images, voice messages)

  snaps/
    viewer.tsx             — TikTok-style short content viewer

  bargain/
    make-offer.tsx         — Submit a bargain offer
    my-offers.tsx          — View bargain offer history

  stores/
    details.tsx            — Store detail page
    storesMap.tsx          — Nearby stores map (native)
    storesMap.web.tsx      — Nearby stores map (web fallback)

  product/
    details.tsx            — Product detail page

  review/
    [id].tsx               — Store/product review page

  email/                   — Email deep-link handling

  receipt/                 — Order receipt screens

  payment/
    [id].tsx               — Paystack payment WebView

  support/
    index.tsx              — Create support ticket
    my-tickets.tsx         — View support ticket history

  settings/ (14 screens)
    Account.tsx            — Account info + profile editing
    Transactions.tsx       — Payment transaction history
    aboutApp.tsx           — App info, version, legal
    activeSessions.tsx     — Active session management (logout devices)
    blockedUsers.tsx       — Block/unblock users
    changePassword.tsx     — Password change
    contactUs.tsx          — Contact form
    helpCenter.tsx         — Help/FAQ centre
    loyaltyPoints.tsx      — Loyalty points dashboard + daily check-in
    myReviews.tsx          — User's review history
    paymentMethods.tsx     — Saved payment methods (cards, mobile money)
    privacyPolicy.tsx      — Privacy policy viewer
    pushNotifications.tsx  — Push notification preferences
    security.tsx           — Security settings (2FA, biometrics, sessions)

components/ (33 files + 7 subdirs)
  BottomNav.tsx, AdminBottomNav.tsx, BusinessBottomNav.tsx,
  DriverBottomNav.tsx, ParcelPartnerBottomNav.tsx — Role-specific navigation bars
  InAppToastHost.tsx       — Toast notification system
  QRScanner.tsx            — QR code scanner component
  ReviewCard.tsx, ReviewCommentsSheet.tsx — Review display components
  SnapsRow.tsx             — Snaps carousel component
  WelcomeCard.tsx          — Personalised welcome card
  DisclaimerModal.tsx, DisclaimerBadge.tsx — Disclaimer UI
  ConfirmModal.tsx, ReportModal.tsx — Modal components
  Skeleton.tsx             — Loading skeleton
  OfflineBanner.tsx        — Network status indicator
  MapView.tsx / MapView.web.tsx — Cross-platform map
  TappableAvatar.tsx       — Avatar with image preview
  ErrorBoundary.tsx        — Error boundary wrapper
  QueryProvider.tsx        — React Query setup + offline persistence
  admin/, chat/, home/, product/, skeletons/, ui/ — Sub-component directories

hooks/ (27 files)
  useAdmin.ts, useBusiness.ts, useOrders.ts, useProducts.ts,
  useDelivery.ts, useChat.ts, useFavorites.ts, useNotifications.ts,
  usePushNotifications.ts, useSnaps.ts, useRecommendations.ts,
  useBanners.ts, useFlashSales.ts, useCategories.ts, useStores.ts,
  useProfile.ts, useCloudinaryUpload.tsx, useImagePickerSheet.ts,
  useSocketSetup.ts, useDebounce.ts, useSellerGuard.ts, useDriverGuard.ts,
  useDailyCheckin.ts, useBackgroundTasks.ts, useColorScheme.ts

services/ (23 files)
  api.tsx                  — Axios instance + interceptors + token refresh
  client.ts                — API client with offline queue
  auth.ts                  — Auth service (login, register, OAuth, OTP, 2FA)
  socket.ts                — Socket.io connection + event handlers
  products.ts, orders.ts, business.ts, delivery.ts, payments.ts,
  messaging.ts, reviews.ts, advertising.ts, notifications.ts,
  bargain.ts, flashSales.ts, loyalty.ts, support.ts, recommendations.ts,
  parcelPartner.ts, disclaimers.ts, analytics.ts, storage.ts

store/
  authStore.ts, cartStore.ts, chatStore.ts — Zustand stores

context/
  ImagePreviewContext.tsx   — Full-screen image preview
  OnboardingContext.tsx     — First-launch onboarding flow
```

### Frontend — Web Dashboard (`/web`)

```
src/
  App.tsx                  — Root component with routing
  main.tsx                 — Vite entry point
  pages/ (14 pages)
    Home.tsx               — Landing / product discovery
    Search.tsx             — Product search
    ProductDetail.tsx      — Product detail page
    Cart.tsx               — Shopping cart
    Checkout.tsx           — Checkout flow
    Orders.tsx             — Order history
    OrderTracking.tsx      — Live order tracking (Leaflet map)
    Chat.tsx               — Messaging
    Profile.tsx            — User profile
    Login.tsx              — Authentication
    Register.tsx           — Registration
    ForgotPassword.tsx     — Forgot password
    ResetPassword.tsx      — Password reset
    NotFound.tsx           — 404 page
  components/
    SEO.tsx                — SEO meta tags (react-helmet-async)
    ErrorBoundary.tsx      — Error boundary
    common/                — Shared UI components
    layout/                — Page layout components
    maps/                  — Leaflet map components
  hooks/                   — React Query hooks
  services/                — API client layer
  store/                   — Zustand state management
  routes/                  — Route definitions
  lib/                     — Utility libraries
  styles/                  — CSS / Tailwind config
```

### Socket Server (`/socket`)

```
src/
  server.js                — Socket.io server entry + Redis adapter
  adapters/                — Redis adapter config
  config/                  — Server configuration
  modules/
    messaging/             — Real-time chat
    notifications/         — Push notification routing
    presence/              — Online/offline presence tracking
    calls/                 — Voice/video call signalling (WebRTC)
  events/
    publishers/            — Redis event publishers
    subscribers/           — Redis event subscribers
```

---

## 5. Features Built (Comprehensive)

### Core Commerce
- ✅ **Product Catalog:** Search (text + filters), categories, variants, product details with image galleries
- ✅ **Shopping Cart:** Persistent cart with Postgres upserts, bargain-price items, quantity management
- ✅ **Atomic Order Creation:** Custom Postgres RPC (`create_order_atomic`) — order + inventory decrement + payment record in a single transaction
- ✅ **Multi-step Checkout:** Address → delivery method → payment → confirmation
- ✅ **Payments:** Paystack integration (card + mobile money), payment verification, webhook handling
- ✅ **Order Management:** Status tracking, cancellation, order history with filtering
- ✅ **Wishlists/Favorites:** Save products, favourite stores
- ✅ **Recently Viewed:** User activity tracking
- ✅ **Personalised Recommendations:** AI-powered + collaborative filtering

### Bargaining System
- ✅ **Make Offer:** Buyers submit counter-price offers on eligible products
- ✅ **Seller Response:** Accept, reject, or counter-offer
- ✅ **Cart Integration:** Accepted bargain prices carry into cart and checkout
- ✅ **Notifications:** Real-time bargain status updates

### Flash Sales
- ✅ **Time-limited campaigns** with discounted pricing
- ✅ **Seller submission + Admin approval** workflow
- ✅ **Frontend countdown timers** and dedicated deals page

### Delivery & Logistics
- ✅ **Driver Assignment:** Manual and proximity-based
- ✅ **Live GPS Tracking:** Real-time driver location via Socket.io
- ✅ **Delivery PIN Verification:** Secure handoff confirmation
- ✅ **Dynamic Delivery Fees:** Distance-based fee scaling with configurable tiers
- ✅ **Inter-Regional Delivery:** Multi-leg parcel transit with hub management
- ✅ **Parcel Partner Role:** QR scanning, parcel intake/handoff, transit tracking
- ✅ **Holiday-Aware Scheduling:** Delivery scheduling respects holidays

### Returns & Refunds
- ✅ **Return Request Submission:** Buyer-initiated with reason and photos
- ✅ **Admin/Seller Review:** Approval/rejection workflow
- ✅ **Refund Processing:** Integrated with payout system

### Reviews & Ratings
- ✅ **Product & Store Reviews:** Star ratings with text content
- ✅ **Review Comments:** Threaded replies on reviews
- ✅ **Helpfulness Voting:** Upvote/downvote reviews
- ✅ **Content Reporting:** Flag inappropriate reviews

### Seller/Business Features
- ✅ **Store Registration & Verification:** Multi-step application with document upload + admin approval
- ✅ **Seller Dashboard:** Sales metrics, order stats, revenue charts
- ✅ **Product Management:** CRUD with variants, images, inventory tracking
- ✅ **Inventory Management:** Stock level tracking and alerts
- ✅ **Self-Serve Promotions:** Promoted products with impression/click tracking, budget management
- ✅ **Banner Campaigns:** Visual ad campaigns
- ✅ **Earnings & Payouts:** Revenue tracking, payout requests (bank/mobile money)
- ✅ **Business Settings:** Store info, delivery zones, operating hours
- ✅ **Seller Analytics:** Sales trends, top products, customer demographics
- ✅ **Business Snaps:** Short-form promotional content creation

### Admin Features
- ✅ **Platform Dashboard:** KPI metrics (GMV, orders, users, revenue)
- ✅ **User Management:** CRUD for buyers, sellers, drivers, parcel partners
- ✅ **Store Management:** Verification approval/rejection, store details
- ✅ **Order Management:** Platform-wide order oversight
- ✅ **Delivery Management:** All active deliveries
- ✅ **Category Management:** CRUD with ordering
- ✅ **Flash Sale Management:** Approval workflow
- ✅ **Ad Management:** Promoted products and banner campaigns
- ✅ **Fee Configuration:** Platform commission rates, listing fees, delivery fee tiers
- ✅ **Revenue Analytics:** Revenue breakdowns, trends
- ✅ **Payout Processing:** Approve/process seller payouts
- ✅ **Broadcast Notifications:** Platform-wide announcements
- ✅ **Audit Logs:** Admin action trail
- ✅ **Disclaimer Management:** Legal disclaimer CRUD
- ✅ **Support Ticket Management:** Ticket assignment and resolution
- ✅ **Logistics Hubs:** Regional hub management for parcel transit
- ✅ **Driver Verification Queue:** Document review and approval
- ✅ **Data Exports:** CSV/Excel exports for orders, users, products
- ✅ **Platform Settings:** Maintenance mode, feature flags
- ✅ **Admin User Creation:** Create accounts for any role

### Communication
- ✅ **In-App Messaging:** Real-time chat (text, images, voice messages)
- ✅ **AI Chatbot:** Gemini-powered customer support bot
- ✅ **Read Receipts:** Message delivery/read status
- ✅ **Presence Tracking:** Online/offline indicators
- ✅ **Voice/Video Calls:** WebRTC-based calling (signalling via Socket.io)
- ✅ **Push Notifications:** Expo push + in-app toasts
- ✅ **Email Notifications:** Templated HTML emails (order confirmation, verification, etc.)
- ✅ **SMS Notifications:** Arkesel integration for critical alerts

### Loyalty & Referrals
- ✅ **Points System:** Earn points on purchases, daily check-in
- ✅ **Tier Management:** Loyalty tier progression
- ✅ **Referral Programme:** Invite-based rewards
- ✅ **Point Redemption:** Apply points at checkout

### Snaps (Short-Form Content)
- ✅ **Content Creation:** Sellers create promotional short videos/images
- ✅ **Viewer:** TikTok-style vertical scroll viewer
- ✅ **Analytics:** Unique view tracking with IP deduplication

### Content & Social
- ✅ **Product Disclaimers:** Required acceptance before purchase
- ✅ **User Blocking:** Block/unblock other users
- ✅ **Content Moderation:** AI-assisted content flagging
- ✅ **User Reporting:** Report users/reviews/products

### AI Services
- ✅ **Chatbot:** Context-aware customer support via Google Gemini
- ✅ **Knowledge Base:** Product/platform knowledge for AI responses
- ✅ **Marketing Copy:** AI-generated product descriptions and campaign text
- ✅ **Recommendations:** AI-powered product suggestions

### Security & Auth
- ✅ **JWT Auth:** 15-min access tokens, 7-day refresh tokens
- ✅ **Token Family Rotation:** Stolen token detection via family chains
- ✅ **Google OAuth:** Social login via expo-auth-session
- ✅ **Two-Factor Authentication:** TOTP-based 2FA
- ✅ **Biometric Auth:** Fingerprint/Face ID via expo-local-authentication
- ✅ **Active Session Management:** View/revoke sessions per device
- ✅ **Admin-Forced Password Reset:** Security override
- ✅ **Redis Token Blacklist:** Instant token revocation
- ✅ **Role-Based Access Control:** Granular middleware per role
- ✅ **Idempotency Middleware:** Prevents duplicate request processing
- ✅ **Secrets Scanning:** Gitleaks in CI pipeline

---

## 6. Data Models / Schema (34+ migrations)

*(Managed via PostgreSQL with custom migration runner)*

| Model | Key Columns | Notes |
|---|---|---|
| **users** | id, email, phone, password_hash, role, google_id, two_factor_secret, password_reset_required | Multi-role (buyer/seller/driver/admin/parcel_partner) |
| **stores** | id, user_id, name, verification_status, verified_at, business_config | Status: pending/verified/rejected |
| **products** | id, store_id, name, price, category_id, status, enable_bargaining | Supports variants |
| **product_variants** | id, product_id, attributes, price, stock | SKU-level variants |
| **inventory** | id, product_id, quantity | Atomic decrement via RPC |
| **orders** | id, buyer_id, store_id, status, total, delivery_method, amounts | Atomic creation |
| **order_items** | id, order_id, product_id, quantity, price | Line items |
| **carts / cart_items** | buyer_id, product_id, quantity, bargain_price | Bargain-aware |
| **deliveries** | id, order_id, driver_id, status, lat, lng, delivery_pin | GPS + PIN verification |
| **delivery_legs** | id, delivery_id, hub_id, sequence, status | Multi-leg transit |
| **payments** | id, order_id, amount, method, status, paystack_ref | Paystack integration |
| **payouts** | id, store_id, amount, status, bank_details | Seller payouts |
| **refresh_tokens** | id, user_id, hash, device_id, family, ip | Token rotation |
| **conversations / messages** | participants, content, read_at, message_type | Chat system |
| **product_reviews / store_reviews** | rating, content, helpful_count | With comments |
| **promoted_products** | id, product_id, budget, impressions, clicks | Ad campaigns |
| **banner_campaigns** | id, image_url, product_id, clicks, impressions | Banner ads |
| **bargains** | id, product_id, buyer_id, offered_price, status | Negotiation |
| **flash_sales** | id, product_id, sale_price, starts_at, ends_at | Time-limited |
| **loyalty_points / loyalty_transactions** | user_id, balance, tier | Points + history |
| **returns** | id, order_id, reason, status, images | Return requests |
| **favorites** | user_id, product_id / store_id | Wishlist |
| **categories** | id, name, parent_id, display_order | Hierarchical |
| **disclaimers** | id, type, content, required | Legal notices |
| **support_tickets** | id, user_id, subject, status, assigned_to | Customer support |
| **notifications / scheduled_notifications** | type, channel, payload | Multi-channel |
| **audit_logs** | admin_id, action, entity, details | Admin audit trail |
| **platform_settings / fee_config** | key, value | System config |
| **user_actions** | user_id, action_type, product_id | Activity tracking |
| **snaps / snap_views** | content, views, unique_views | Short-form content |
| **parcel_partners / parcel_transit_routes** | hub_id, route, status | Logistics |
| **database_views** | Materialized views for analytics | Performance |

---

## 7. API Routes / Endpoints (31 route files)

| Domain | Base Path | Key Endpoints |
|---|---|---|
| **Auth** | `/auth` | register, login, refresh, logout-all, sessions, google, verify-otp, forgot-password, reset-password, 2fa |
| **Products** | `/products` | search, /:id, /store/:storeId, /categories, variants, flash-sale-products |
| **Cart** | `/cart` | get, add, remove, update, clear |
| **Orders** | `/orders` | create (atomic), /mine, /:id, cancel, update-status |
| **Delivery** | `/delivery` | assign, /:id, update-location, verify-pin, update-status |
| **Delivery Fees** | `/delivery-fees` | calculate, config |
| **Payments** | `/payments` | initiate, verify, webhook, history |
| **Payment Methods** | `/payment-methods` | list, add, remove, set-default |
| **Payouts** | `/payouts` | request, /:id, history, process (admin) |
| **Business** | `/business` | register, profile, settings, analytics, delivery-config, verification |
| **Admin** | `/admin` | dashboard, stores, users, orders, deliveries, categories, settings, audit-logs, exports |
| **Advertising** | `/advertising` | promote, campaigns, impressions, clicks, banners |
| **Bargain** | `/bargain` | make-offer, respond, /:id, /my-offers |
| **Flash Sales** | `/flash-sales` | create, submit, approve, active, upcoming |
| **Reviews** | `/reviews` | product, store, comments, helpful, report |
| **Messaging** | `/messaging` | conversations, messages, send, read-receipts |
| **Notifications** | `/notifications` | list, mark-read, preferences, broadcast (admin) |
| **Categories** | `/categories` | list, create, update, delete, reorder |
| **Favorites** | `/favorites` | add, remove, list |
| **Loyalty** | `/loyalty` | balance, earn, redeem, check-in, transactions, tiers |
| **Returns** | `/returns` | submit, /:id, approve, reject |
| **Snaps** | `/snaps` | create, /:id, view, analytics |
| **Support** | `/support` | create-ticket, my-tickets |
| **Recommendations** | `/recommendations` | for-you, similar, trending |
| **Parcel Partners** | `/parcel-partners` | register, parcels, scan, update-status |
| **User Actions** | `/user-actions` | recently-viewed, track |
| **Buyer Analytics** | `/buyer-analytics` | spending-summary |
| **Disclaimers** | `/disclaimers` | list, accept, admin-crud |
| **Fee Config** | `/fee-config` | get, update (admin) |
| **Promo Codes** | `/promos` | validate, apply |
| **Uploads** | `/upload` | images, videos, documents (presigned URLs) |

---

## 8. Auth & Permissions

- **Mechanism:** JWT in `Authorization: Bearer <token>` headers + HTTP-only refresh token cookie
- **Access Token:** 15-minute expiry
- **Refresh Token:** 7-day expiry, SHA-256 hashed in DB, family chain for rotation
- **Anti-Fraud:** Reuse of old refresh token revokes entire family + device
- **Device Tracking:** `deviceId`, IP address, user-agent logged per session
- **Google OAuth:** Server-side token verification + account linking
- **2FA:** TOTP-based two-factor authentication (optional per user)
- **Biometrics:** expo-local-authentication (Face ID / Fingerprint) on mobile
- **Middleware Chain:** `authMiddleware` → JWT verify → Redis blacklist check → role cache (5 min TTL) → role guard (`admin()`, `seller()`, `driver()`, `parcelPartner()`)
- **Seller Lockout:** Unverified sellers restricted to verification screen only
- **Maintenance Mode:** Global middleware can lock all endpoints except admin

---

## 9. Environment Variables & Config

**Root `.env` (Docker Compose shared)**
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DB_PORT`
- `REDIS_PASSWORD`, `REDIS_PORT`
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT`, `STORAGE_BUCKET`
- `BACKEND_PORT`, `SOCKET_PORT`, `NODE_ENV`
- `JWT_SECRET`, `JWT_EXPIRE`, `FRONTEND_URL`, `REALTIME_EVENTS_CHANNEL`
- `DATABASE_URL`, `REDIS_URL`

**Backend-Specific**
- `PG_POOL_MIN`, `PG_POOL_MAX`, `PG_SSL`
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `EMAIL_FROM_NAME`
- `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PUBLIC_URL`
- `GOOGLE_CLIENT_ID`
- `ARKESEL_API_KEY`, `ARKESEL_SENDER_ID`
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`
- `LOG_LEVEL`, `CORS_ORIGINS`
- `RABBITMQ_URL`
- `ENABLE_LOCAL_SOCKET`, `ALLOW_SEED`
- `GEMINI_API_KEY`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `LOKI_HOST` (optional, for Grafana Loki)

**Frontend (Expo)**
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SOCKET_URL`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

---

## 10. Testing

### Backend Unit Tests (59 files)
All controllers, middleware, services, and utilities are unit-tested with Jest:
- Controllers: auth, admin (including new functions), adminExport, adminNotification, adminHub, advertising, bannerCampaign, bargain, business, cart, category, delivery, deliveryFee, disclaimer, driver, favoriteController, feeConfig, flashSale, interRegional, messaging, notification, order, parcelPartner, payment, paymentMethod, payout, product, review, snap, userAction
- Middleware: auth, businessMiddleware, audit, cache, cacheInvalidation, errorHandler, performanceMonitor, rateLimiter, requireDisclaimer, upload, validators
- Services: aiServices, expoPush, feeConfig, holiday, moderation, notification, paystack, realtimePublisher, recommendation, amqpPublisher, rabbitmq
- Utils: auth.config, distance, pushConfig, templates, validateEnv

### Backend Integration Tests (11 files)
End-to-end API tests with Postgres + Redis service containers:
- auth, business, cart, categories, favorites, health, notifications, orders, products, reviews, userActions

### Frontend Tests
- Jest-Expo preset with `@testing-library/react-native`
- Test directory: `frontend/__tests__/`

### UAT Test Plans
- `UAT_BUYER_TEST_PLAN.md` — 406 lines covering all buyer features
- `UAT_SELLER_TEST_PLAN.md` — 18KB covering all seller features

---

## 11. Business Logic & Rules

- **Order Atomicity:** Orders created via Postgres RPC — inventory decrement + order + payment in one transaction. Stock shortage = full rollback.
- **Cache Invalidation:** Product/store/order mutations invalidate associated Redis keys (search, listings, store data).
- **Anti-Fraud (Auth):** Refresh token reuse → all tokens in that device family revoked immediately.
- **Vendor Gatekeeping:** Unverified sellers locked to verification screen. No product/order/analytics access until admin-approved.
- **Driver Verification:** Drivers must submit documents and be admin-approved before receiving deliveries.
- **Delivery PIN:** Driver must enter buyer-provided PIN to confirm delivery handoff.
- **Bargaining:** Buyers make offers → Sellers accept/reject/counter → Accepted prices flow into cart.
- **Flash Sales:** Time-windowed pricing. Seller submits → Admin approves → Auto-activates/deactivates based on schedule.
- **Platform Fees:** Configurable commission rates per transaction, listing fees for products, delivery fee tiers.
- **Payout Rules:** Sellers request payouts → Admin reviews → Processed to bank/mobile money.
- **Idempotency:** Critical endpoints (orders, payments) protected by Redis-backed idempotency keys.
- **Rate Limiting:** Tiered limits — auth (strict), general API (moderate), admin (relaxed).
- **Maintenance Mode:** Admin can lock platform; only admin endpoints remain accessible.

---

## 12. Observability & Monitoring

- **Prometheus:** Metrics scraping from backend (`prom-client` — request latency, error rates, custom counters)
- **Grafana:** Dashboards with auto-provisioned data sources
- **Loki:** Log aggregation via `winston-loki` transport
- **Performance Monitor Middleware:** Per-request timing, latency histograms, slow-query detection

---

## 13. Current State & What Remains

### Completed (~85%)
All core commerce, seller tools, buyer flows, driver management, admin dashboard (mobile + partial web), real-time chat, payments (Paystack), bargaining, flash sales, loyalty, returns, snaps, AI chatbot, parcel transit, notifications (push + email + SMS + in-app), comprehensive backend test suite, Docker Compose dev environment, CI/CD pipeline, monitoring stack.

### In Progress / Remaining (~15%)
- **Web Dashboard Completion:** Buyer-facing web store is scaffolded (14 pages) but needs feature parity polish with mobile
- **Voice/Video Calls:** WebRTC signalling is wired; end-to-end call UX needs hardening
- **RabbitMQ Integration:** Publisher/consumer code exists but not yet active in all flows
- **Driver GPS Reliability:** Real-world GPS unreliability handling (reconnect, stale position fallbacks)
- **Production Deployment Hardening:** Railway config exists; full prod environment validation pending
- **Frontend Test Coverage:** Backend has 70 test files; frontend test coverage needs expansion
- **Advanced Content Moderation:** Auto-flagging framework exists; ML model integration pending
- **Performance Tuning:** Database materialized views exist; query optimisation for high-traffic scenarios
