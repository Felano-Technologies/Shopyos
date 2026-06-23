/**
 * Shopyos Database Seeder
 * Run: node scripts/seed.js
 *
 * Test accounts (password for all: Password123!)
 *  admin@shopyos.com      â€” Admin
 *  kwame@test.com         â€” Buyer
 *  ama@test.com           â€” Buyer
 *  kofi.sells@test.com    â€” Seller (TechHub Accra)
 *  abena.fashions@test.comâ€” Seller (Abena Fashions)
 *  yaw.foods@test.com     â€” Seller (Yaw's Fresh Groceries)
 *  driver@test.com        â€” Driver
 *  hub@test.com           â€” Parcel Partner
 */

// Load root docker .env first (has POSTGRES_USER/PASSWORD/DB), then backend .env
// This lets the seed run from the host against the Docker Postgres on localhost.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });       // root .env (docker vars)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // backend .env (fills unset vars)

// When running from the host machine, the Docker DB is on localhost:5432.
// Inside Docker, DATABASE_URL would use "db" as host â€” but we're running locally.
// Build the correct host-side DATABASE_URL if it still points to Supabase or a remote host.
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('supabase') || process.env.DATABASE_URL.includes('.co')) {
  const {
    POSTGRES_USER = 'postgres',
    POSTGRES_PASSWORD = 'postgres',
    POSTGRES_DB = 'shopyos',
    DB_PORT = '5432',
  } = process.env;
  process.env.DATABASE_URL = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${DB_PORT}/${POSTGRES_DB}`;
  console.log('â„¹ï¸  DATABASE_URL overridden to local Docker Postgres:', process.env.DATABASE_URL);
}


// â”€â”€â”€ PRODUCTION GUARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// This script MUST NEVER run against a production database.
// It is blocked by three independent checks:
//   1. NODE_ENV must not be 'production'
//   2. DATABASE_URL must not point to a Sevalla/production host
//   3. The explicit ALLOW_SEED flag must be set to 'true'
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const NODE_ENV = (process.env.NODE_ENV || '').toLowerCase();
const DB_URL   = (process.env.DATABASE_URL || '').toLowerCase();
const ALLOW    = (process.env.ALLOW_SEED   || '').toLowerCase();

// Check 1 â€” NODE_ENV
if (NODE_ENV === 'production') {
  console.error('âŒ  BLOCKED: Seed script cannot run when NODE_ENV=production.');
  process.exit(1);
}

// Check 2 â€” Database URL must not point to a production/Sevalla host
const PROD_DB_PATTERNS = ['sevalla', '.sevalla.com', 'render.com', 'railway.app', 'heroku', 'neon.tech', 'supabase.co'];
if (PROD_DB_PATTERNS.some(p => DB_URL.includes(p))) {
  console.error('âŒ  BLOCKED: DATABASE_URL appears to point to a production database.');
  console.error('   If this is genuinely a dev DB on that host, set ALLOW_SEED=true explicitly.');
  process.exit(1);
}

// Check 3 â€” Explicit opt-in flag (prevents accidental runs)
if (ALLOW !== 'true') {
  console.error('âŒ  BLOCKED: ALLOW_SEED env var is not set to "true".');
  console.error('   To run the seeder locally, set ALLOW_SEED=true in your .env file.');
  process.exit(1);
}

console.log('âœ…  Environment checks passed. Running seed on:', DB_URL.split('@')[1] || DB_URL);
console.log('âš ï¸  NODE_ENV:', NODE_ENV || '(not set)');
console.log('');

const bcrypt = require('bcryptjs');
const { getPool } = require('../config/postgres');

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PASSWORD = 'Password123!'; // NOSONAR
const SUPPORT_USER_ID = '00000000-0000-0000-0000-000000000001';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function seed() {
  const pool = getPool();
  const db = await pool.connect();
  console.log('ðŸŒ± Starting seed...\n');

  try {
    await db.query('BEGIN');

    // â”€â”€ 1. Roles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Upserting roles...');
    await db.query(`
      INSERT INTO roles (name, display_name, description) VALUES
        ('buyer',          'Buyer',          'Can browse and purchase products'),
        ('seller',         'Seller',         'Can list and sell products'),
        ('driver',         'Driver',         'Can deliver orders'),
        ('admin',          'Admin',          'Full platform access'),
        ('parcel_partner', 'Parcel Partner', 'Can manage inter-regional parcels at hubs')
      ON CONFLICT (name) DO NOTHING
    `);
    const { rows: roleRows } = await db.query('SELECT id, name FROM roles');
    const roleMap = Object.fromEntries(roleRows.map(r => [r.name, r.id]));
    console.log('   âœ… Roles ready\n');

    // â”€â”€ 2. Support system user (Shopyos Bot) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating Shopyos Bot...');
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
    console.log('   âœ… Shopyos Bot ready\n');

    // â”€â”€ 3. Admin user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating admin...');
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
    console.log('   âœ… Admin created:', adminId, '\n');

    // â”€â”€ 4. Buyers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating buyers...');
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
    console.log('   âœ… Buyers created\n');

    // â”€â”€ 5. Sellers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating sellers...');
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
    console.log('   âœ… Sellers created\n');

    // â”€â”€ 6. Driver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating driver...');
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
    console.log('   âœ… Driver created\n');

    // â”€â”€ 6b. Parcel Partner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ”Œ Creating parcel partner...');
    const hubUserId = await insertUser(db, {
      email: 'hub@test.com',
      name: 'Kwabena Agyei',
      phone: '+233244000007',
      city: 'Accra',
      lat: 5.6037,
      lng: -0.187,
    });
    await assignRole(db, hubUserId, roleMap.parcel_partner);
    console.log('   âœ… Parcel partner created\n');

    // â”€â”€ 7. Stores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ”Œ Creating stores...');
    const { rows: [store1] } = await db.query(`
      INSERT INTO stores
        (owner_id, store_name, slug, description, email, phone,
         address_line1, city, state_province, country, category,
         latitude, longitude, is_verified, is_active, average_rating, total_reviews,
         listing_tier, verification_status, delivery_base_fee, delivery_per_km_fee, delivery_max_km)
      VALUES ($1, 'TechHub Accra', 'techhub-accra',
              'Your one-stop shop for all things electronics â€” phones, laptops, accessories, and more.',
              'info@techhub.gh', '+233302000010',
              '15 Ring Road Central', 'Accra', 'Greater Accra', 'Ghana', 'Electronics',
              5.5916, -0.1969,
              TRUE, TRUE, 4.5, 32, 'free', 'verified', 5, 2, 50)
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
              TRUE, TRUE, 4.8, 58, 'free', 'verified', 10, 0, 100)
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
              TRUE, TRUE, 4.6, 21, 'free', 'verified', 3, 1.5, 20)
      ON CONFLICT (slug) DO UPDATE SET store_name = EXCLUDED.store_name
      RETURNING id
    `, [yawId]);

    const storeIds = {
      tech: store1.id,
      fashion: store2.id,
      grocery: store3.id,
    };
    console.log('   âœ… Stores created\n');

    // â”€â”€ 8. Products (TechHub) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating products...');

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

    await insertProduct(storeIds.tech, {
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

    await insertProduct(storeIds.fashion, {
      title: 'Men\'s Ankara Agbada Set', slug: 'mens-ankara-agbada',
      desc: 'Three-piece traditional agbada in bold ankara print. Perfect for special occasions.',
      price: 380, category: 'Fashion',
      imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      rating: 4.7, reviewCount: 9, stock: 20,
    });

    await insertProduct(storeIds.fashion, {
      title: 'Canvas Slip-On Sneakers', slug: 'canvas-slip-on-sneakers',
      desc: 'Comfortable, breathable canvas upper with cushioned insole. Sizes 36â€“45.',
      price: 95, compareAt: 130, category: 'Fashion',
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
      rating: 4.2, reviewCount: 43, stock: 60,
    });

    // Yaw Fresh products
    await insertProduct(storeIds.grocery, {
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

    console.log('   âœ… Products created\n');

    // â”€â”€ 8B. Additional Sellers & Buyers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating additional sellers & buyers...');
    const seller4Id = await insertUser(db, { email: 'accratech@test.com', name: 'Fiifi Mensah', phone: '+233244000010', city: 'Accra', lat: 5.6037, lng: -0.187 });
    await assignRole(db, seller4Id, roleMap.seller);
    const seller5Id = await insertUser(db, { email: 'kumasifashion@test.com', name: 'Akosua Amponsah', phone: '+233244000011', city: 'Kumasi', lat: 6.6885, lng: -1.6244 });
    await assignRole(db, seller5Id, roleMap.seller);
    const seller6Id = await insertUser(db, { email: 'freshharvestgh@test.com', name: 'Kofi Acheampong', phone: '+233244000012', city: 'Kumasi', lat: 6.7, lng: -1.62 });
    await assignRole(db, seller6Id, roleMap.seller);
    const seller7Id = await insertUser(db, { email: 'glowbeautygh@test.com', name: 'Efua Asante', phone: '+233244000013', city: 'Accra', lat: 5.56, lng: -0.2 });
    await assignRole(db, seller7Id, roleMap.seller);
    const seller8Id = await insertUser(db, { email: 'fitnesszonegh@test.com', name: 'Kwesi Boateng', phone: '+233244000014', city: 'Accra', lat: 5.58, lng: -0.22 });
    await assignRole(db, seller8Id, roleMap.seller);
    const seller9Id = await insertUser(db, { email: 'homestylegh@test.com', name: 'Adjoa Mensah', phone: '+233244000015', city: 'Tema', lat: 5.67, lng: -0.01 });
    await assignRole(db, seller9Id, roleMap.seller);
    const seller10Id = await insertUser(db, { email: 'littlestarsgh@test.com', name: 'Nana Osei', phone: '+233244000016', city: 'Accra', lat: 5.61, lng: -0.19 });
    await assignRole(db, seller10Id, roleMap.seller);
    const seller11Id = await insertUser(db, { email: 'autopartsgh@test.com', name: 'Yaw Asante', phone: '+233244000017', city: 'Accra', lat: 5.55, lng: -0.21 });
    await assignRole(db, seller11Id, roleMap.seller);

    const buyer3Id = await insertUser(db, { email: 'abena.buyer@test.com', name: 'Abena Forson', phone: '+233244000018', city: 'Accra', lat: 5.59, lng: -0.2 });
    await assignRole(db, buyer3Id, roleMap.buyer);
    const buyer4Id = await insertUser(db, { email: 'kofi.buyer@test.com', name: 'Kofi Mensah', phone: '+233244000019', city: 'Kumasi', lat: 6.7, lng: -1.63 });
    await assignRole(db, buyer4Id, roleMap.buyer);
    console.log('   âœ… Additional sellers & buyers created\n');

    // â”€â”€ 8C. Additional Stores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating additional stores...');
    const insertStore = async (ownerId, d) => {
      const { rows: [s] } = await db.query(`
        INSERT INTO stores
          (owner_id, store_name, slug, description, email, phone,
           address_line1, city, state_province, country, category,
           latitude, longitude, is_verified, is_active, average_rating, total_reviews,
           listing_tier, verification_status, delivery_base_fee, delivery_per_km_fee, delivery_max_km)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Ghana',$10,$11,$12,TRUE,TRUE,$13,$14,'free','verified',$15,$16,$17)
        ON CONFLICT (slug) DO UPDATE SET store_name = EXCLUDED.store_name
        RETURNING id
      `, [ownerId, d.name, d.slug, d.desc, d.email, d.phone, d.address, d.city, d.state,
          d.category, d.lat, d.lng, d.rating, d.reviews, d.baseFee, d.perKm, d.maxKm]);
      return s.id;
    };

    const accraTechId   = await insertStore(seller4Id,  { name: 'Accra Tech Mall',       slug: 'accra-tech-mall',       desc: 'Premier destination for gadgets, laptops, phones and smart home devices.',         email: 'info@accratechmall.gh',    phone: '+233302000020', address: '5 Cantonments Road',    city: 'Accra',  state: 'Greater Accra', category: 'Electronics',      lat: 5.6037, lng: -0.187,  rating: 4.6, reviews: 87,  baseFee: 8,  perKm: 2.5, maxKm: 40 });
    const kumasiFashId  = await insertStore(seller5Id,  { name: 'Kumasi Fashion House',   slug: 'kumasi-fashion-house',  desc: 'Authentic African prints, bespoke tailoring and modern styles.',                    email: 'info@kumasifashion.gh',    phone: '+233322002020', address: '18 Kejetia Market',     city: 'Kumasi', state: 'Ashanti',       category: 'Fashion',          lat: 6.6885, lng: -1.6244, rating: 4.7, reviews: 124, baseFee: 10, perKm: 0, maxKm: 80 });
    const freshHarvId   = await insertStore(seller6Id,  { name: 'Fresh Harvest Kumasi',   slug: 'fresh-harvest-kumasi',  desc: 'Farm-to-table groceries, organic produce and traditional Ghanaian staples.',        email: 'hello@freshharvestgh.gh',  phone: '+233322003030', address: '3 Bantama Market',      city: 'Kumasi', state: 'Ashanti',       category: 'Grocery',          lat: 6.7,   lng: -1.62,   rating: 4.5, reviews: 66,  baseFee: 5,  perKm: 1.5, maxKm: 25 });
    const glowBeautyId  = await insertStore(seller7Id,  { name: 'Glow Beauty Ghana',      slug: 'glow-beauty-ghana',     desc: 'Natural and organic beauty products rooted in African heritage.',                   email: 'info@glowbeauty.gh',       phone: '+233302004040', address: '22 Osu Oxford Street',  city: 'Accra',  state: 'Greater Accra', category: 'Health & Beauty',  lat: 5.56,   lng: -0.2,   rating: 4.8, reviews: 201, baseFee: 6,  perKm: 2, maxKm: 35 });
    const fitnessZoneId = await insertStore(seller8Id,  { name: 'Fitness Zone Accra',     slug: 'fitness-zone-accra',    desc: 'Sports equipment, supplements and activewear for every fitness level.',              email: 'info@fitnesszone.gh',      phone: '+233302005050', address: '9 Liberation Road',     city: 'Accra',  state: 'Greater Accra', category: 'Sports & Fitness', lat: 5.58,   lng: -0.22,   rating: 4.4, reviews: 53,  baseFee: 7,  perKm: 2, maxKm: 40 });
    const homeStyleId   = await insertStore(seller9Id,  { name: 'HomeStyle Accra',        slug: 'homestyle-accra',       desc: 'Quality home furnishings, kitchenware and dÃ©cor to make your house a home.',       email: 'info@homestyleaccra.gh',   phone: '+233302006060', address: '12 Spintex Road',       city: 'Accra',  state: 'Greater Accra', category: 'Home & Garden',    lat: 5.67,   lng: -0.01,   rating: 4.5, reviews: 78,  baseFee: 9,  perKm: 2.5, maxKm: 45 });
    const littleStarsId = await insertStore(seller10Id, { name: 'Little Stars Kids',      slug: 'little-stars-kids',     desc: 'Safe, fun and educational toys, clothing and gear for babies and children.',        email: 'hello@littlestars.gh',     phone: '+233302007070', address: '8 East Legon Avenue',   city: 'Accra',  state: 'Greater Accra', category: 'Baby & Kids',      lat: 5.61,   lng: -0.19,   rating: 4.9, reviews: 145, baseFee: 6,  perKm: 2, maxKm: 35 });
    const autoPartsId   = await insertStore(seller11Id, { name: 'AutoParts Ghana',        slug: 'autoparts-ghana',       desc: 'Genuine spare parts, accessories and care products for all vehicle brands.',       email: 'info@autopartsgh.gh',      phone: '+233302008080', address: '31 Graphic Road',       city: 'Accra',  state: 'Greater Accra', category: 'Automotive',       lat: 5.55,   lng: -0.21,   rating: 4.3, reviews: 42,  baseFee: 10, perKm: 3, maxKm: 50 });
    console.log('   âœ… Additional stores created (8 new)\n');

    // â”€â”€ 8D. Bulk Products (~85 items across 8 new stores) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Seeding bulk products...');
    const bulkProducts = [
      // Accra Tech Mall (12)
      { store: accraTechId,   title: 'Apple MacBook Air M2 13"',           slug: 'apple-macbook-air-m2-13',        desc: '8-core CPU, 8GB RAM, 256GB SSD. Thin, light, fanless.',                            price: 8500, compareAt: 9200, category: 'Electronics', brand: 'Apple',      imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400', rating: 4.9, reviewCount: 42, stock: 12 },
      { store: accraTechId,   title: 'iPhone 15 Pro 128GB',                slug: 'iphone-15-pro-128gb',            desc: 'Titanium design, A17 Pro chip, 48MP ProCamera system.',                            price: 9800, compareAt:10500, category: 'Electronics', brand: 'Apple',      imageUrl: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=400', rating: 4.8, reviewCount: 29, stock: 20 },
      { store: accraTechId,   title: 'Samsung 55" QLED 4K TV',             slug: 'samsung-55-qled-4k-tv',          desc: 'Quantum Dot technology, Smart TV with Netflix & YouTube.',                          price: 5200,                  category: 'Electronics', brand: 'Samsung',    imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400', rating: 4.6, reviewCount: 18, stock:  8 },
      { store: accraTechId,   title: 'Canon EOS R50 Mirrorless Camera',    slug: 'canon-eos-r50-mirrorless',       desc: '24.2MP APS-C sensor, 4K video, ideal for content creators.',                       price: 4100,                  category: 'Electronics', brand: 'Canon',      imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400', rating: 4.7, reviewCount: 11, stock:  6 },
      { store: accraTechId,   title: 'Apple Watch Series 9 45mm',          slug: 'apple-watch-series-9-45mm',      desc: 'Blood oxygen, ECG, crash detection, always-on display.',                           price: 2800,                  category: 'Electronics', brand: 'Apple',      imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', rating: 4.7, reviewCount: 35, stock: 25 },
      { store: accraTechId,   title: 'iPad Air 5th Gen 64GB',              slug: 'ipad-air-5th-gen-64gb',          desc: 'M1 chip, 10.9" Liquid Retina display, 5G capable.',                                price: 3600,                  category: 'Electronics', brand: 'Apple',      imageUrl: 'https://images.unsplash.com/photo-1544244015-0df4cec50d83?w=400', rating: 4.8, reviewCount: 23, stock: 18 },
      { store: accraTechId,   title: 'Logitech MX Keys Keyboard',          slug: 'logitech-mx-keys-keyboard',      desc: 'Premium wireless keyboard with backlit keys and multi-device pairing.',              price:  320,                  category: 'Electronics', brand: 'Logitech',   imageUrl: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=400', rating: 4.6, reviewCount: 47, stock: 35 },
      { store: accraTechId,   title: 'Dell UltraSharp 27" 4K Monitor',     slug: 'dell-ultrasharp-27-4k',          desc: 'IPS panel, USB-C 90W PD, factory-calibrated colour accuracy.',                     price: 2200,                  category: 'Electronics', brand: 'Dell',       imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400', rating: 4.7, reviewCount: 16, stock: 10 },
      { store: accraTechId,   title: 'JBL Charge 5 Bluetooth Speaker',     slug: 'jbl-charge-5-speaker',           desc: 'IP67 waterproof, 20h battery, built-in power bank.',                               price:  680, compareAt:  750, category: 'Electronics', brand: 'JBL',        imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400', rating: 4.5, reviewCount: 38, stock: 30 },
      { store: accraTechId,   title: 'Samsung Galaxy S24 256GB',           slug: 'samsung-galaxy-s24-256gb',       desc: 'Snapdragon 8 Gen 3, 50MP triple camera, 7 years of Android updates.',               price: 6200,                  category: 'Electronics', brand: 'Samsung',    imageUrl: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400', rating: 4.7, reviewCount: 21, stock: 15 },
      { store: accraTechId,   title: 'Xiaomi Redmi Note 13 Pro',           slug: 'xiaomi-redmi-note-13-pro',       desc: '200MP camera, 5000mAh battery, 120Hz AMOLED display.',                             price: 1800,                  category: 'Electronics', brand: 'Xiaomi',     imageUrl: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400', rating: 4.4, reviewCount: 19, stock: 28 },
      { store: accraTechId,   title: 'TP-Link AX3000 Wi-Fi 6 Router',      slug: 'tplink-ax3000-wifi6',            desc: 'Dual-band, OFDMA, covers up to 250mÂ². Fast and reliable home Wi-Fi.',              price:  480,                  category: 'Electronics', brand: 'TP-Link',    imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400', rating: 4.3, reviewCount: 28, stock: 20 },

      // Kumasi Fashion House (12)
      { store: kumasiFashId,  title: 'Batik Summer Wrap Dress',            slug: 'batik-summer-wrap-dress',        desc: 'Flowing batik-print in bold tropical colours. Sizes 8â€“16.',                        price:  195,                  category: 'Fashion',                          imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400', rating: 4.8, reviewCount: 31, stock: 40 },
      { store: kumasiFashId,  title: 'African Print Blazer',               slug: 'african-print-blazer',           desc: 'Tailored blazer in vivid Ankara print. Sizes XSâ€“3XL.',                             price:  340, compareAt:  420, category: 'Fashion',                          imageUrl: 'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?w=400', rating: 4.6, reviewCount: 14, stock: 25 },
      { store: kumasiFashId,  title: 'Kente Silk Scarf',                   slug: 'kente-silk-scarf',               desc: 'Pure silk scarf featuring traditional kente woven patterns. 180Ã—90cm.',            price:  120,                  category: 'Fashion',                          imageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400', rating: 4.9, reviewCount: 22, stock: 50 },
      { store: kumasiFashId,  title: 'Wide-Leg Linen Trousers',            slug: 'wide-leg-linen-trousers',        desc: 'Breathable linen trousers in earthy tones. Perfect for Accra heat.',                price:  145,                  category: 'Fashion',                          imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400', rating: 4.5, reviewCount: 27, stock: 35 },
      { store: kumasiFashId,  title: 'Distressed Denim Jacket',            slug: 'distressed-denim-jacket',        desc: 'Modern denim jacket with Ankara patch pockets. Unisex sizing.',                    price:  280, compareAt:  350, category: 'Fashion',                          imageUrl: 'https://images.unsplash.com/photo-1548126032-079a0fb0099d?w=400', rating: 4.4, reviewCount: 18, stock: 22 },
      { store: kumasiFashId,  title: 'Adinkra Symbol Graphic Tee',         slug: 'adinkra-graphic-tee',            desc: '100% organic cotton tee printed with Adinkra symbols and meanings.',                price:   75,                  category: 'Fashion',                          imageUrl: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400', rating: 4.7, reviewCount: 64, stock:100 },
      { store: kumasiFashId,  title: 'Handmade Beaded Necklace Set',       slug: 'handmade-beaded-necklace-set',   desc: 'Set of 3 necklaces in multicolour Krobo glass beads.',                             price:  110,                  category: 'Fashion',                          imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400', rating: 4.9, reviewCount: 47, stock: 60 },
      { store: kumasiFashId,  title: 'Leather Slip-On Sandals',            slug: 'leather-slip-on-sandals',        desc: 'Genuine leather with padded insole. Sizes 36â€“46.',                                 price:  165, compareAt:  200, category: 'Fashion',                          imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400', rating: 4.6, reviewCount: 33, stock: 45 },
      { store: kumasiFashId,  title: 'Woven Straw Beach Hat',              slug: 'woven-straw-beach-hat',          desc: 'Hand-woven natural straw hat. One size with adjustable inner band.',                price:   55,                  category: 'Fashion',                          imageUrl: 'https://images.unsplash.com/photo-1572307480813-ceb0e59d8325?w=400', rating: 4.3, reviewCount: 29, stock: 70 },
      { store: kumasiFashId,  title: "Men's Dashiki Shirt",                slug: 'mens-dashiki-shirt',             desc: 'Classic V-neck dashiki in bold geometric prints. Sizes Sâ€“4XL.',                    price:   95,                  category: 'Fashion',                          imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', rating: 4.8, reviewCount: 56, stock: 80 },
      { store: kumasiFashId,  title: 'Tie-Dye Oversized Hoodie',           slug: 'tie-dye-oversized-hoodie',       desc: 'Soft fleece hoodie with unique hand-dyed pattern. Unisex.',                        price:  160, compareAt:  200, category: 'Fashion',                          imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400', rating: 4.5, reviewCount: 24, stock: 40 },
      { store: kumasiFashId,  title: 'Kaftan Maxi Dress',                  slug: 'kaftan-maxi-dress',              desc: 'Flowy kaftan in bold mixed-print fabric. Free size XSâ€“2XL.',                       price:  220,                  category: 'Fashion',                          imageUrl: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=400', rating: 4.7, reviewCount: 38, stock: 30 },

      // Fresh Harvest Kumasi (10)
      { store: freshHarvId,   title: 'Garden Eggs (5kg)',                  slug: 'garden-eggs-5kg',                desc: 'Fresh, locally grown garden eggs. Great for stews and soups.',                     price:   28,                  category: 'Grocery',                          imageUrl: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400', rating: 4.4, reviewCount: 19, stock:200 },
      { store: freshHarvId,   title: 'Sweet Plantains (10 pcs)',           slug: 'sweet-plantains-10pcs',          desc: 'Ripe yellow plantains, ideal for kelewele and fried plantain.',                   price:   22,                  category: 'Grocery',                          imageUrl: 'https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=400', rating: 4.6, reviewCount: 34, stock:300 },
      { store: freshHarvId,   title: 'Cassava Flour (5kg)',                slug: 'cassava-flour-5kg',              desc: 'Stone-ground, gluten-free cassava flour. Perfect for banku and fufu.',             price:   45,                  category: 'Grocery',                          imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400', rating: 4.5, reviewCount: 27, stock:150 },
      { store: freshHarvId,   title: 'Groundnut Paste (1kg)',              slug: 'groundnut-paste-1kg',            desc: 'Freshly ground from roasted peanuts. No additives.',                               price:   35,                  category: 'Grocery',                          imageUrl: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=400', rating: 4.8, reviewCount: 51, stock:120 },
      { store: freshHarvId,   title: 'Local Raw Honey (1L)',               slug: 'local-raw-honey-1l',             desc: 'Unprocessed wildflower honey from Brong-Ahafo bee farms.',                         price:   95,                  category: 'Grocery',                          imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400', rating: 4.9, reviewCount: 43, stock: 80 },
      { store: freshHarvId,   title: 'Dried Fish Pack (500g)',             slug: 'dried-fish-pack-500g',           desc: 'Sun-dried herring, perfect for soups and stews. Vacuum sealed.',                  price:   48,                  category: 'Grocery',                          imageUrl: 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=400', rating: 4.3, reviewCount: 22, stock:100 },
      { store: freshHarvId,   title: 'Moringa Leaf Powder (250g)',         slug: 'moringa-leaf-powder-250g',       desc: 'Sun-dried, stone-ground moringa. High in iron and vitamins.',                      price:   55,                  category: 'Grocery',                          imageUrl: 'https://images.unsplash.com/photo-1556909114-44e3e9699e2b?w=400', rating: 4.7, reviewCount: 38, stock: 90 },
      { store: freshHarvId,   title: 'Yam (5kg)',                          slug: 'yam-5kg',                        desc: 'Fresh tuber yam, straight from Brong-Ahafo farms.',                                price:   42,                  category: 'Grocery',                          imageUrl: 'https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=400', rating: 4.5, reviewCount: 29, stock:200 },
      { store: freshHarvId,   title: 'Maize Flour (5kg)',                  slug: 'maize-flour-5kg',                desc: 'Finely milled corn flour for koko, banku, and kenkey.',                            price:   38,                  category: 'Grocery',                          imageUrl: 'https://images.unsplash.com/photo-1574226516831-e1dff420e562?w=400', rating: 4.4, reviewCount: 16, stock:180 },
      { store: freshHarvId,   title: 'Raw Shea Butter (500g)',             slug: 'raw-shea-butter-500g',           desc: 'Unrefined ivory shea butter from Upper East Ghana. Food and skincare use.',       price:   40,                  category: 'Grocery',                          imageUrl: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400', rating: 4.8, reviewCount: 45, stock:110 },

      // Glow Beauty Ghana (10)
      { store: glowBeautyId,  title: 'Whipped Shea Butter Cream 250ml',   slug: 'whipped-shea-butter-cream-250ml',desc: 'Luxuriously whipped shea butter with lavender for deep moisturising.',            price:   75,                  category: 'Health & Beauty', brand: 'Glow',    imageUrl: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400', rating: 4.9, reviewCount: 87, stock:150 },
      { store: glowBeautyId,  title: 'African Black Soap Bar 200g',        slug: 'african-black-soap-200g',        desc: 'Traditional black soap with raw shea, plantain ash and palm oil.',                 price:   30,                  category: 'Health & Beauty',                  imageUrl: 'https://images.unsplash.com/photo-1603905625-9003b8d04a30?w=400', rating: 4.8, reviewCount:113, stock:200 },
      { store: glowBeautyId,  title: 'Vitamin C Face Serum 30ml',          slug: 'vitamin-c-face-serum-30ml',      desc: '15% vitamin C with hyaluronic acid for brightening and anti-ageing.',               price:  110, compareAt:  150, category: 'Health & Beauty',                  imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400', rating: 4.7, reviewCount: 64, stock: 80 },
      { store: glowBeautyId,  title: 'Coconut Oil Hair Mask 200ml',        slug: 'coconut-oil-hair-mask-200ml',    desc: 'Intensive repair mask with virgin coconut oil and argan extract.',                 price:   65,                  category: 'Health & Beauty',                  imageUrl: 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=400', rating: 4.6, reviewCount: 49, stock:100 },
      { store: glowBeautyId,  title: 'Rose Water Facial Toner 150ml',      slug: 'rose-water-toner-150ml',         desc: 'Pure steam-distilled rose water. Balances skin pH and hydrates.',                  price:   45,                  category: 'Health & Beauty',                  imageUrl: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=400', rating: 4.7, reviewCount: 75, stock:120 },
      { store: glowBeautyId,  title: 'Argan Oil Hair Serum 100ml',         slug: 'argan-oil-hair-serum-100ml',     desc: 'Cold-pressed Moroccan argan oil for frizz-free, shiny hair.',                     price:   95, compareAt:  120, category: 'Health & Beauty',                  imageUrl: 'https://images.unsplash.com/photo-1598452963314-b09f397a5c48?w=400', rating: 4.8, reviewCount: 58, stock: 90 },
      { store: glowBeautyId,  title: 'Turmeric Brightening Face Mask 100g',slug: 'turmeric-face-mask-100g',        desc: 'Clay-based mask with turmeric and neem leaf for clear, even-toned skin.',          price:   55,                  category: 'Health & Beauty',                  imageUrl: 'https://images.unsplash.com/photo-1570194065650-d99fb4b38e76?w=400', rating: 4.5, reviewCount: 41, stock: 80 },
      { store: glowBeautyId,  title: 'Natural Lip Balm Set (5 pcs)',       slug: 'natural-lip-balm-set-5pcs',      desc: '5 natural lip balms: shea, mango, coconut, vanilla, and mint.',                   price:   48,                  category: 'Health & Beauty',                  imageUrl: 'https://images.unsplash.com/photo-1586495777744-4e6232a56ab3?w=400', rating: 4.9, reviewCount: 92, stock:200 },
      { store: glowBeautyId,  title: 'Aloe Vera Soothing Gel 300ml',       slug: 'aloe-vera-gel-300ml',            desc: '99% pure aloe vera gel. Multi-use: moisturiser, sunburn relief, hair gel.',       price:   35,                  category: 'Health & Beauty',                  imageUrl: 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400', rating: 4.6, reviewCount:103, stock:250 },
      { store: glowBeautyId,  title: 'Hair Growth Scalp Oil 60ml',         slug: 'hair-growth-scalp-oil-60ml',     desc: 'Rosemary and castor oil blend to stimulate hair growth.',                          price:   80, compareAt:  100, category: 'Health & Beauty',                  imageUrl: 'https://images.unsplash.com/photo-1617897903246-719242758050?w=400', rating: 4.7, reviewCount: 67, stock:100 },

      // Fitness Zone Accra (10)
      { store: fitnessZoneId, title: 'Adjustable Dumbbell Set 5â€“25kg',     slug: 'adjustable-dumbbell-set',        desc: 'Dial-select dumbbells replacing 9 pairs. Includes rack stand.',                   price: 1800, compareAt: 2200, category: 'Sports & Fitness', brand: 'PowerBlock',imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400', rating: 4.7, reviewCount: 23, stock: 15 },
      { store: fitnessZoneId, title: 'Premium Yoga Mat 6mm',               slug: 'premium-yoga-mat-6mm',           desc: 'Non-slip TPE foam mat with alignment lines. 183Ã—61cm.',                            price:  180, compareAt:  220, category: 'Sports & Fitness',                 imageUrl: 'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=400', rating: 4.6, reviewCount: 41, stock: 50 },
      { store: fitnessZoneId, title: 'Resistance Bands Set (5 bands)',     slug: 'resistance-bands-set-5',         desc: 'Latex-free, 5 resistance levels from 5â€“45kg equivalent.',                         price:   95,                  category: 'Sports & Fitness',                 imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400', rating: 4.5, reviewCount: 58, stock: 80 },
      { store: fitnessZoneId, title: 'Whey Protein Powder 2kg',            slug: 'whey-protein-powder-2kg',        desc: '24g protein per serving. Chocolate and vanilla flavours.',                         price:  480, compareAt:  560, category: 'Sports & Fitness',                 imageUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400', rating: 4.4, reviewCount: 35, stock: 40 },
      { store: fitnessZoneId, title: 'Mesh Running Trainer',               slug: 'mesh-running-trainer',           desc: 'Breathable mesh upper, cushioned midsole. Sizes 38â€“46.',                           price:  280, compareAt:  350, category: 'Sports & Fitness',                 imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', rating: 4.5, reviewCount: 44, stock: 60 },
      { store: fitnessZoneId, title: 'Speed Jump Rope',                    slug: 'speed-jump-rope',                desc: 'Aluminium handles, ball-bearing spin, 3m adjustable cable.',                      price:   45,                  category: 'Sports & Fitness',                 imageUrl: 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=400', rating: 4.3, reviewCount: 29, stock:100 },
      { store: fitnessZoneId, title: 'Insulated Water Bottle 1L',          slug: 'insulated-water-bottle-1l',      desc: 'Double-wall stainless steel. Cold 24h, hot 12h.',                                  price:   75,                  category: 'Sports & Fitness',                 imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400', rating: 4.7, reviewCount: 82, stock:120 },
      { store: fitnessZoneId, title: 'Deep Tissue Foam Roller',            slug: 'deep-tissue-foam-roller',        desc: 'High-density EVA foam, 33cm, for post-workout muscle recovery.',                   price:   90,                  category: 'Sports & Fitness',                 imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400', rating: 4.4, reviewCount: 26, stock: 45 },
      { store: fitnessZoneId, title: 'Padded Gym Gloves M/L',              slug: 'padded-gym-gloves-ml',           desc: 'Full-palm leather with padded grip and wrist support.',                            price:   65,                  category: 'Sports & Fitness',                 imageUrl: 'https://images.unsplash.com/photo-1521805489269-9ca73b8e4e1e?w=400', rating: 4.2, reviewCount: 18, stock: 60 },
      { store: fitnessZoneId, title: 'Doorframe Pull-Up Bar',              slug: 'doorframe-pullup-bar',           desc: 'No-drill install, supports up to 150kg. Wide and narrow grips.',                   price:  120,                  category: 'Sports & Fitness',                 imageUrl: 'https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?w=400', rating: 4.3, reviewCount: 22, stock: 35 },

      // HomeStyle Accra (11)
      { store: homeStyleId,   title: 'Egyptian Cotton Bedsheet Set (King)',slug: 'egyptian-cotton-bedsheet-king',  desc: '400TC king-size set with 2 pillowcases. Multiple colours.',                       price:  320, compareAt:  400, category: 'Home & Garden',                    imageUrl: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=400', rating: 4.7, reviewCount: 34, stock: 40 },
      { store: homeStyleId,   title: 'Memory Foam Pillow 2-Pack',          slug: 'memory-foam-pillow-2-pack',      desc: 'Contour memory foam with bamboo cover. Queen size.',                               price:  210,                  category: 'Home & Garden',                    imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400', rating: 4.6, reviewCount: 27, stock: 30 },
      { store: homeStyleId,   title: 'Ceramic Dinner Set 24-Piece',        slug: 'ceramic-dinner-set-24pcs',       desc: '6 settings: dinner plate, side plate, bowl, mug. Dishwasher safe.',                price:  380, compareAt:  450, category: 'Home & Garden',                    imageUrl: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400', rating: 4.5, reviewCount: 21, stock: 20 },
      { store: homeStyleId,   title: 'Pre-Seasoned Cast Iron Skillet 28cm',slug: 'cast-iron-skillet-28cm',         desc: 'Cast iron with glass lid. Works on induction, gas and electric.',                  price:  175,                  category: 'Home & Garden',                    imageUrl: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400', rating: 4.8, reviewCount: 49, stock: 35 },
      { store: homeStyleId,   title: 'Bamboo Cutting Board Set (3 pcs)',   slug: 'bamboo-cutting-board-set-3pcs',  desc: 'Small, medium, large bamboo boards with juice grooves.',                          price:   90,                  category: 'Home & Garden',                    imageUrl: 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=400', rating: 4.4, reviewCount: 36, stock: 60 },
      { store: homeStyleId,   title: 'Stainless Steel Electric Kettle 1.7L',slug:'stainless-steel-kettle-1-7l',   desc: '1500W, auto shut-off, boil-dry protection, BPA-free.',                             price:  140, compareAt:  180, category: 'Home & Garden',                    imageUrl: 'https://images.unsplash.com/photo-1556742111-a301076d9d18?w=400', rating: 4.5, reviewCount: 43, stock: 50 },
      { store: homeStyleId,   title: 'Blender 1000W Stainless Jar',        slug: 'blender-1000w-stainless-jar',    desc: '5-speed + pulse, 1.5L stainless jar. Great for smoothies and soups.',              price:  280, compareAt:  320, category: 'Home & Garden',                    imageUrl: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=400', rating: 4.4, reviewCount: 31, stock: 25 },
      { store: homeStyleId,   title: 'Blackout Curtains Set 2 Panels',     slug: 'blackout-curtains-set-2-panels', desc: '100% light-blocking, thermal insulated. 140Ã—250cm per panel.',                    price:  195,                  category: 'Home & Garden',                    imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400', rating: 4.6, reviewCount: 28, stock: 40 },
      { store: homeStyleId,   title: 'LED Desk Lamp with USB Charging',    slug: 'led-desk-lamp-usb-charging',     desc: '3 brightness levels, 5 colour modes, wireless charging base.',                    price:  160, compareAt:  200, category: 'Home & Garden',                    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400', rating: 4.7, reviewCount: 52, stock: 45 },
      { store: homeStyleId,   title: 'Wooden Wall Clock 40cm',             slug: 'wooden-wall-clock-40cm',         desc: 'Silent sweep movement, minimal scandi design. Battery included.',                  price:   95,                  category: 'Home & Garden',                    imageUrl: 'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=400', rating: 4.5, reviewCount: 37, stock: 55 },
      { store: homeStyleId,   title: 'Air Purifier with HEPA Filter',      slug: 'air-purifier-hepa-filter',       desc: 'True HEPA + activated carbon, covers 30mÂ², quiet 25dB night mode.',               price:  480,                  category: 'Home & Garden',                    imageUrl: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400', rating: 4.6, reviewCount: 19, stock: 18 },

      // Little Stars Kids (10)
      { store: littleStarsId, title: 'Wooden Educational Blocks (50 pcs)', slug: 'wooden-educational-blocks-50pcs',desc: 'Non-toxic paint, alphabet and number blocks for ages 2+.',                       price:   90,                  category: 'Baby & Kids',                      imageUrl: 'https://images.unsplash.com/photo-1558877385-81a1c7e67d72?w=400', rating: 4.9, reviewCount: 61, stock: 80 },
      { store: littleStarsId, title: 'Kids Balance Bicycle 14"',           slug: 'kids-balance-bicycle-14',        desc: 'No-pedal balance bike for ages 2â€“5. Adjustable seat, lightweight.',                price:  320, compareAt:  400, category: 'Baby & Kids',                      imageUrl: 'https://images.unsplash.com/photo-1571188654248-7a89213915f7?w=400', rating: 4.8, reviewCount: 29, stock: 20 },
      { store: littleStarsId, title: 'Plush Elephant Stuffed Toy',         slug: 'plush-elephant-stuffed-toy',     desc: 'Super-soft plush, 40cm. Hypoallergenic fill. Machine washable.',                  price:   75,                  category: 'Baby & Kids',                      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', rating: 4.9, reviewCount: 88, stock:100 },
      { store: littleStarsId, title: 'Colouring & Activity Book Set (5)',  slug: 'colouring-activity-book-set-5',  desc: '5 themed colouring books with 120+ pages each. Ages 3â€“8.',                        price:   55,                  category: 'Baby & Kids',                      imageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400', rating: 4.7, reviewCount: 47, stock:150 },
      { store: littleStarsId, title: 'Building Blocks 250pcs',             slug: 'building-blocks-250pcs',         desc: 'Compatible with major brick brands. Includes starter guide.',                     price:  120, compareAt:  150, category: 'Baby & Kids',                      imageUrl: 'https://images.unsplash.com/photo-1558861095-8c5e04a22f8b?w=400', rating: 4.7, reviewCount: 54, stock: 70 },
      { store: littleStarsId, title: 'Kids School Backpack (Dinosaur)',    slug: 'kids-school-backpack-dinosaur',  desc: 'Water-resistant, padded back, reflective strip. Fits A4 books.',                  price:   85,                  category: 'Baby & Kids',                      imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', rating: 4.6, reviewCount: 36, stock: 60 },
      { store: littleStarsId, title: 'Baby Onesie Gift Set 3-Pack (0â€“6mo)',slug: 'baby-onesie-gift-set-3pack',     desc: '100% organic cotton, snap buttons. 3 colour patterns.',                           price:   65,                  category: 'Baby & Kids',                      imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400', rating: 4.9, reviewCount: 72, stock:120 },
      { store: littleStarsId, title: 'Waterproof Play Mat 180Ã—200cm',      slug: 'waterproof-play-mat-180x200',    desc: 'Thick foam, reversible pattern, easy wipe-clean surface.',                        price:  150, compareAt:  190, category: 'Baby & Kids',                      imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400', rating: 4.7, reviewCount: 41, stock: 35 },
      { store: littleStarsId, title: 'Video Baby Monitor 3.5" Screen',     slug: 'video-baby-monitor-3-5',         desc: '720p camera, 300m range, night vision, temperature display.',                     price:  380, compareAt:  450, category: 'Baby & Kids',                      imageUrl: 'https://images.unsplash.com/photo-1590599145008-e4ec48675cd1?w=400', rating: 4.5, reviewCount: 18, stock: 15 },
      { store: littleStarsId, title: "Kids' Learning Tablet 7\"",          slug: 'kids-learning-tablet-7',         desc: 'Kid-proof case, 1000+ educational apps pre-loaded. Ages 3â€“12.',                   price:  280, compareAt:  350, category: 'Baby & Kids',                      imageUrl: 'https://images.unsplash.com/photo-1544244015-0df4cec50d83?w=400', rating: 4.4, reviewCount: 32, stock: 25 },

      // AutoParts Ghana (10)
      { store: autoPartsId,   title: 'Universal Car Floor Mats (4-piece)', slug: 'universal-car-floor-mats-4pcs',  desc: 'All-weather rubber mats, anti-slip. Fits most sedan and SUV models.',              price:   95,                  category: 'Automotive',                       imageUrl: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400', rating: 4.3, reviewCount: 27, stock: 80 },
      { store: autoPartsId,   title: 'Digital Tyre Pressure Gauge',        slug: 'digital-tyre-pressure-gauge',    desc: 'LCD display, 0â€“100 PSI range, backlit for night use.',                            price:   45,                  category: 'Automotive',                       imageUrl: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400', rating: 4.4, reviewCount: 33, stock:100 },
      { store: autoPartsId,   title: '2000A Jump Starter Power Pack',      slug: 'jump-starter-2000a',             desc: 'Starts 8L petrol or 6L diesel. 20000mAh power bank + torch.',                    price:  380, compareAt:  450, category: 'Automotive',                       imageUrl: 'https://images.unsplash.com/photo-1580274455191-1c62238fa333?w=400', rating: 4.6, reviewCount: 21, stock: 20 },
      { store: autoPartsId,   title: 'Adjustable Phone Car Mount',         slug: 'adjustable-phone-car-mount',     desc: 'Air-vent clip, 360Â° rotation, fits phones 4â€“7 inches.',                           price:   35,                  category: 'Automotive',                       imageUrl: 'https://images.unsplash.com/photo-1619771914272-e3e0af78e0df?w=400', rating: 4.2, reviewCount: 56, stock:150 },
      { store: autoPartsId,   title: 'Total Quartz Engine Oil 5W30 5L',    slug: 'total-quartz-5w30-5l',           desc: 'Fully synthetic, API SN/CF. Suitable for petrol and diesel engines.',              price:  285,                  category: 'Automotive', brand: 'Total',      imageUrl: 'https://images.unsplash.com/photo-1545262810-77515befe149?w=400', rating: 4.7, reviewCount: 44, stock: 60 },
      { store: autoPartsId,   title: 'Dash Camera Full HD 1080p',          slug: 'dash-camera-full-hd-1080p',      desc: '170Â° wide angle, loop recording, motion detection, night vision.',                 price:  220, compareAt:  280, category: 'Automotive',                       imageUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400', rating: 4.5, reviewCount: 29, stock: 40 },
      { store: autoPartsId,   title: 'Leatherette Seat Cover Set (5-pc)',  slug: 'leatherette-seat-cover-set-5pcs',desc: 'Full set front and rear. Universal fit, easy install.',                           price:  340, compareAt:  420, category: 'Automotive',                       imageUrl: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400', rating: 4.4, reviewCount: 16, stock: 25 },
      { store: autoPartsId,   title: 'Smart Battery Charger 12V/24V',      slug: 'smart-battery-charger-12v-24v',  desc: '10A multi-stage charger with desulfation mode. LED status display.',               price:  180,                  category: 'Automotive',                       imageUrl: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400', rating: 4.3, reviewCount: 19, stock: 30 },
      { store: autoPartsId,   title: 'Car Wash & Polish Kit (6-piece)',     slug: 'car-wash-polish-kit-6pcs',       desc: 'Foam gun, mitt, clay bar, compound, polish and wax included.',                    price:  165,                  category: 'Automotive',                       imageUrl: 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=400', rating: 4.5, reviewCount: 24, stock: 45 },
      { store: autoPartsId,   title: 'RGB Interior Lighting Kit',          slug: 'rgb-interior-lighting-kit',      desc: 'App-controlled RGB strips for footwells and under-dash. 12V plug-in.',             price:   75,                  category: 'Automotive',                       imageUrl: 'https://images.unsplash.com/photo-1571607388263-1044f9ea01dd?w=400', rating: 4.2, reviewCount: 38, stock: 70 },
    ];

    for (const p of bulkProducts) {
      await insertProduct(p.store, p);
    }
    console.log(`   âœ… ${bulkProducts.length} bulk products created\n`);

    // â”€â”€ 9. Orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating sample orders...');

    const { rows: [order1] } = await db.query(`
      INSERT INTO orders
        (order_number, buyer_id, store_id, status,
         subtotal, tax, delivery_fee, total_amount, currency,
         delivery_address_line1, delivery_city, delivery_country,
         delivery_latitude, delivery_longitude,
         paid_at, confirmed_at, escrow_status)
      VALUES ('SH-0001', $1, $2, 'completed',
              2200, 0, 15, 2215, 'GHS',
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
      VALUES ($1, $2, 'Samsung Galaxy A54 5G', 1, 2200, 2200)
    `, [order1.id, phone1Id]);

    const { rows: [order2] } = await db.query(`
      INSERT INTO orders
        (order_number, buyer_id, store_id, status,
         subtotal, tax, delivery_fee, total_amount, currency,
         delivery_address_line1, delivery_city, delivery_country,
         delivery_latitude, delivery_longitude,
         paid_at, escrow_status)
      VALUES ('SH-0002', $1, $2, 'paid',
              280, 0, 10, 290, 'GHS',
              '7 Ahensan Estate', 'Kumasi', 'Ghana',
              6.6885, -1.6244,
              NOW() - INTERVAL '1 day',
              'HELD')
      ON CONFLICT (order_number) DO UPDATE SET status = EXCLUDED.status
      RETURNING id
    `, [amaId, storeIds.fashion]);

    await db.query(`
      INSERT INTO order_items (order_id, product_id, product_title, quantity, price, subtotal)
      VALUES ($1, $2, 'Kente Print Wrap Dress', 1, 280, 280)
    `, [order2.id, kente1Id]);

    const { rows: [order3] } = await db.query(`
      INSERT INTO orders
        (order_number, buyer_id, store_id, status,
         subtotal, tax, delivery_fee, total_amount, currency,
         delivery_address_line1, delivery_city, delivery_country,
         delivery_latitude, delivery_longitude)
      VALUES ('SH-0003', $1, $2, 'pending',
              405, 0, 12, 417, 'GHS',
              '24 Labadi Road', 'Accra', 'Ghana',
              5.5502, -0.2174)
      ON CONFLICT (order_number) DO UPDATE SET status = EXCLUDED.status
      RETURNING id
    `, [kwameId, storeIds.grocery]);

    await db.query(`
      INSERT INTO order_items (order_id, product_id, product_title, quantity, price, subtotal)
      VALUES
        ($1, $2, 'Ghana Jasmine Rice (25kg)', 1, 320, 320),
        ($1, $3, 'Pure Red Palm Oil (5L)', 1, 85, 85)
    `, [order3.id, riceId, palmoilId]);

    console.log('   âœ… Orders created\n');

    // â”€â”€ 10. Deliveries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating deliveries...');
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
              5.2, 15, 10,
              NOW() - INTERVAL '5 days',
              NOW() - INTERVAL '5 days' + INTERVAL '30 minutes',
              NOW() - INTERVAL '5 days' + INTERVAL '1 hour')
      ON CONFLICT (order_id) DO NOTHING
    `, [order1.id, driverId]);
    console.log('   âœ… Deliveries created\n');

    // â”€â”€ 11. Reviews â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating reviews...');
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
    console.log('   âœ… Reviews created\n');

    // â”€â”€ 12. Conversations & Messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating conversations...');
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
      [conv1Id, kofiId, 'Yes, you\'ll receive a notification once the driver picks it up. ðŸš€'],
    ];
    for (const [convId, senderId, content] of msgs) {
      await db.query(
        `INSERT INTO messages (conversation_id, sender_id, content, is_read)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT DO NOTHING`,
        [convId, senderId, content]
      );
    }
    console.log('   âœ… Conversations & messages created\n');

    // â”€â”€ 13. Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating notifications...');
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, is_read)
      VALUES
        ($1, 'order_confirmed', 'Order Confirmed âœ…', 'Your order #SH-0001 has been confirmed by TechHub Accra.', TRUE),
        ($1, 'order_delivered', 'Order Delivered ðŸŽ‰', 'Your Samsung Galaxy A54 has been delivered. Enjoy!', TRUE),
        ($1, 'order_confirmed', 'Order Received', 'Yaw Fresh Groceries received your order #SH-0003.', FALSE)
      ON CONFLICT DO NOTHING
    `, [kwameId]);

    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, is_read)
      VALUES
        ($1, 'new_order', 'New Order! ðŸ›ï¸', 'You have a new order #SH-0002 for Kente Print Wrap Dress.', FALSE)
      ON CONFLICT DO NOTHING
    `, [abenaId]);
    console.log('   âœ… Notifications created\n');

    // â”€â”€ 14. Favorites â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating favorites...');
    await db.query(`
      INSERT INTO favorites (user_id, product_id)
      VALUES ($1, $2), ($1, $3), ($1, $4)
      ON CONFLICT DO NOTHING
    `, [kwameId, laptopId, earbudsId, kente1Id]);
    console.log('   âœ… Favorites created\n');

    // â”€â”€ 15. Referral codes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating referral codes...');
    await db.query(`UPDATE user_profiles SET referral_code = 'KWAME2026' WHERE user_id = $1`, [kwameId]);
    await db.query(`UPDATE user_profiles SET referral_code = 'AMA2026' WHERE user_id = $1`, [amaId]);
    await db.query(`UPDATE user_profiles SET referral_code = 'KOFI2026' WHERE user_id = $1`, [kofiId]);
    console.log('   âœ… Referral codes created\n');

    // â”€â”€ 16. Quick Snaps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating quick snaps...');
    await db.query(`
      INSERT INTO snaps (store_id, product_id, media_url, caption, expires_at)
      VALUES 
        ($1, $2, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8', 'MacBook Air M2 back in stock!', NOW() + INTERVAL '23 hours'),
        ($3, $4, 'https://images.unsplash.com/photo-1588359410707-1601736b4904', 'Kente Dress limited edition', NOW() + INTERVAL '22 hours'),
        ($5, NULL, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836', 'Fresh fruits just arrived ðŸŽ', NOW() + INTERVAL '24 hours')
      ON CONFLICT DO NOTHING
    `, [storeIds.tech, laptopId, storeIds.fashion, kente1Id, storeIds.grocery]);
    console.log('   âœ… Quick snaps created\n');

    // â”€â”€ 17. User Events (Recommendations) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating user events...');
    await db.query(`
      INSERT INTO user_events (user_id, product_id, event_type, weight)
      VALUES 
        ($1, $2, 'purchase', 5),
        ($1, $3, 'view', 1),
        ($4, $2, 'add_to_cart', 3),
        ($4, $5, 'view', 1)
      ON CONFLICT DO NOTHING
    `, [kwameId, laptopId, earbudsId, amaId, phone1Id]);
    console.log('   âœ… User events created\n');

    // â”€â”€ 18. Banner Campaigns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating banner campaigns...');
    await db.query(`
      INSERT INTO banner_campaigns (store_id, title, placement, duration_days, paid_amount, status, banner_url, start_date, end_date)
      VALUES 
        ($1, 'Back to School Sale', 'home_hero', 7, 150, 'Active', 'https://images.unsplash.com/photo-1509062522246-3755977927d7', NOW(), NOW() + INTERVAL '7 days'),
        ($2, 'Kente Collection 2026', 'category_sidebar', 14, 250, 'Active', 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b', NOW(), NOW() + INTERVAL '14 days')
      ON CONFLICT DO NOTHING
    `, [storeIds.tech, storeIds.fashion]);
    console.log('   âœ… Banner campaigns created\n');

    // â”€â”€ 19. User Reports & Blocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating reports and blocks...');
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
    console.log('   âœ… Reports and blocks created\n');

    await db.query('COMMIT');
    console.log('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
    console.log('âœ…  Seed complete! Test accounts:');
    console.log('');
    console.log('   Role     Email                      Password');
    console.log('   â”€â”€â”€â”€â”€â”€   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€     â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
    console.log(`   Admin    ${adminEmail.padEnd(26)} ${adminPassword}`);
    console.log('   Buyer    kwame@test.com              Password123!');
    console.log('   Buyer    ama@test.com                Password123!');
    console.log('   Seller   kofi.sells@test.com         Password123!');
    console.log('   Seller   abena.fashions@test.com     Password123!');
    console.log('   Seller   yaw.foods@test.com          Password123!');
    console.log('   Seller   accratech@test.com          Password123!');
    console.log('   Seller   kumasifashion@test.com      Password123!');
    console.log('   Seller   freshharvestgh@test.com     Password123!');
    console.log('   Seller   glowbeautygh@test.com       Password123!');
    console.log('   Seller   fitnesszonegh@test.com      Password123!');
    console.log('   Seller   homestylegh@test.com        Password123!');
    console.log('   Seller   littlestarsgh@test.com      Password123!');
    console.log('   Seller   autopartsgh@test.com        Password123!');
    console.log('   Driver   driver@test.com             Password123!');
    console.log('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');

  } catch (err) {
    await db.query('ROLLBACK');
    console.error('\nâŒ Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    db.release();
    process.exit(0);
  }
}

seed();
