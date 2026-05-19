/**
 * Shopyos Database Seeder
 * Run: node scripts/seed.js
 *
 * Test accounts (password for all: Password123!)
 *  admin@shopyos.com      — Admin
 *  kwame@test.com         — Buyer
 *  ama@test.com           — Buyer
 *  kofi.sells@test.com    — Seller (TechHub Accra)
 *  abena.fashions@test.com— Seller (Abena Fashions)
 *  yaw.foods@test.com     — Seller (Yaw's Fresh Groceries)
 *  driver@test.com        — Driver
 */

// Load root docker .env first (has POSTGRES_USER/PASSWORD/DB), then backend .env
// This lets the seed run from the host against the Docker Postgres on localhost.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });       // root .env (docker vars)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // backend .env (fills unset vars)

// When running from the host machine, the Docker DB is on localhost:5432.
// Inside Docker, DATABASE_URL would use "db" as host — but we're running locally.
// Build the correct host-side DATABASE_URL if it still points to Supabase or a remote host.
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('supabase') || process.env.DATABASE_URL.includes('.co')) {
  const {
    POSTGRES_USER = 'postgres',
    POSTGRES_PASSWORD = 'postgres',
    POSTGRES_DB = 'shopyos',
    DB_PORT = '5432',
  } = process.env;
  process.env.DATABASE_URL = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${DB_PORT}/${POSTGRES_DB}`;
  console.log('ℹ️  DATABASE_URL overridden to local Docker Postgres:', process.env.DATABASE_URL);
}


// ─── PRODUCTION GUARD ─────────────────────────────────────────────────────────
// This script MUST NEVER run against a production database.
// It is blocked by three independent checks:
//   1. NODE_ENV must not be 'production'
//   2. DATABASE_URL must not point to a Sevalla/production host
//   3. The explicit ALLOW_SEED flag must be set to 'true'
// ─────────────────────────────────────────────────────────────────────────────

const NODE_ENV = (process.env.NODE_ENV || '').toLowerCase();
const DB_URL   = (process.env.DATABASE_URL || '').toLowerCase();
const ALLOW    = (process.env.ALLOW_SEED   || '').toLowerCase();

// Check 1 — NODE_ENV
if (NODE_ENV === 'production') {
  console.error('❌  BLOCKED: Seed script cannot run when NODE_ENV=production.');
  process.exit(1);
}

// Check 2 — Database URL must not point to a production/Sevalla host
const PROD_DB_PATTERNS = ['sevalla', '.sevalla.com', 'render.com', 'railway.app', 'heroku', 'neon.tech', 'supabase.co'];
if (PROD_DB_PATTERNS.some(p => DB_URL.includes(p))) {
  console.error('❌  BLOCKED: DATABASE_URL appears to point to a production database.');
  console.error('   If this is genuinely a dev DB on that host, set ALLOW_SEED=true explicitly.');
  process.exit(1);
}

// Check 3 — Explicit opt-in flag (prevents accidental runs)
if (ALLOW !== 'true') {
  console.error('❌  BLOCKED: ALLOW_SEED env var is not set to "true".');
  console.error('   To run the seeder locally, set ALLOW_SEED=true in your .env file.');
  process.exit(1);
}

console.log('✅  Environment checks passed. Running seed on:', DB_URL.split('@')[1] || DB_URL);
console.log('⚠️  NODE_ENV:', NODE_ENV || '(not set)');
console.log('');

const bcrypt = require('bcryptjs');
const { getPool } = require('../config/postgres');

// ─── Constants ──────────────────────────────────────────────────────────────
const PASSWORD = 'Password123!';
const SUPPORT_USER_ID = '00000000-0000-0000-0000-000000000001';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const hash = (pw) => bcrypt.hash(pw, 10);

async function query(sql, params = []) {
  const pool = getPool();
  return pool.query(sql, params);
}

async function insertUser(db, { email, name, phone, city, lat, lng, country = 'Ghana', password = null }) {
  const pw = await hash(password || PASSWORD);
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, email_verified, is_active)
     VALUES ($1, $2, TRUE, TRUE) 
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [email, pw]
  );
  const userId = rows[0].id;
  await db.query(
    `UPDATE user_profiles SET full_name = $2, phone = $3, city = $4, country = $5, latitude = $6, longitude = $7
     WHERE user_id = $1`,
    [userId, name, phone, city, country, lat, lng]
  );
  return userId;
}

async function assignRole(db, userId, roleId) {
  await db.query(
    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, roleId]
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  const pool = getPool();
  const db = await pool.connect();
  console.log('🌱 Starting seed...\n');

  try {
    await db.query('BEGIN');

    // ── 1. Roles ─────────────────────────────────────────────────────────────
    console.log('📌 Upserting roles...');
    await db.query(`
      INSERT INTO roles (name, display_name, description) VALUES
        ('buyer',  'Buyer',  'Can browse and purchase products'),
        ('seller', 'Seller', 'Can list and sell products'),
        ('driver', 'Driver', 'Can deliver orders'),
        ('admin',  'Admin',  'Full platform access')
      ON CONFLICT (name) DO NOTHING
    `);
    const { rows: roleRows } = await db.query('SELECT id, name FROM roles');
    const roleMap = Object.fromEntries(roleRows.map(r => [r.name, r.id]));
    console.log('   ✅ Roles ready\n');

    // ── 2. Support system user (Shopyos Bot) ──────────────────────────────────
    console.log('📌 Creating Shopyos Bot...');
    const pw = await hash('NOT_A_LOGIN_PASSWORD_DO_NOT_USE');
    await db.query(`
      INSERT INTO users (id, email, password_hash, email_verified, is_active)
      VALUES ($1, 'bot@shopyos.com', $2, TRUE, TRUE)
      ON CONFLICT (id) DO NOTHING
    `, [SUPPORT_USER_ID, pw]);
    await db.query(`
      UPDATE user_profiles SET full_name = $2, phone = $3, city = $4, country = $5
      WHERE user_id = $1
    `, [SUPPORT_USER_ID, 'Shopyos Bot', '+233000000000', 'Accra', 'Ghana']);
    await assignRole(db, SUPPORT_USER_ID, roleMap.admin);
    console.log('   ✅ Shopyos Bot ready\n');

    // ── 3. Admin user ─────────────────────────────────────────────────────────
    console.log('📌 Creating admin...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@shopyos.com';
    const adminPassword = process.env.ADMIN_PASSWORD || PASSWORD;
    
    const adminId = await insertUser(db, {
      email: adminEmail,
      password: adminPassword,
      name: 'Shopyos Admin',
      phone: '+233201000001',
      city: 'Accra',
      lat: 5.6037,
      lng: -0.187,
    });
    await assignRole(db, adminId, roleMap.admin);
    console.log('   ✅ Admin created:', adminId, '\n');

    // ── 4. Buyers ─────────────────────────────────────────────────────────────
    console.log('📌 Creating buyers...');
    const kwameId = await insertUser(db, {
      email: 'kwame@test.com',
      name: 'Kwame Mensah',
      phone: '+233244000001',
      city: 'Accra',
      lat: 5.5502,
      lng: -0.2174,
    });
    await assignRole(db, kwameId, roleMap.buyer);

    const amaId = await insertUser(db, {
      email: 'ama@test.com',
      name: 'Ama Owusu',
      phone: '+233244000002',
      city: 'Kumasi',
      lat: 6.6885,
      lng: -1.6244,
    });
    await assignRole(db, amaId, roleMap.buyer);
    console.log('   ✅ Buyers created\n');

    // ── 5. Sellers ────────────────────────────────────────────────────────────
    console.log('📌 Creating sellers...');
    const kofiId = await insertUser(db, {
      email: 'kofi.sells@test.com',
      name: 'Kofi Asante',
      phone: '+233244000003',
      city: 'Accra',
      lat: 5.5916,
      lng: -0.1969,
    });
    await assignRole(db, kofiId, roleMap.seller);

    const abenaId = await insertUser(db, {
      email: 'abena.fashions@test.com',
      name: 'Abena Boateng',
      phone: '+233244000004',
      city: 'Kumasi',
      lat: 6.6935,
      lng: -1.6168,
    });
    await assignRole(db, abenaId, roleMap.seller);

    const yawId = await insertUser(db, {
      email: 'yaw.foods@test.com',
      name: 'Yaw Darko',
      phone: '+233244000005',
      city: 'Tema',
      lat: 5.6698,
      lng: -0.0166,
    });
    await assignRole(db, yawId, roleMap.seller);
    console.log('   ✅ Sellers created\n');

    // ── 6. Driver ─────────────────────────────────────────────────────────────
    console.log('📌 Creating driver...');
    const driverId = await insertUser(db, {
      email: 'driver@test.com',
      name: 'Emmanuel Tetteh',
      phone: '+233244000006',
      city: 'Accra',
      lat: 5.5717,
      lng: -0.2107,
    });
    await assignRole(db, driverId, roleMap.driver);
    await db.query(`
      INSERT INTO driver_profiles
        (user_id, vehicle_type, vehicle_make, vehicle_model, vehicle_year,
         license_plate, drivers_license_number, license_expiry_date,
         is_verified, is_available, average_rating)
      VALUES ($1, 'motorcycle', 'Honda', 'CB 125', 2021,
              'GR-4521-22', 'GH-DL-2019-00452', '2027-12-31',
              TRUE, TRUE, 4.7)
      ON CONFLICT (user_id) DO NOTHING
    `, [driverId]);
    console.log('   ✅ Driver created\n');

    // ── 7. Stores ─────────────────────────────────────────────────────────────
    console.log('📌 Creating stores...');
    const { rows: [store1] } = await db.query(`
      INSERT INTO stores
        (owner_id, store_name, slug, description, email, phone,
         address_line1, city, state_province, country, category,
         latitude, longitude, is_verified, is_active, average_rating, total_reviews,
         listing_tier, verification_status, delivery_base_fee, delivery_per_km_fee, delivery_max_km)
      VALUES ($1, 'TechHub Accra', 'techhub-accra',
              'Your one-stop shop for all things electronics — phones, laptops, accessories, and more.',
              'info@techhub.gh', '+233302000010',
              '15 Ring Road Central', 'Accra', 'Greater Accra', 'Ghana', 'Electronics',
              5.5916, -0.1969,
              TRUE, TRUE, 4.5, 32, 'free', 'verified', 5.00, 2.00, 50.00)
      ON CONFLICT (slug) DO UPDATE SET store_name = EXCLUDED.store_name
      RETURNING id
    `, [kofiId]);

    const { rows: [store2] } = await db.query(`
      INSERT INTO stores
        (owner_id, store_name, slug, description, email, phone,
         address_line1, city, state_province, country, category,
         latitude, longitude, is_verified, is_active, average_rating, total_reviews,
         listing_tier, verification_status, delivery_base_fee, delivery_per_km_fee, delivery_max_km)
      VALUES ($1, 'Abena Fashions', 'abena-fashions',
              'Trendy African prints, ready-to-wear, and bespoke fashion for every occasion.',
              'hello@abenafashions.gh', '+233322001010',
              '42 Adum Market', 'Kumasi', 'Ashanti', 'Ghana', 'Fashion',
              6.6935, -1.6168,
              TRUE, TRUE, 4.8, 58, 'free', 'verified', 10.00, 0.00, 100.00)
      ON CONFLICT (slug) DO UPDATE SET store_name = EXCLUDED.store_name
      RETURNING id
    `, [abenaId]);

    const { rows: [store3] } = await db.query(`
      INSERT INTO stores
        (owner_id, store_name, slug, description, email, phone,
         address_line1, city, state_province, country, category,
         latitude, longitude, is_verified, is_active, average_rating, total_reviews,
         listing_tier, verification_status, delivery_base_fee, delivery_per_km_fee, delivery_max_km)
      VALUES ($1, 'Yaw Fresh Groceries', 'yaw-fresh-groceries',
              'Farm-fresh produce, pantry essentials, and everyday groceries delivered to your door.',
              'yaw@yawfresh.gh', '+233244000005',
              '7 Tema Community 1', 'Tema', 'Greater Accra', 'Ghana', 'Grocery',
              5.6698, -0.0166,
              TRUE, TRUE, 4.6, 21, 'free', 'verified', 3.00, 1.50, 20.00)
      ON CONFLICT (slug) DO UPDATE SET store_name = EXCLUDED.store_name
      RETURNING id
    `, [yawId]);

    const storeIds = {
      tech: store1.id,
      fashion: store2.id,
      grocery: store3.id,
    };
    console.log('   ✅ Stores created\n');

    // ── 8. Products (TechHub) ─────────────────────────────────────────────────
    console.log('📌 Creating products...');

    const insertProduct = async (storeId, data) => {
      // Manual check for existing slug since DB doesn't have unique constraint
      const { rows: existing } = await db.query(
        `SELECT id FROM products WHERE slug = $1`,
        [data.slug]
      );

      let pId;
      if (existing.length > 0) {
        pId = existing[0].id;
        await db.query(`
          UPDATE products SET title = $2, price = $3, category = $4, brand = $5
          WHERE id = $1
        `, [pId, data.title, data.price, data.category, data.brand ?? null]);
      } else {
        const { rows: [p] } = await db.query(`
          INSERT INTO products
            (store_id, title, slug, description, price, compare_at_price, category, brand, is_active, average_rating, total_reviews)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10)
          RETURNING id
        `, [storeId, data.title, data.slug, data.desc, data.price, data.compareAt ?? null,
            data.category, data.brand ?? null, data.rating ?? 0, data.reviewCount ?? 0]);
        pId = p.id;
      }

      // Primary image
      await db.query(`
        INSERT INTO product_images (product_id, image_url, cloudinary_public_id, is_primary, display_order)
        VALUES ($1, $2, $3, TRUE, 0)
        ON CONFLICT DO NOTHING
      `, [pId, data.imageUrl, `seed_${pId}`]);

      // Inventory
      await db.query(`
        INSERT INTO inventory (product_id, quantity, low_stock_threshold)
        VALUES ($1, $2, 5)
        ON CONFLICT (product_id) DO NOTHING
      `, [pId, data.stock ?? 50]);

      return pId;
    };

    // TechHub products
    const phone1Id = await insertProduct(storeIds.tech, {
      title: 'Samsung Galaxy A54 5G', slug: 'samsung-galaxy-a54-5g',
      desc: '6.4" Super AMOLED display, 5000mAh battery, 128GB storage. Perfect for everyday use.',
      price: 2200, compareAt: 2499, category: 'Electronics', brand: 'Samsung',
      imageUrl: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400',
      rating: 4.6, reviewCount: 14, stock: 40,
    });

    const laptopId = await insertProduct(storeIds.tech, {
      title: 'HP ProBook 450 G9', slug: 'hp-probook-450-g9',
      desc: 'Intel Core i5, 8GB RAM, 256GB SSD, 15.6" FHD. Ideal for work and study.',
      price: 4800, compareAt: 5500, category: 'Electronics', brand: 'HP',
      imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400',
      rating: 4.4, reviewCount: 8, stock: 15,
    });

    const earbudsId = await insertProduct(storeIds.tech, {
      title: 'Sony WF-1000XM4 Earbuds', slug: 'sony-wf-1000xm4',
      desc: 'Industry-leading noise cancellation with dual noise sensor technology.',
      price: 850, category: 'Electronics', brand: 'Sony',
      imageUrl: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400',
      rating: 4.8, reviewCount: 22, stock: 25,
    });

    const chargerPadId = await insertProduct(storeIds.tech, {
      title: 'Anker Wireless Charging Pad 15W', slug: 'anker-wireless-charger-15w',
      desc: 'Fast wireless charging for all Qi-enabled devices. Slim and compact design.',
      price: 120, category: 'Electronics', brand: 'Anker',
      imageUrl: 'https://images.unsplash.com/photo-1591370874773-6702e8f12fd8?w=400',
      rating: 4.3, reviewCount: 31, stock: 80,
    });

    // Abena Fashions products
    const kente1Id = await insertProduct(storeIds.fashion, {
      title: 'Kente Print Wrap Dress', slug: 'kente-wrap-dress',
      desc: 'Vibrant handwoven kente fabric in a flattering wrap silhouette. One size fits most.',
      price: 280, category: 'Fashion',
      imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400',
      rating: 4.9, reviewCount: 17, stock: 30,
    });

    const agbada1Id = await insertProduct(storeIds.fashion, {
      title: 'Men\'s Ankara Agbada Set', slug: 'mens-ankara-agbada',
      desc: 'Three-piece traditional agbada in bold ankara print. Perfect for special occasions.',
      price: 380, category: 'Fashion',
      imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      rating: 4.7, reviewCount: 9, stock: 20,
    });

    const sneakersId = await insertProduct(storeIds.fashion, {
      title: 'Canvas Slip-On Sneakers', slug: 'canvas-slip-on-sneakers',
      desc: 'Comfortable, breathable canvas upper with cushioned insole. Sizes 36–45.',
      price: 95, compareAt: 130, category: 'Fashion',
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
      rating: 4.2, reviewCount: 43, stock: 60,
    });

    // Yaw Fresh products
    const tomatoId = await insertProduct(storeIds.grocery, {
      title: 'Fresh Tomatoes (1 crate)', slug: 'fresh-tomatoes-crate',
      desc: 'Locally sourced, farm-fresh tomatoes. Ideal for soups and stews.',
      price: 65, category: 'Grocery',
      imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400',
      rating: 4.5, reviewCount: 12, stock: 100,
    });

    const riceId = await insertProduct(storeIds.grocery, {
      title: 'Ghana Jasmine Rice (25kg)', slug: 'ghana-jasmine-rice-25kg',
      desc: 'Premium long-grain jasmine rice. Fragrant and fluffy every time.',
      price: 320, category: 'Grocery',
      imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400',
      rating: 4.7, reviewCount: 28, stock: 70,
    });

    const palmoilId = await insertProduct(storeIds.grocery, {
      title: 'Pure Red Palm Oil (5L)', slug: 'pure-red-palm-oil-5l',
      desc: 'Unrefined, cold-pressed red palm oil. Rich in natural vitamin E.',
      price: 85, category: 'Grocery',
      imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400',
      rating: 4.6, reviewCount: 19, stock: 90,
    });

    console.log('   ✅ Products created\n');

    // ── 9. Orders ─────────────────────────────────────────────────────────────
    console.log('📌 Creating sample orders...');

    const { rows: [order1] } = await db.query(`
      INSERT INTO orders
        (order_number, buyer_id, store_id, status,
         subtotal, tax, delivery_fee, total_amount, currency,
         delivery_address_line1, delivery_city, delivery_country,
         delivery_latitude, delivery_longitude,
         paid_at, confirmed_at, escrow_status)
      VALUES ('SH-0001', $1, $2, 'completed',
              2200.00, 0, 15.00, 2215.00, 'GHS',
              '24 Labadi Road', 'Accra', 'Ghana',
              5.5502, -0.2174,
              NOW() - INTERVAL '5 days',
              NOW() - INTERVAL '5 days',
              'RELEASED')
      ON CONFLICT (order_number) DO UPDATE SET status = EXCLUDED.status
      RETURNING id
    `, [kwameId, storeIds.tech]);

    await db.query(`
      INSERT INTO order_items (order_id, product_id, product_title, quantity, price, subtotal)
      VALUES ($1, $2, 'Samsung Galaxy A54 5G', 1, 2200.00, 2200.00)
    `, [order1.id, phone1Id]);

    const { rows: [order2] } = await db.query(`
      INSERT INTO orders
        (order_number, buyer_id, store_id, status,
         subtotal, tax, delivery_fee, total_amount, currency,
         delivery_address_line1, delivery_city, delivery_country,
         delivery_latitude, delivery_longitude,
         paid_at, escrow_status)
      VALUES ('SH-0002', $1, $2, 'paid',
              280.00, 0, 10.00, 290.00, 'GHS',
              '7 Ahensan Estate', 'Kumasi', 'Ghana',
              6.6885, -1.6244,
              NOW() - INTERVAL '1 day',
              'HELD')
      ON CONFLICT (order_number) DO UPDATE SET status = EXCLUDED.status
      RETURNING id
    `, [amaId, storeIds.fashion]);

    await db.query(`
      INSERT INTO order_items (order_id, product_id, product_title, quantity, price, subtotal)
      VALUES ($1, $2, 'Kente Print Wrap Dress', 1, 280.00, 280.00)
    `, [order2.id, kente1Id]);

    const { rows: [order3] } = await db.query(`
      INSERT INTO orders
        (order_number, buyer_id, store_id, status,
         subtotal, tax, delivery_fee, total_amount, currency,
         delivery_address_line1, delivery_city, delivery_country,
         delivery_latitude, delivery_longitude)
      VALUES ('SH-0003', $1, $2, 'pending',
              405.00, 0, 12.00, 417.00, 'GHS',
              '24 Labadi Road', 'Accra', 'Ghana',
              5.5502, -0.2174)
      ON CONFLICT (order_number) DO UPDATE SET status = EXCLUDED.status
      RETURNING id
    `, [kwameId, storeIds.grocery]);

    await db.query(`
      INSERT INTO order_items (order_id, product_id, product_title, quantity, price, subtotal)
      VALUES
        ($1, $2, 'Ghana Jasmine Rice (25kg)', 1, 320.00, 320.00),
        ($1, $3, 'Pure Red Palm Oil (5L)', 1, 85.00, 85.00)
    `, [order3.id, riceId, palmoilId]);

    console.log('   ✅ Orders created\n');

    // ── 10. Deliveries ────────────────────────────────────────────────────────
    console.log('📌 Creating deliveries...');
    await db.query(`
      INSERT INTO deliveries
        (order_id, driver_id, status,
         pickup_address, pickup_latitude, pickup_longitude,
         delivery_address, delivery_latitude, delivery_longitude,
         distance_km, delivery_fee, driver_earnings,
         assigned_at, picked_up_at, delivered_at)
      VALUES ($1, $2, 'delivered',
              '15 Ring Road Central, Accra', 5.5916, -0.1969,
              '24 Labadi Road, Accra', 5.5502, -0.2174,
              5.2, 15.00, 10.00,
              NOW() - INTERVAL '5 days',
              NOW() - INTERVAL '5 days' + INTERVAL '30 minutes',
              NOW() - INTERVAL '5 days' + INTERVAL '1 hour')
      ON CONFLICT (order_id) DO NOTHING
    `, [order1.id, driverId]);
    console.log('   ✅ Deliveries created\n');

    // ── 11. Reviews ───────────────────────────────────────────────────────────
    console.log('📌 Creating reviews...');
    await db.query(`
      INSERT INTO product_reviews
        (product_id, order_id, buyer_id, rating, review_text, is_verified_purchase)
      VALUES ($1, $2, $3, 5,
              'Amazing phone! Fast delivery and exactly as described. Very happy with my purchase.',
              TRUE)
      ON CONFLICT DO NOTHING
    `, [phone1Id, order1.id, kwameId]);

    await db.query(`
      INSERT INTO store_reviews
        (store_id, order_id, buyer_id, rating, review_text)
      VALUES ($1, $2, $3, 5,
              'TechHub is the best! Great prices, fast shipping, and excellent customer service.')
      ON CONFLICT DO NOTHING
    `, [storeIds.tech, order1.id, kwameId]);
    console.log('   ✅ Reviews created\n');

    // ── 12. Conversations & Messages ──────────────────────────────────────────
    console.log('📌 Creating conversations...');
    // Manual check for conversation by order_id
    let conv1Id;
    const { rows: existingConv } = await db.query(
      `SELECT id FROM conversations WHERE order_id = $1`,
      [order1.id]
    );

    if (existingConv.length > 0) {
      conv1Id = existingConv[0].id;
    } else {
      const { rows: [conv1] } = await db.query(`
        INSERT INTO conversations (participant1_id, participant2_id, order_id)
        VALUES ($1, $2, $3) RETURNING id
      `, [kwameId, kofiId, order1.id]);
      conv1Id = conv1.id;

      await db.query(`
        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES ($1, $2), ($1, $3)
        ON CONFLICT DO NOTHING
      `, [conv1Id, kwameId, kofiId]);
    }

    const msgs = [
      [conv1Id, kwameId, 'Hello! I just ordered the Samsung A54. When will it be ready?'],
      [conv1Id, kofiId, 'Hi Kwame! Your order is confirmed and will be dispatched within 2 hours.'],
      [conv1Id, kwameId, 'Perfect, thank you! Will I get a tracking update?'],
      [conv1Id, kofiId, 'Yes, you\'ll receive a notification once the driver picks it up. 🚀'],
    ];
    for (const [convId, senderId, content] of msgs) {
      await db.query(
        `INSERT INTO messages (conversation_id, sender_id, content, is_read)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT DO NOTHING`,
        [convId, senderId, content]
      );
    }
    console.log('   ✅ Conversations & messages created\n');

    // ── 13. Notifications ─────────────────────────────────────────────────────
    console.log('📌 Creating notifications...');
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, is_read)
      VALUES
        ($1, 'order_confirmed', 'Order Confirmed ✅', 'Your order #SH-0001 has been confirmed by TechHub Accra.', TRUE),
        ($1, 'order_delivered', 'Order Delivered 🎉', 'Your Samsung Galaxy A54 has been delivered. Enjoy!', TRUE),
        ($1, 'order_confirmed', 'Order Received', 'Yaw Fresh Groceries received your order #SH-0003.', FALSE)
      ON CONFLICT DO NOTHING
    `, [kwameId]);

    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, is_read)
      VALUES
        ($1, 'new_order', 'New Order! 🛍️', 'You have a new order #SH-0002 for Kente Print Wrap Dress.', FALSE)
      ON CONFLICT DO NOTHING
    `, [abenaId]);
    console.log('   ✅ Notifications created\n');

    // ── 14. Favorites ─────────────────────────────────────────────────────────
    console.log('📌 Creating favorites...');
    await db.query(`
      INSERT INTO favorites (user_id, product_id)
      VALUES ($1, $2), ($1, $3), ($1, $4)
      ON CONFLICT DO NOTHING
    `, [kwameId, laptopId, earbudsId, kente1Id]);
    console.log('   ✅ Favorites created\n');

    // ── 15. Referral codes ────────────────────────────────────────────────────
    console.log('📌 Creating referral codes...');
    await db.query(`UPDATE user_profiles SET referral_code = 'KWAME2026' WHERE user_id = $1`, [kwameId]);
    await db.query(`UPDATE user_profiles SET referral_code = 'AMA2026' WHERE user_id = $1`, [amaId]);
    await db.query(`UPDATE user_profiles SET referral_code = 'KOFI2026' WHERE user_id = $1`, [kofiId]);
    console.log('   ✅ Referral codes created\n');

    // ── 16. Quick Snaps ───────────────────────────────────────────────────────
    console.log('📌 Creating quick snaps...');
    await db.query(`
      INSERT INTO snaps (store_id, product_id, media_url, caption, expires_at)
      VALUES 
        ($1, $2, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8', 'MacBook Air M2 back in stock!', NOW() + INTERVAL '23 hours'),
        ($3, $4, 'https://images.unsplash.com/photo-1588359410707-1601736b4904', 'Kente Dress limited edition', NOW() + INTERVAL '22 hours'),
        ($5, NULL, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836', 'Fresh fruits just arrived 🍎', NOW() + INTERVAL '24 hours')
      ON CONFLICT DO NOTHING
    `, [storeIds.tech, laptopId, storeIds.fashion, kente1Id, storeIds.grocery]);
    console.log('   ✅ Quick snaps created\n');

    // ── 17. User Events (Recommendations) ─────────────────────────────────────
    console.log('📌 Creating user events...');
    await db.query(`
      INSERT INTO user_events (user_id, product_id, event_type, weight)
      VALUES 
        ($1, $2, 'purchase', 5),
        ($1, $3, 'view', 1),
        ($4, $2, 'add_to_cart', 3),
        ($4, $5, 'view', 1)
      ON CONFLICT DO NOTHING
    `, [kwameId, laptopId, earbudsId, amaId, phone1Id]);
    console.log('   ✅ User events created\n');

    // ── 18. Banner Campaigns ──────────────────────────────────────────────────
    console.log('📌 Creating banner campaigns...');
    await db.query(`
      INSERT INTO banner_campaigns (store_id, title, placement, duration_days, paid_amount, status, banner_url, start_date, end_date)
      VALUES 
        ($1, 'Back to School Sale', 'home_hero', 7, 150.00, 'Active', 'https://images.unsplash.com/photo-1509062522246-3755977927d7', NOW(), NOW() + INTERVAL '7 days'),
        ($2, 'Kente Collection 2026', 'category_sidebar', 14, 250.00, 'Active', 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b', NOW(), NOW() + INTERVAL '14 days')
      ON CONFLICT DO NOTHING
    `, [storeIds.tech, storeIds.fashion]);
    console.log('   ✅ Banner campaigns created\n');

    // ── 19. User Reports & Blocks ─────────────────────────────────────────────
    console.log('📌 Creating reports and blocks...');
    await db.query(`
      INSERT INTO user_blocks (blocker_id, blocked_id)
      VALUES ($1, $2) ON CONFLICT DO NOTHING
    `, [kwameId, driverId]);

    await db.query(`
      INSERT INTO user_reports (reporter_id, reported_user_id, entity_type, reason, details, status)
      VALUES 
        ($1, $2, 'user', 'Harassment', 'The driver was rude during delivery', 'pending')
      ON CONFLICT DO NOTHING
    `, [kwameId, driverId]);
    console.log('   ✅ Reports and blocks created\n');

    await db.query('COMMIT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅  Seed complete! Test accounts:');
    console.log('');
    console.log('   Role     Email                      Password');
    console.log('   ──────   ──────────────────────     ─────────────');
    console.log(`   Admin    ${adminEmail.padEnd(26)} ${adminPassword}`);
    console.log('   Buyer    kwame@test.com              Password123!');
    console.log('   Buyer    ama@test.com                Password123!');
    console.log('   Seller   kofi.sells@test.com         Password123!');
    console.log('   Seller   abena.fashions@test.com     Password123!');
    console.log('   Seller   yaw.foods@test.com          Password123!');
    console.log('   Driver   driver@test.com             Password123!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (err) {
    await db.query('ROLLBACK');
    console.error('\n❌ Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    db.release();
    process.exit(0);
  }
}

seed();
