// controllers/paymentController.js
const crypto = require('node:crypto');
const axios = require('axios');
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const feeConfigService = require('../services/feeConfigService');
const ApiResponse = require('../utils/apiResponse');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const paystackHeaders = () => ({
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
});

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

    // Update order status to paid, and mark escrow as HELD
    await repositories.orders.db
        .from('orders')
        .update({ status: 'paid', escrow_status: 'HELD', updated_at: now })
        .eq('id', orderId);

    // Note: We DO NOT credit the store balance here anymore.
    // Funds are held in escrow until the buyer confirms delivery.

    const order = await repositories.orders.findById(orderId);

    // Notify buyer
    if (order) {
        await repositories.notifications.create({
            user_id: order.buyer_id,
            type: 'order_placed',
            title: 'Payment Confirmed',
            message: `Payment of â‚µ${amountPaid.toFixed(2)} for order #${order.order_number} confirmed.`,
            data: { orderId: order.id, orderNumber: order.order_number, amount: amountPaid }
        }).catch(err => logger.error('Notification failed', { error: err.message }));
    }

    logger.info('Payment fulfilled, funds held in escrow', { orderId, amount: amountPaid, channel });
    return true;
};

// â”€â”€ Initialize Payment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * @route   POST /api/v1/payments/initialize
 * @access  Private
 * @body    { orderId, email?, channel?, momoPhone?, momoProvider? }
 *
 * channel can be: 'card', 'mobile_money', or omitted (Paystack default picker)
 * For MoMo: pass momoPhone and momoProvider (mtn, vod, tgo)
 */
async function resolvePaymentEmail(clientEmail, order, userRepo) {
    if (clientEmail) return clientEmail;
    if (order.buyer?.email) return order.buyer.email;
    const user = await userRepo.findById(order.buyer_id);
    return user?.email;
}

function applyChannelConfig(payload, channel, momoPhone, momoProvider) {
    if (channel === 'mobile_money') {
        payload.channels = ['mobile_money'];
        if (momoPhone && momoProvider) {
            payload.mobile_money = { phone: momoPhone, provider: momoProvider };
        }
    } else if (channel === 'card') {
        payload.channels = ['card'];
    }
}

const initializePayment = async (req, res, next) => {
    try {
        const { orderId, email: clientEmail, channel, momoPhone, momoProvider, callbackUrl } = req.body;

        if (!orderId) {
            return ApiResponse.error(res, 'orderId is required', 400);
        }

        // Fetch order — amount MUST come from DB, never from client
        const order = await repositories.orders.getOrderDetails(orderId);
        if (!order) {
            return ApiResponse.error(res, 'Order not found', 404);
        }

        if (order.buyer_id !== req.user.id) {
            return ApiResponse.error(res, 'You cannot pay for this order', 403);
        }

        // Prevent double-pay
        const { data: existingPayment } = await repositories.orders.db
            .from('payments')
            .select('status')
            .eq('order_id', orderId)
            .single();

        if (existingPayment?.status === 'completed') {
            return ApiResponse.error(res, 'This order has already been paid', 400);
        }

        const email = await resolvePaymentEmail(clientEmail, order, repositories.users);
        if (!email) {
            return ApiResponse.error(res, 'Customer email is required', 400);
        }

        const totalAmount = Number.parseFloat(order.total_amount);
        const amountInPesewas = Math.round(totalAmount * 100);

        // Build Paystack payload
        const payload = {
            email,
            amount: amountInPesewas,
            currency: 'GHS',
            callback_url: callbackUrl || undefined,
            metadata: {
                orderId,
                userId: req.user.id,
                custom_fields: [
                    { display_name: 'Order Number', variable_name: 'order_number', value: order.order_number }
                ]
            }
        };

        applyChannelConfig(payload, channel, momoPhone, momoProvider);

        const response = await axios.post(
            `${PAYSTACK_BASE_URL}/transaction/initialize`,
            payload,
            { headers: paystackHeaders() }
        );

        if (!response.data.status) {
            return ApiResponse.error(res, response.data.message || 'Failed to initialize payment', 400);
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

        ApiResponse.success(res, {
            authorization_url: response.data.data.authorization_url,
            access_code: response.data.data.access_code,
            reference: response.data.data.reference
        });
    } catch (error) {
        if (error.response) {
            logger.error('Paystack initialize error', {
                status: error.response.status,
                data: error.response.data
            });
            return ApiResponse.error(res, error.response.data?.message || 'Payment provider error', error.response.status);
        }
        next(error);
    }
};

// â”€â”€ Verify Payment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * @route   GET /api/v1/payments/verify/:reference
 * @access  Private
 */
const verifyPayment = async (req, res, next) => {
    try {
        const { reference } = req.params;

        if (!reference) {
            return ApiResponse.error(res, 'Payment reference is required', 400);
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
                return ApiResponse.error(res, 'Cannot determine order from this transaction', 400);
            }

            const fulfilled = await fulfillPayment(orderId, txn);

            ApiResponse.success(res, {
                reference: txn.reference,
                amount: txn.amount / 100,
                currency: txn.currency,
                channel: txn.channel,
                status: txn.status,
                paidAt: txn.paid_at
            }, fulfilled ? 'Payment verified and order updated' : 'Payment already confirmed');
        } else {
            // Transaction exists but is not successful
            ApiResponse.success(res, {
                reference: txn.reference,
                status: txn.status,
                gatewayResponse: txn.gateway_response
            }, `Payment status: ${txn.status}`);
        }
    } catch (error) {
        if (error.response?.status === 404) {
            return ApiResponse.error(res, 'Transaction reference not found', 404);
        }
        next(error);
    }
};

