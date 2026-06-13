/**
 * Shopyos Production Setup Script
 * Run: node scripts/setup-prod.js
 *
 * This script safely initializes a fresh production database with ONLY
 * the absolute necessary system requirements (Roles, Bot, and Super Admin).
 * It will NOT insert fake products, orders, or test accounts.
 */

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); 
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const { getPool } = require('../config/postgres');

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SUPPORT_USER_ID = '00000000-0000-0000-0000-000000000001';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const hash = (pw) => bcrypt.hash(pw, 10);

async function insertUser(db, { email, name, phone, city, lat, lng, country = 'Ghana', password }) {
  const pw = await hash(password);
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
async function setupProd() {
  const pool = getPool();
  const db = await pool.connect();
  console.log('ðŸš€ Starting Production Setup...\n');

  try {
    await db.query('BEGIN');

    // â”€â”€ 1. Roles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Configuring roles...');
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
    console.log('   âœ… Roles configured\n');

    // â”€â”€ 2. Support system user (Shopyos Bot) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating Shopyos Bot...');
    const botPw = await hash('NOT_A_LOGIN_PASSWORD_DO_NOT_USE');
    await db.query(`
      INSERT INTO users (id, email, password_hash, email_verified, is_active)
      VALUES ($1, 'bot@shopyos.com', $2, TRUE, TRUE)
      ON CONFLICT (id) DO NOTHING
    `, [SUPPORT_USER_ID, botPw]);
    
    await db.query(`
      UPDATE user_profiles SET full_name = $2, phone = $3, city = $4, country = $5
      WHERE user_id = $1
    `, [SUPPORT_USER_ID, 'Shopyos Bot', '+233000000000', 'Accra', 'Ghana']);
    
    await assignRole(db, SUPPORT_USER_ID, roleMap.admin);
    console.log('   âœ… Shopyos Bot ready\n');

    // â”€â”€ 3. Super Admin user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('ðŸ“Œ Creating super admin account...');
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be defined in your .env file for production setup.');
    }
    
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
    console.log('   âœ… Super Admin created:', adminEmail, '\n');

    await db.query('COMMIT');
    console.log('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
    console.log('âœ… Production Setup Complete!');
    console.log('   The database is now ready to receive real users.');
    console.log('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');

  } catch (err) {
    await db.query('ROLLBACK');
    console.error('\nâŒ Setup failed:', err.message);
    process.exit(1);
  } finally {
    db.release();
    process.exit(0);
  }
}

setupProd();
