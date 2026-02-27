// controllers/paymentController.js
const crypto = require('crypto');
const axios = require('axios');
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// ── Helpers ──────────────────────────────────────────────────────

const paystackHeaders = () => ({
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
});

/**
 * Idempotent helper – marks a payment as completed and updates order + store balance.
 * Returns true if work was done, false if already completed.
 */
const fulfillPayment = async (orderId, paystackData) => {
    // Check current status first (idempotency)
    const { data: existing } = await repositories.orders.db
        .from('payments')
        .select('status')
        .eq('order_id', orderId)
        .single();

    if (!existing || existing.status === 'completed') {
        return false; // Already fulfilled or doesn't exist
    }

    const amountPaid = paystackData.amount / 100;
    const channel = paystackData.channel || 'unknown';
    const now = new Date().toISOString();

    // Update payment record
    await repositories.orders.db
        .from('payments')
        .update({
            status: 'completed',
            paid_at: now,
            payment_method: channel === 'mobile_money' ? 'mobile_money' : 'card',
            payment_details: paystackData
        })
        .eq('order_id', orderId);

    // Update order status to paid
    await repositories.orders.db
        .from('orders')
        .update({ status: 'paid', updated_at: now })
        .eq('id', orderId);

    // Credit store balance
    const order = await repositories.orders.findById(orderId);
    if (order && order.store_id) {
        const store = await repositories.stores.findById(order.store_id);
        if (store) {
            const newBalance = parseFloat(store.current_balance || 0) + amountPaid;
            await repositories.stores.update(store.id, { current_balance: newBalance });

            await repositories.orders.db.from('balance_logs').insert({
                store_id: store.id,
                amount: amountPaid,
                transaction_type: 'sale',
                order_id: order.id,
                balance_after: newBalance
            });
        }
    }

    // Notify buyer
    if (order) {
        await repositories.notifications.create({
            user_id: order.buyer_id,
            type: 'order_placed',
            title: 'Payment Confirmed',
            message: `Payment of ₵${amountPaid.toFixed(2)} for order #${order.order_number} confirmed.`,
            data: { orderId: order.id, orderNumber: order.order_number, amount: amountPaid }
        }).catch(err => logger.error('Notification failed', { error: err.message }));
    }

    logger.info('Payment fulfilled', { orderId, amount: amountPaid, channel });
    return true;
};

// ── Initialize Payment ──────────────────────────────────────────

/**
 * @route   POST /api/v1/payments/initialize
 * @access  Private
 * @body    { orderId, email?, channel?, momoPhone?, momoProvider? }
 *
 * channel can be: 'card', 'mobile_money', or omitted (Paystack default picker)
 * For MoMo: pass momoPhone and momoProvider (mtn, vod, tgo)
 */
const initializePayment = async (req, res, next) => {
    try {
        const { orderId, email: clientEmail, channel, momoPhone, momoProvider } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, error: 'orderId is required' });
        }

        // Fetch order — amount MUST come from DB, never from client
        const order = await repositories.orders.getOrderDetails(orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        // Verify the order belongs to this user
        if (order.buyer_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'You cannot pay for this order' });
        }

        // Prevent double-pay
        const { data: existingPayment } = await repositories.orders.db
            .from('payments')
            .select('status')
            .eq('order_id', orderId)
            .single();

        if (existingPayment && existingPayment.status === 'completed') {
            return res.status(400).json({ success: false, error: 'This order has already been paid' });
        }

        // Resolve email
        let email = clientEmail;
        if (!email) {
            if (order.buyer?.email) email = order.buyer.email;
            else {
                const user = await repositories.users.findById(order.buyer_id);
                email = user?.email;
            }
        }
        if (!email) {
            return res.status(400).json({ success: false, error: 'Customer email is required' });
        }

        const totalAmount = parseFloat(order.total_amount);
        const amountInPesewas = Math.round(totalAmount * 100);

        // Build Paystack payload
        const payload = {
            email,
            amount: amountInPesewas,
            currency: 'GHS',
            metadata: {
                orderId,
                userId: req.user.id,
                custom_fields: [
                    { display_name: 'Order Number', variable_name: 'order_number', value: order.order_number }
                ]
            }
        };

        // Channel-specific config
        if (channel === 'mobile_money') {
            payload.channels = ['mobile_money'];

            if (momoPhone && momoProvider) {
                payload.mobile_money = {
                    phone: momoPhone,
                    provider: momoProvider // mtn, vod, tgo
                };
            }
        } else if (channel === 'card') {
            payload.channels = ['card'];
        }
        // If no channel specified, Paystack shows all available options

        const response = await axios.post(
            `${PAYSTACK_BASE_URL}/transaction/initialize`,
            payload,
            { headers: paystackHeaders() }
        );

        if (!response.data.status) {
            return res.status(400).json({ success: false, error: response.data.message || 'Failed to initialize payment' });
        }

        // Store reference on payment record
        await repositories.orders.db
            .from('payments')
            .update({
                provider_transaction_id: response.data.data.reference,
                payment_provider: 'paystack'
            })
            .eq('order_id', orderId);

        logger.info('Payment initialized', {
            orderId,
            reference: response.data.data.reference,
            channel: channel || 'all',
            amount: totalAmount
        });

        res.status(200).json({
            success: true,
            data: {
                authorization_url: response.data.data.authorization_url,
                access_code: response.data.data.access_code,
                reference: response.data.data.reference
            }
        });
    } catch (error) {
        if (error.response) {
            logger.error('Paystack initialize error', {
                status: error.response.status,
                data: error.response.data
            });
            return res.status(error.response.status).json({
                success: false,
                error: error.response.data?.message || 'Payment provider error'
            });
        }
        next(error);
    }
};

