// controllers/paymentMethodController.js
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

const getPaymentMethods = async (req, res) => {
    try {
        const userId = req.user.id;
        const methods = await repositories.paymentMethods.findByUserId(userId);
        res.status(200).json({ success: true, data: methods });
    } catch (error) {
        logger.error('Get payment methods error:', { error: error.message });
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

const addPaymentMethod = async (req, res) => {
    try {
        const userId = req.user.id;
        const { type, provider, title, identifier, is_default } = req.body;

        const method = await repositories.paymentMethods.create({
            user_id: userId,
            type,
            provider,
            title,
            identifier,
            is_default: !!is_default
        });

        res.status(201).json({ success: true, data: method });
    } catch (error) {
        logger.error('Add payment method error:', { error: error.message });
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

const deletePaymentMethod = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        // Verify ownership
        const method = await repositories.paymentMethods.findById(id);
        if (!method || method.user_id !== userId) {
            return res.status(404).json({ success: false, error: 'Payment method not found' });
        }

        await repositories.paymentMethods.delete(id);
        res.status(200).json({ success: true, message: 'Payment method deleted' });
    } catch (error) {
        logger.error('Delete payment method error:', { error: error.message });
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

const setDefaultMethod = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const method = await repositories.paymentMethods.setDefault(userId, id);
        res.status(200).json({ success: true, data: method });
    } catch (error) {
        logger.error('Set default payment method error:', { error: error.message });
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

module.exports = {
    getPaymentMethods,
    addPaymentMethod,
    deletePaymentMethod,
    setDefaultMethod
};