// â”€â”€ Webhook Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * @route   POST /api/v1/payments/webhook
 * @access  Public (Paystack IP verified via HMAC signature)
 */
const handleWebhook = async (req, res) => {
    try {
        // Verify webhook signature using the raw body buffer
        // express.raw({ type: 'application/json' }) ensures req.body is a Buffer
        const rawBody = req.body;
        if (!Buffer.isBuffer(rawBody)) {
            logger.warn('Webhook received non-buffer body — ensure express.raw() middleware is applied');
            return res.status(400).send('Invalid payload format');
        }

        const hash = crypto
            .createHmac('sha512', PAYSTACK_SECRET_KEY)
            .update(rawBody)
            .digest('hex');

        if (hash !== req.headers['x-paystack-signature']) {
            logger.warn('Webhook signature mismatch');
            return res.status(401).send('Invalid signature');
        }

        const event = JSON.parse(rawBody);

        logger.info('Paystack webhook received', { event: event.event, reference: event.data?.reference });

        if (event.event === 'charge.success') {
            const metadataType = event.data.metadata?.type;

            if (metadataType === 'listing_fee') {
                const storeId = event.data.metadata?.storeId;
                if (!storeId) {
                    logger.error('Webhook charge.success missing storeId for listing_fee', { reference: event.data.reference });
                    return res.status(200).send('OK');
                }

                // Update store listing tier
                await repositories.stores.update(storeId, {
                    listing_tier: 'paid',
                    listing_fee_paid_at: new Date().toISOString(),
                    listing_fee_reference: event.data.reference
                });

                logger.info('Listing fee fulfilled', { storeId, reference: event.data.reference });
            } else {
                const orderId = event.data.metadata?.orderId;

                if (!orderId) {
                    logger.error('Webhook charge.success missing orderId', { reference: event.data.reference });
                    return res.status(200).send('OK');
                }

                await fulfillPayment(orderId, event.data);
            }
        } else if (event.event === 'transfer.success' || event.event === 'transfer.failed') {
            const reference = event.data?.reference;
            if (reference) {
                const payout = await repositories.payouts.findByTransactionReference(reference);
                if (payout) {
                    const newStatus = event.event === 'transfer.success' ? 'completed' : 'failed';
                    await repositories.payouts.updatePayoutStatus(payout.id, newStatus, {
                        notes: event.event === 'transfer.success'
                            ? 'Transfer confirmed by Paystack'
                            : `Transfer failed: ${event.data?.gateway_response || 'unknown reason'}`
                    });

                    if (event.event === 'transfer.failed') {
                        const { _refundPayoutBalance } = require('./payoutController');
                        await _refundPayoutBalance(payout).catch(e =>
                            logger.error('[Webhook] refund after failed transfer error:', e.message)
                        );
                    }

                    logger.info(`[Webhook] Payout ${payout.id} → ${newStatus}`, { reference });
                } else {
                    logger.warn('[Webhook] transfer event received for unknown reference', { reference });
                }
            }
        }

        // Always respond 200 so Paystack knows we received it
        res.status(200).send('OK');
    } catch (error) {
        logger.error('Webhook processing error', { error: error.message });
        res.status(200).send('OK'); // Still 200 â€” we log the error and handle manually
    }
};

