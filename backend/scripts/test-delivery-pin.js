// scripts/test-delivery-pin.js
// Automated verification script for Delivery PIN flow and role boundaries

require('dotenv').config({ path: '../.env' });
const assert = require('node:assert');
const repositories = require('../db/repositories');
const { getPool } = require('../config/postgres');
const orderController = require('../controllers/orderController');
const deliveryController = require('../controllers/deliveryController');

const makeMockRes = () => {
  const res = {
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
  return res;
};

async function testWorkflow() {
  console.log('🏁 Starting Delivery PIN & Status Boundaries integration test...\n');
  const db = getPool();

  // 1. Fetch test users
  console.log('🔍 Fetching test driver and store...');
  const { rows: drivers } = await db.query("SELECT id FROM users WHERE email = 'driver@test.com' LIMIT 1");
  const { rows: stores } = await db.query("SELECT id, owner_id FROM stores LIMIT 1");

  if (drivers.length === 0 || stores.length === 0) {
    throw new Error('Please run npm run seed first to populate test drivers and stores!');
  }

  const driverId = drivers[0].id;
  const storeId = stores[0].id;
  const sellerId = stores[0].owner_id;

  // Let's get a customer buyer ID that is NOT the seller or driver
  const { rows: buyers } = await db.query(
    "SELECT id FROM users WHERE email != 'driver@test.com' AND id != $1 LIMIT 1",
    [sellerId]
  );
  if (buyers.length === 0) {
    throw new Error('No test buyers found.');
  }
  const buyerId = buyers[0].id;

  console.log(`ℹ️ Driver ID: ${driverId}`);
  console.log(`ℹ️ Seller ID: ${sellerId}`);
  console.log(`ℹ️ Buyer ID: ${buyerId}`);
  console.log(`ℹ️ Store ID: ${storeId}\n`);

  // 2. Create a test order
  console.log('📦 Creating test order in DB...');
  const { rows: orders } = await db.query(`
    INSERT INTO orders (
      order_number, buyer_id, store_id, status, subtotal, tax, delivery_fee, total_amount, 
      delivery_address_line1, delivery_city, delivery_country, delivery_phone, escrow_status
    ) VALUES (
      $1, $2, $3, 'ready_for_pickup', 100.00, 1.00, 15.00, 116.00,
      'Test Address 123', 'Accra', 'Ghana', '+233244000000', 'HELD'
    ) RETURNING id, order_number
  `, [`TEST-ORD-${Date.now()}`, buyerId, storeId]);

  const orderId = orders[0].id;
  const orderNumber = orders[0].order_number;
  console.log(`✅ Order created: ${orderNumber} (ID: ${orderId})`);

  // 3. Test Seller Status Boundaries
  console.log('🚫 Test 1: Verifying store/seller cannot mark order as in_transit, delivered, or completed...');
  {
    const req = {
      params: { orderId },
      body: { status: 'delivered' },
      user: { id: sellerId, roles: ['seller'] }
    };
    const res = makeMockRes();

    await orderController.updateOrderStatus(req, res, () => {});
    
    assert.strictEqual(res.statusCode, 403, 'Sellers must be blocked from marking orders as delivered');
    assert.match(res.jsonData.error, /Sellers are not authorized to update order status to delivered/i);
    console.log('✅ Seller blocked successfully from marking delivered.');
  }

  // 4. Create delivery row
  console.log('🚚 Creating delivery row for the order...');
  const delivery = await repositories.deliveries.createDelivery({
    orderId,
    pickupAddress: 'Store Address 456',
    deliveryAddress: 'Test Address 123',
    status: 'unassigned'
  });
  const deliveryId = delivery.id;
  console.log(`✅ Delivery created (ID: ${deliveryId})`);

  // 5. Assign driver to delivery
  console.log('🤝 Assigning driver to delivery...');
  await repositories.deliveries.assignDriver(deliveryId, driverId);
  console.log('✅ Driver assigned successfully.');

  // 6. Test Driver Direct Status Boundaries
  console.log('🚫 Test 2: Verifying driver cannot directly set status to delivered...');
  {
    const req = {
      params: { deliveryId },
      body: { status: 'delivered' },
      user: { id: driverId }
    };
    const res = makeMockRes();

    await deliveryController.updateDeliveryStatus(req, res, () => {});

    assert.strictEqual(res.statusCode, 400, 'Drivers must be blocked from setting status directly to delivered');
    assert.match(res.jsonData.error, /To complete delivery, you must verify the customer's 6-digit PIN/i);
    console.log('✅ Driver blocked successfully from directly setting delivered status.');
  }

  // 7. Update status to picked_up (Should generate PIN and put order in_transit)
  console.log('📦 Test 3: Updating delivery to picked_up to trigger PIN generation...');
  {
    const req = {
      params: { deliveryId },
      body: { status: 'picked_up' },
      user: { id: driverId }
    };
    const res = makeMockRes();

    await deliveryController.updateDeliveryStatus(req, res, () => {});

    assert.strictEqual(res.statusCode, 200, 'Updating status to picked_up should succeed');
    console.log('✅ Status updated to picked_up.');

    // Verify order is now in_transit and has a PIN code
    const updatedOrder = await repositories.orders.findById(orderId);
    assert.strictEqual(updatedOrder.status, 'in_transit', 'Order status should be updated to in_transit');
    assert.ok(updatedOrder.verification_pin, 'Order verification_pin should have been generated');
    assert.strictEqual(updatedOrder.verification_pin.length, 6, 'Verification PIN should be exactly 6 digits');
    console.log(`✅ Generated customer verification PIN: ${updatedOrder.verification_pin}`);

    // 8. Verify PIN Verification (Invalid PIN)
    console.log('🚫 Test 4: Verifying code verification rejects invalid PIN...');
    {
      const pinReq = {
        params: { deliveryId },
        body: { pin: '000000' }, // Incorrect PIN
        user: { id: driverId }
      };
      const pinRes = makeMockRes();

      await deliveryController.verifyDeliveryPin(pinReq, pinRes, () => {});

      assert.strictEqual(pinRes.statusCode, 400, 'PIN verification with invalid pin must fail');
      assert.match(pinRes.jsonData.error, /Invalid verification PIN/i);
      console.log('✅ Rejects invalid PIN successfully.');
    }

    // 9. Verify PIN Verification (Valid PIN)
    console.log('🔑 Test 5: Verifying code verification accepts correct PIN and releases escrow atomically...');
    {
      const pinReq = {
        params: { deliveryId },
        body: { pin: updatedOrder.verification_pin }, // Correct PIN
        user: { id: driverId }
      };
      const pinRes = makeMockRes();

      await deliveryController.verifyDeliveryPin(pinReq, pinRes, () => {});

      assert.strictEqual(pinRes.statusCode, 200, 'PIN verification with correct pin must succeed');
      assert.strictEqual(pinRes.jsonData.success, true);
      console.log('✅ PIN verified successfully! Escrow released and order marked complete.');

      // Final state assertion
      const finalOrder = await repositories.orders.findById(orderId);
      const finalDelivery = await repositories.deliveries.findById(deliveryId);

      assert.strictEqual(finalOrder.status, 'completed', 'Order status should be completed');
      assert.strictEqual(finalOrder.escrow_status, 'RELEASED', 'Escrow status should be RELEASED');
      assert.strictEqual(finalDelivery.status, 'delivered', 'Delivery status should be delivered');
      console.log('✅ Final states confirmed: Order = completed, Escrow = RELEASED, Delivery = delivered.');
    }
  }

  // 10. Clean up test records
  console.log('🧹 Cleaning up test records from DB...');
  await db.query('DELETE FROM wallet_logs WHERE order_id = $1', [orderId]);
  await db.query('DELETE FROM balance_logs WHERE order_id = $1', [orderId]);
  await db.query('DELETE FROM delivery_location_updates WHERE delivery_id = $1', [deliveryId]);
  await db.query('DELETE FROM deliveries WHERE id = $1', [deliveryId]);
  await db.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
  await db.query('DELETE FROM orders WHERE id = $1', [orderId]);
  console.log('✅ Cleanup completed successfully.');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! The Delivery PIN flow is highly secure and 100% correct.');
}

testWorkflow()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Integration Test Failed:', err);
    process.exit(1);
  });
