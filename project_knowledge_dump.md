# Shopyos — Project Knowledge Dump

## 1. Project Overview
**Shopyos** is a comprehensive multi-vendor mobile ecommerce platform. It connects buyers with independent sellers (businesses) and independent delivery drivers, managed by a centralized admin dashboard. 
- **Problem it solves:** Provides a unified marketplace for vendors to list products and users to buy them, complete with realtime delivery tracking, messaging, and order management.
- **Target Audience:** General consumers (buyers), independent store owners/vendors (sellers), delivery personnel (drivers), and platform administrators.

## 2. Tech Stack
**Frontend (Mobile App)**
- **Framework:** React Native with Expo (SDK 54)
- **Routing:** Expo Router (file-based routing)
- **State/Data Fetching:** React Query (`@tanstack/react-query`) with persisted storage
- **Navigation:** React Navigation (Bottom Tabs, Top Tabs)
- **Realtime:** `socket.io-client`
- **Mapping:** `react-native-maps`
- **Storage:** `@react-native-async-storage/async-storage`

**Backend (API Server)**
- **Runtime:** Node.js
- **Framework:** Express.js 4.x
- **Database / BaaS:** Supabase (PostgreSQL) using `@supabase/supabase-js`, PostgREST, and custom RPC functions.
- **Caching & Rate Limiting:** Redis (via `ioredis` and `rate-limit-redis`)
- **Realtime:** Socket.io (with Redis adapter)
- **Authentication:** JWT (JSON Web Tokens) with short-lived access tokens and secure refresh token rotation via SHA-256 caching.
- **File Uploads:** Cloudinary + Multer
- **Email/SMS:** Nodemailer, Arkesel SMS provider
- **Logging:** Winston (structured JSON logging)

## 3. Project Structure
The repository is split into two distinct directories: `/frontend` and `/backend`.

### Backend (`/backend`)
- `server.js`: Application entry point, Express setup, middleware injection, graceful shutdown.
- `config/`: Configuration files for Redis, Supabase, Cloudinary, Auth, and Loggers.
- `controllers/`: HTTP request handlers (e.g., `authController.js`, `productController.js`, `orderController.js`).
- `db/repositories/`: Data access layer abstracting Supabase calls.
- `middleware/`: Custom Express middlewares (`authMiddleware.js`, `cache.js`, `rateLimiter.js`, `validators.js`).
- `routes/`: API route definitions.
- `migrations/`: SQL files for Supabase schema and RPC functionality.
- `services/`: External integrations (e.g., notifications).

### Frontend (`/frontend`)
- `app/`: Expo Router screens and layouts.
  - `_layout.tsx`: Root tab/stack layout.
  - `admin/`, `business/`, `driver/`: Dedicated dashboards and flows for different roles.
  - Core screens: `home.tsx`, `cart.tsx`, `search.tsx`, `order.tsx`, `login.tsx`, `register.tsx`, etc.
- `components/`: Reusable React components.
- `hooks/`: Custom React hooks (likely for React Query wrappers).
- `services/`: API client handlers (Axios instances).
- `assets/`: Images, fonts, and static resources.

## 4. Features Built So Far
- **Production-Grade Authentication:** 15-minute access tokens, 7-day refresh tokens (hashed in DB), token family rotation (detects stolen tokens), device/IP session tracking, and global logout.
- **Store Management & Verification:** Business accounts are created as 'pending'. They are completely locked out of the app until an Admin approves them via the `/admin/stores` interface.
- **Product Catalog & Caching:** Hierarchical Redis caching strategy for product searches, categories, and store listings with cache stampede prevention.
- **Shopping Cart:** Persistent cart system handling concurrent additions via Postgres upserts.
- **Atomic Order Creation:** Custom Postgres RPC (`create_order_atomic`) that handles order insertion, atomic inventory decrements, and payment record creation inside a single database transaction to prevent overselling.
- **Promoted Products:** Ad system tracking impressions and clicks using atomic counters in Postgres.
- **Reviews & Ratings:** Buyers can leave reviews for products and stores.
- **Realtime Communications:** Socket.io setup for order status updates, delivery driver GPS tracking, and user-to-user messaging.
- **Notifications:** Multi-channel alerts via in-app, Email, and SMS (Arkesel).
- **Admin Analytics:** Aggregated dashboard metrics via SQL RPCs to prevent JS memory exhaustion.