// â”€â”€ Charge Authorization (for recurring / saved cards) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            return ApiResponse.error(res, 'orderId and authorizationCode are required', 400);
        }

        const order = await repositories.orders.getOrderDetails(orderId);
        if (!order) {
            return ApiResponse.error(res, 'Order not found', 404);
        }

        if (order.buyer_id !== req.user.id) {
            return ApiResponse.error(res, 'You cannot pay for this order', 403);
        }

        // Resolve email
        let email = order.buyer?.email;
        if (!email) {
            const user = await repositories.users.findById(order.buyer_id);
            email = user?.email;
        }

        const totalAmount = Number.parseFloat(order.total_amount);
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
            return ApiResponse.success(res, txn, 'Payment charged successfully');
        }

        ApiResponse.error(res, txn.gateway_response || 'Charge failed', 400);
    } catch (error) {
        if (error.response) {
            return ApiResponse.error(res, error.response.data?.message || 'Charge failed', error.response.status);
        }
        next(error);
    }
};

/**
 * @route   POST /api/v1/payments/listing-fee/initialize
 * @access  Private
 * @body    { storeId, email, channel, momoPhone, momoProvider }
 */
const initializeListingFee = async (req, res, next) => {
    try {
        const { storeId, email, channel, momoPhone, momoProvider } = req.body;

        if (!storeId || !email) {
            return ApiResponse.error(res, 'storeId and email are required', 400);
        }

        const store = await repositories.stores.findById(storeId);
        if (!store) return ApiResponse.error(res, 'Store not found', 404);
        if (store.owner_id !== req.user.id) return ApiResponse.error(res, 'Not authorized', 403);

        if (store.listing_tier === 'paid') {
            return ApiResponse.error(res, 'Listing fee already paid for this store', 400);
        }

        const listingFeeGHS = Number(await feeConfigService.get('listing_fee_amount'));
        const amountInPesewas = listingFeeGHS * 100;

        const payload = {
            email,
            amount: amountInPesewas,
            currency: 'GHS',
            metadata: {
                type: 'listing_fee',
                storeId,
                userId: req.user.id
            }
        };

        if (channel === 'mobile_money') {
            payload.channels = ['mobile_money'];
            if (momoPhone && momoProvider) {
                payload.mobile_money = { phone: momoPhone, provider: momoProvider };
            }
        } else if (channel === 'card') {
            payload.channels = ['card'];
        }

        const response = await axios.post(
            `${PAYSTACK_BASE_URL}/transaction/initialize`,
            payload,
            { headers: paystackHeaders() }
        );

        if (!response.data.status) {
            return ApiResponse.error(res, response.data.message || 'Failed to initialize payment', 400);
        }

        ApiResponse.success(res, {
            authorization_url: response.data.data.authorization_url,
            access_code: response.data.data.access_code,
            reference: response.data.data.reference
        });
    } catch (error) {
        if (error.response) {
            return ApiResponse.error(res, error.response.data?.message || 'Payment provider error', error.response.status);
        }
        next(error);
    }
};

module.exports = {
    initializePayment,
    verifyPayment,
    handleWebhook,
    chargeAuthorization,
    initializeListingFee
};
