// controllers/paymentController.js
const axios = require('axios');
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/**
 * Initialize Paystack Payment
 * @route   POST /api/v1/payments/initialize
 * @access  Private
 */
const initializePayment = async (req, res, next) => {
    try {
        let { orderId, email } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, error: 'OrderId is required' });
        }

        // Fetch order to get the correct amount
        const order = await repositories.orders.getOrderDetails(orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        // Use order total amount
        const totalAmount = parseFloat(order.total_amount);
        const amountInKobo = Math.round(totalAmount * 100);

        // Get email from order/user if not provided
        if (!email && order.buyer?.email) {
            email = order.buyer.email;
        }

        if (!email && order.buyer_id) {
            const user = await repositories.users.findById(order.buyer_id);
            email = user?.email;
        }

        if (!email) {
            return res.status(400).json({ success: false, error: 'Customer email is required' });
        }

        const response = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email,
                amount: amountInKobo,
                metadata: {
                    orderId,
                    custom_fields: [
                        {
                            display_name: "Order Number",
                            variable_name: "order_number",
                            value: order.order_number
                        }
                    ]
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.data.status) {
            // Update payment record with reference
            await repositories.orders.db
                .from('payments')
                .update({
                    provider_transaction_id: response.data.data.reference,
                    payment_provider: 'paystack'
                })
                .eq('order_id', orderId);

            res.status(200).json({
                success: true,
                data: response.data.data
            });
        } else {
            res.status(400).json({ success: false, error: response.data.message });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Verify Paystack Payment
 * @route   GET /api/v1/payments/verify/:reference
 * @access  Private
 */
const verifyPayment = async (req, res, next) => {
    try {
        const { reference } = req.params;

        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                },
            }
        );

        if (response.data.status && response.data.data.status === 'success') {
            const orderId = response.data.data.metadata.orderId;
            const amountPaid = response.data.data.amount / 100;

            // Update payment status
            await repositories.orders.db
                .from('payments')
                .update({
                    status: 'completed',
                    paid_at: new Date().toISOString(),
                    payment_details: response.data.data
                })
                .eq('order_id', orderId);

            // Update order status
            await repositories.orders.updateStatus(orderId, 'paid');

            // Add to store balance
            const order = await repositories.orders.findById(orderId);
            if (order && order.store_id) {
                // Logic to update store balance should go here
                // Usually handled in a service or repository
                const store = await repositories.stores.findById(order.store_id);
                if (store) {
                    const newBalance = parseFloat(store.current_balance || 0) + parseFloat(amountPaid);
                    await repositories.stores.update(store.id, { current_balance: newBalance });

                    // Create balance log
                    await repositories.orders.db.from('balance_logs').insert({
                        store_id: store.id,
                        amount: amountPaid,
                        transaction_type: 'sale',
                        order_id: order.id,
                        balance_after: newBalance
                    });
                }
            }

            res.status(200).json({
                success: true,
                message: 'Payment verified successfully',
                data: response.data.data
            });
        } else {
            res.status(400).json({ success: false, error: 'Payment verification failed' });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Handle Paystack Webhook
 * @route   POST /api/v1/payments/webhook
 * @access  Public
 */
const handleWebhook = async (req, res, next) => {
    // In a production app, you should verify the signature (x-paystack-signature)
    // For now, we'll implement the basic logic
    const event = req.body;

    if (event.event === 'charge.success') {
        const reference = event.data.reference;
        const orderId = event.data.metadata.orderId;

        // This is a duplicated logic of verifyPayment but triggered by Paystack
        // Check if already completed to avoid double counting
        const { data: existingPayment } = await repositories.orders.db
            .from('payments')
            .select('status')
            .eq('order_id', orderId)
            .single();

        if (existingPayment && existingPayment.status !== 'completed') {
            await repositories.orders.db
                .from('payments')
                .update({
                    status: 'completed',
                    paid_at: new Date().toISOString(),
                    payment_details: event.data
                })
                .eq('order_id', orderId);

            await repositories.orders.updateStatus(orderId, 'paid');

            // Update store balance logic...
        }
    }

    res.status(200).send('OK');
};

module.exports = {
    initializePayment,
    verifyPayment,
    handleWebhook
};