## 5. Features Not Yet Built (Remaining ~40%)
*Note: Depending on the immediate roadmap, the following areas require completion or integration:*
- **Real Payment Gateway Integration:** The current system uses a simulated `verifyPayment` function (guarded by dev environment checks). Integration with Stripe, Paystack, or Flutterwave is required.
- **Driver Flow Polish:** The frontend `/driver` screens and Socket.io live tracking UI need hardening for real-world GPS unreliability.
- **Advanced Admin Moderation:** Dispute resolution, refund processing, and deep content moderation (auto-flagging).
- **Production Deployment:** CI/CD pipelines, containerization (Docker), and orchestrated hosting (e.g., Render/Railway/AWS).
- **End-to-End Testing:** Comprehensive suite using Jest/Detox for mobile and Supertest for the API.

## 6. Data Models / Schema
*(Managed via Supabase PostgreSQL)*
- **Users:** Base accounts (roles: buyer, seller, driver, admin).
- **Stores:** Vendor profiles linked to Users. Includes `verification_status` ('pending', 'verified', 'rejected') and `verified_at`.
- **Products:** Items listed by Stores. Includes price, category, status.
- **Inventory:** Tracks available `quantity` per `product_id`.
- **Orders & Order_Items:** Transaction records linked to Buyers and Stores.
- **Carts & Cart_Items:** Pre-checkout staging.
- **Refresh_Tokens:** Manages auth rotation (deviceId, hash, family).
- **Promoted_Products:** Tracks campaign budgets, impressions, and clicks.
- **Deliveries:** Maps Orders to Drivers, tracking status and coordinates.
- **Messages & Conversations:** Chat system payloads.
- **Reviews:** `product_reviews` and `store_reviews`.

## 7. API Routes / Endpoints (High-Level)
- **Auth:** `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout-all`, `GET /auth/sessions`
- **Products:** `GET /products/search` (cached), `GET /products/:id` (cached), `GET /products/store/:storeId`, `GET /products/categories`
- **Cart:** `GET /cart`, `POST /cart/add`, `DELETE /cart/remove`
- **Orders:** `POST /orders` (calls atomic DB function), `GET /orders/mine`, `GET /orders/:id`
- **Business:** `GET /business/all`, `GET /business/:id`, `PUT /business/verification`
- **Admin:** `GET /admin/stores`, `PUT /admin/stores/:storeId/verify`, `GET /admin/analytics`

## 8. Auth & Permissions
- **Mechanism:** JWT in `Authorization: Bearer <token>` headers.
- **Middleware Check:** `authMiddleware.js` verifies JWT, checks against a Redis blacklist, and fetches user roles (caching the roles in Redis for 5 minutes).
- **Role-Based Access:** Endpoints are guarded by role-specific middleware (e.g., `admin()`, `seller()`, `driver()`).
- **Seller Lockout:** Middleware/Frontend guard explicitly checks `verification_status`. If not 'verified', the seller is restricted to the `/business/verification` screen.

## 9. UI/UX State
- **Structure:** Tab-based primary navigation with nested stack screens.
- **Roles:** The app dynamically renders different dashboard environments (`/admin`, `/business`, `/driver`, generic `/user`) depending on the logged-in user's role.
- **Styling:** React Native styling paradigms. The lack of standard Nativewind config files suggests standard `StyleSheet` or inline utility usage.
- **Key Screens:**
  - `/home`, `/search`, `/categories`, `/deals`: Core buyer discovery.
  - `/cart`, `/payment`, `/receipt`: Checkout funnel.
  - `/business/dashboard` *(Lockout)* + `/business/products`, `/business/orders`: Vendor management.

## 10. Environment Variables & Config
**Backend (`.env`)**
- `PORT`
- `NODE_ENV` (development/production)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL`
- `JWT_SECRET`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (Email)
- `CORS_ORIGINS`

**Frontend (`.env` / Expo Config)**
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## 11. Known Bugs / Issues / TODOs
- **Payment Gateway:** Fully implement real payment processing.
- **Image Uploads:** Ensure Cloudinary storage cleanup for deleted products/users.
- **Frontend Refactor:** The backend has been heavily optimized for concurrency and caching; the frontend React Query hooks must be verified to properly consume the new Redis-cached structures and handle standard HTTP 429 Rate Limit responses.

## 12. Business Logic & Rules
- **Order Atomicity:** An order cannot be created unless inventory is successfully decremented in the same transaction. If stock falls short during checkout, the entire order is rolled back.
- **Cache Invalidation:** Updating a product, store, or making an order immediately invalidates associated Redis keys (like search hashes and store listings) to prevent stale data.
- **Anti-Fraud (Auth):** If an old refresh token is reused, all tokens associated with that device/family are immediately revoked.
- **Vendor Gatekeeping:** Vendors cannot view analytics, add products, or receive orders until human admin approval is recorded in the `stores` table context.
