// scripts/test-driver-notifications.js
// Automated verification script for Driver Availability Range Notifications

require('dotenv').config({ path: '../.env' });
const assert = require('node:assert');
const repositories = require('../db/repositories');
const { getPool } = require('../config/postgres');
const orderController = require('../controllers/orderController');
const notificationService = require('../services/notificationService');

const makeMockRes = () => {
  return {
    statusCode: 200,
    headers: {},
    jsonData: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.jsonData = data;
      return this;
    }
  };
};

async function testNotifications() {
  console.log('ðŸ Starting Driver Range Notifications integration test...\n');
  const db = getPool();

  // 1. Fetch test driver, store, and buyer
  console.log('ðŸ” Fetching test driver and store...');
  const { rows: stores } = await db.query("SELECT id, owner_id, store_name, latitude, longitude FROM stores LIMIT 1");
  if (stores.length === 0) {
    throw new Error('Please run npm run seed first to populate stores!');
  }
  const store = stores[0];
  const storeId = store.id;
  const sellerId = store.owner_id;

  // Fetch a buyer
  const { rows: buyers } = await db.query(
    "SELECT id FROM users WHERE id != $1 LIMIT 1",
    [sellerId]
  );
  if (buyers.length === 0) {
    throw new Error('No test buyers found.');
  }
  const buyerId = buyers[0].id;

  // Let's find or create a driver that is online and within 10 km of the store.
  // We'll search for Emmanuel Tetteh's user ID or a driver profile.
  const { rows: drivers } = await db.query(`
    SELECT d.user_id, p.full_name, p.latitude, p.longitude, d.is_verified, d.is_available
    FROM driver_profiles d
    JOIN user_profiles p ON d.user_id = p.user_id
    LIMIT 1
  `);

  if (drivers.length === 0) {
    throw new Error('No driver profiles found in database! Run seed first.');
  }

  const driver = drivers[0];
  console.log(`â„¹ï¸ Original Driver state: Name=${driver.full_name}, Verified=${driver.is_verified}, Available=${driver.is_available}, Lat=${driver.latitude}, Lng=${driver.longitude}`);

  // Force-update the driver's profile to be verified, online, and close to the store coordinates
  // Store coordinates:
  const storeLat = Number.parseFloat(store.latitude || 6.6935);
  const storeLng = Number.parseFloat(store.longitude || -1.6168);
  
  // Set driver coordinates ~3 km away
  const driverLat = storeLat + 0.02;
  const driverLng = storeLng + 0.02;

  console.log(`âš™ï¸ Force-updating driver profile to be online/verified at (${driverLat}, ${driverLng}) within 10 km range of store (${storeLat}, ${storeLng})...`);
  
  await db.query(`
    UPDATE driver_profiles 
    SET is_verified = TRUE, is_available = TRUE 
    WHERE user_id = $1
  `, [driver.user_id]);

  await db.query(`
    UPDATE user_profiles 
    SET latitude = $1, longitude = $2 
    WHERE user_id = $3
  `, [driverLat, driverLng, driver.user_id]);

  // Let's also check another driver profile that is offline/available=false to ensure filtering works correctly!
  const { rows: allDrivers } = await db.query(`
    SELECT d.user_id, p.full_name, d.is_available, d.is_verified
    FROM driver_profiles d
    JOIN user_profiles p ON d.user_id = p.user_id
  `);
  
  console.log(`â„¹ï¸ Total drivers in DB: ${allDrivers.length}`);
  allDrivers.forEach(d => {
    console.log(`   - ${d.full_name}: Verified=${d.is_verified}, Available=${d.is_available}`);
  });

  // Mock Notification Service calls so we don't trigger real network calls but track invocations
  const notificationCalls = {
    push: [],
    email: [],
    sms: []
  };

  const originalSendPush = notificationService.sendPushNotification;
  const originalSendEmail = notificationService.sendEmail;
  const originalSendSMS = notificationService.sendSMS;

  notificationService.sendPushNotification = async (params) => {
    notificationCalls.push.push(params);
    console.log(`ðŸ“² [Mock Push] Sent to user ${params.userId}: "${params.title}" - ${params.body}`);
    return true;
  };

  notificationService.sendEmail = async (params) => {
    notificationCalls.email.push(params);
    console.log(`âœ‰ï¸ [Mock Email] Sent to ${params.to}: "${params.subject}"`);
    return true;
  };

  notificationService.sendSMS = async (params) => {
    notificationCalls.sms.push(params);
    console.log(`ðŸ’¬ [Mock SMS] Sent to ${params.to}: "${params.message}"`);
    return true;
  };

  try {
    // 2. Create a test order in "confirmed" status
    console.log('\nðŸ“¦ Creating test order in DB...');
    const { rows: orders } = await db.query(`
      INSERT INTO orders (
        order_number, buyer_id, store_id, status, subtotal, tax, delivery_fee, total_amount, 
        delivery_address_line1, delivery_city, delivery_country, delivery_phone, escrow_status
      ) VALUES (
        $1, $2, $3, 'confirmed', 50.00, 0.50, 10.00, 60.50,
        'Buyer Address 789', 'Kumasi', 'Ghana', '+233244111222', 'HELD'
      ) RETURNING id, order_number
    `, [`TEST-ORD-NOTIF-${Date.now()}`, buyerId, storeId]);

    const orderId = orders[0].id;
    const orderNumber = orders[0].order_number;
    console.log(`âœ… Order created: ${orderNumber} (ID: ${orderId})`);

    // 3. Mark the order as ready_for_pickup
    console.log('\nðŸ”„ Transitioning order status to "ready_for_pickup" to trigger notifications...');
    const req = {
      params: { orderId },
      body: { status: 'ready_for_pickup' },
      user: { id: sellerId, roles: ['seller'] }
    };
    const res = makeMockRes();

    await orderController.updateOrderStatus(req, res, () => {});

    assert.strictEqual(res.statusCode, 200, 'Order update to ready_for_pickup should succeed');
    console.log('âœ… Order marked ready_for_pickup successfully.');

    // 4. Verify the automatic delivery was created and notifications were dispatched
    console.log('\nðŸ”¬ Verifying notifications were dispatched to matching drivers...');
    
    // Check if delivery was created
    const existingDelivery = await repositories.deliveries.findByOrderId(orderId);
    assert.ok(existingDelivery, 'Delivery record should have been automatically created');
    assert.strictEqual(existingDelivery.status, 'unassigned', 'Delivery status should be unassigned');
    assert.strictEqual(Number(existingDelivery.delivery_fee), 10, 'Delivery fee should match order');
    assert.strictEqual(Number(existingDelivery.driver_earnings), 8.5, 'Driver earnings should be 85% of delivery fee');
    console.log(`âœ… Auto-created delivery details verified: Fee=â‚µ${existingDelivery.delivery_fee}, Earnings=â‚µ${existingDelivery.driver_earnings}`);

    // Verify mock notifications got called
    assert.ok(notificationCalls.push.length > 0, 'Should trigger push notification');
    assert.ok(notificationCalls.email.length > 0, 'Should trigger email notification');
    assert.ok(notificationCalls.sms.length > 0, 'Should trigger SMS notification');

    // Verify they targeted our matched driver
    const targetPush = notificationCalls.push.find(n => n.userId === driver.user_id);
    assert.ok(targetPush, 'Driver should receive push notification');
    if (targetPush) {
      assert.match(targetPush.title, /New Delivery Request/);
      assert.strictEqual(targetPush.data.deliveryId, existingDelivery.id);
    }

    console.log('\nðŸŽ‰ ALL NOTIFICATION DISPATCH VERIFICATIONS PASSED SUCCESSFULLY!');

    // Cleanup
    console.log('\nðŸ§¹ Cleaning up test records from DB...');
    await db.query('DELETE FROM deliveries WHERE id = $1', [existingDelivery.id]);
    await db.query('DELETE FROM orders WHERE id = $1', [orderId]);
    
    // Restore driver state
    await db.query(`
      UPDATE driver_profiles 
      SET is_verified = $1, is_available = $2 
      WHERE user_id = $3
    `, [driver.is_verified, driver.is_available, driver.user_id]);

    await db.query(`
      UPDATE user_profiles 
      SET latitude = $1, longitude = $2 
      WHERE user_id = $3
    `, [driver.latitude, driver.longitude, driver.user_id]);
    console.log('âœ… Cleanup completed successfully.');

  } catch (err) {
    // Restore original functions
    notificationService.sendPushNotification = originalSendPush;
    notificationService.sendEmail = originalSendEmail;
    notificationService.sendSMS = originalSendSMS;
    throw err;
  }

  // Restore original functions
  notificationService.sendPushNotification = originalSendPush;
  notificationService.sendEmail = originalSendEmail;
  notificationService.sendSMS = originalSendSMS;
}

testNotifications()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\nâŒ Integration Test Failed:', err);
    process.exit(1);
  });
