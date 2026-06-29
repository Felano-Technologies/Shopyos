// controllers/paymentMethodController.js
const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');

const getPaymentMethods = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const methods = await repositories.paymentMethods.findByUserId(userId);
        ApiResponse.success(res, methods);
    } catch (error) {
        next(error);
    }
};

const addPaymentMethod = async (req, res, next) => {
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

        ApiResponse.created(res, method);
    } catch (error) {
        next(error);
    }
};

const deletePaymentMethod = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        // Verify ownership
        const method = await repositories.paymentMethods.findById(id);
        if (!method || method.user_id !== userId) {
            return ApiResponse.error(res, 'Payment method not found', 404);
        }

        await repositories.paymentMethods.delete(id);
        ApiResponse.success(res, null, 'Payment method deleted');
    } catch (error) {
        next(error);
    }
};

const setDefaultMethod = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const method = await repositories.paymentMethods.setDefault(userId, id);
        ApiResponse.success(res, method);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getPaymentMethods,
    addPaymentMethod,
    deletePaymentMethod,
    setDefaultMethod
};