// ── Verify Payment ──────────────────────────────────────────────

/**
 * @route   GET /api/v1/payments/verify/:reference
 * @access  Private
 */
const verifyPayment = async (req, res, next) => {
    try {
        const { reference } = req.params;

        if (!reference) {
            return res.status(400).json({ success: false, error: 'Payment reference is required' });
        }

        const response = await axios.get(
            `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
            { headers: paystackHeaders() }
        );

        const txn = response.data.data;

        if (response.data.status && txn.status === 'success') {
            const orderId = txn.metadata?.orderId;

            if (!orderId) {
                logger.error('Verify: missing orderId in metadata', { reference });
                return res.status(400).json({ success: false, error: 'Cannot determine order from this transaction' });
            }

            const fulfilled = await fulfillPayment(orderId, txn);

            res.status(200).json({
                success: true,
                message: fulfilled ? 'Payment verified and order updated' : 'Payment already confirmed',
                data: {
                    reference: txn.reference,
                    amount: txn.amount / 100,
                    currency: txn.currency,
                    channel: txn.channel,
                    status: txn.status,
                    paidAt: txn.paid_at
                }
            });
        } else {
            // Transaction exists but is not successful
            res.status(200).json({
                success: false,
                error: `Payment status: ${txn.status}`,
                data: {
                    reference: txn.reference,
                    status: txn.status,
                    gatewayResponse: txn.gateway_response
                }
            });
        }
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ success: false, error: 'Transaction reference not found' });
        }
        next(error);
    }
};

// ── Webhook Handler ─────────────────────────────────────────────

/**
 * @route   POST /api/v1/payments/webhook
 * @access  Public (Paystack IP verified via HMAC signature)
 */
const handleWebhook = async (req, res) => {
    try {
        // Verify webhook signature
        const hash = crypto
            .createHmac('sha512', PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (hash !== req.headers['x-paystack-signature']) {
            logger.warn('Webhook signature mismatch');
            return res.status(401).send('Invalid signature');
        }

        const event = req.body;

        logger.info('Paystack webhook received', { event: event.event, reference: event.data?.reference });

        if (event.event === 'charge.success') {
            const orderId = event.data.metadata?.orderId;

            if (!orderId) {
                logger.error('Webhook charge.success missing orderId', { reference: event.data.reference });
                return res.status(200).send('OK'); // Respond 200 so Paystack doesn't retry
            }

            await fulfillPayment(orderId, event.data);
        }

        // Always respond 200 so Paystack knows we received it
        res.status(200).send('OK');
    } catch (error) {
        logger.error('Webhook processing error', { error: error.message });
        res.status(200).send('OK'); // Still 200 — we log the error and handle manually
    }
};

// ── Charge Authorization (for recurring / saved cards) ──────────

/**
 * @route   POST /api/v1/payments/charge
 * @access  Private
 * @body    { orderId, authorizationCode }
 *
 * Charges a previously-saved authorization (e.g. returning customer).
 * Not required for first-time MoMo/card payments.
 */
const chargeAuthorization = async (req, res, next) => {
    try {
        const { orderId, authorizationCode } = req.body;

        if (!orderId || !authorizationCode) {
            return res.status(400).json({ success: false, error: 'orderId and authorizationCode are required' });
        }

        const order = await repositories.orders.getOrderDetails(orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        if (order.buyer_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'You cannot pay for this order' });
        }

        // Resolve email
        let email = order.buyer?.email;
        if (!email) {
            const user = await repositories.users.findById(order.buyer_id);
            email = user?.email;
        }

        const totalAmount = parseFloat(order.total_amount);
        const amountInPesewas = Math.round(totalAmount * 100);

        const response = await axios.post(
            `${PAYSTACK_BASE_URL}/transaction/charge_authorization`,
            {
                authorization_code: authorizationCode,
                email,
                amount: amountInPesewas,
                currency: 'GHS',
                metadata: { orderId, userId: req.user.id }
            },
            { headers: paystackHeaders() }
        );

        const txn = response.data.data;

        if (txn.status === 'success') {
            await fulfillPayment(orderId, txn);
            return res.status(200).json({ success: true, message: 'Payment charged successfully', data: txn });
        }

        res.status(400).json({ success: false, error: txn.gateway_response || 'Charge failed' });
    } catch (error) {
        if (error.response) {
            return res.status(error.response.status).json({
                success: false,
                error: error.response.data?.message || 'Charge failed'
            });
        }
        next(error);
    }
};

module.exports = {
    initializePayment,
    verifyPayment,
    handleWebhook,
    chargeAuthorization
};
