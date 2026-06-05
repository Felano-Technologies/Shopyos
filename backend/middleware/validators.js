const { body, query } = require('express-validator');
const { validateRequest } = require('./validateRequest');

// Local executeValidation is now replaced by centralized validateRequest

const validateRegister = [
    body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    validateRequest
];

const validateLogin = [
    body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest
];

const validateCreateProduct = [
    body('storeId').isUUID().withMessage('Store ID must be a valid UUID'),
    body('name').optional().isString().isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters').trim(),
    body('title').optional().isString().isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters').trim(),
    body().custom((value, { req }) => {
        if (!req.body.name && !req.body.title) {
            throw new Error('Either name or title is required');
        }
        return true;
    }),
    body('price').isFloat({ gt: 0 }).withMessage('Price must be a positive number'),
    validateRequest
];

const validateCreateOrder = [
    body('deliveryAddress').notEmpty().withMessage('Delivery address is required').trim(),
    body('deliveryCity').notEmpty().withMessage('Delivery city is required').trim(),
    body('deliveryPhone').notEmpty().withMessage('Delivery phone is required').isMobilePhone('any').withMessage('Must be a valid phone number'),
    validateRequest
];

const validateSearch = [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a positive integer'),
    query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a positive number'),
    query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a positive number'),
    validateRequest
];

const validateAddToCart = [
    body('productId').isUUID().withMessage('Product ID must be a valid UUID'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    validateRequest
];

const validateInitializePayment = [
    body('orderId').isUUID().withMessage('Order ID must be a valid UUID'),
    body('email').optional().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    validateRequest
];

const validateStartConversation = [
    body('participantId').custom((val) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      if (!isUuid) {
        throw new Error('Participant ID must be a valid UUID');
      }
      return true;
    }),
    validateRequest
];

const validateRequestPayout = [
    body('storeId').isUUID().withMessage('Store ID must be a valid UUID'),
    body('amount').isFloat({ gt: 0 }).withMessage('Payout amount must be a positive number'),
    body('bankCode').notEmpty().withMessage('Bank code is required').trim(),
    body('accountNumber').notEmpty().withMessage('Account number is required').trim(),
    validateRequest
];

module.exports = {
    validateRegister,
    validateLogin,
    validateCreateProduct,
    validateCreateOrder,
    validateSearch,
    validateAddToCart,
    validateInitializePayment,
    validateStartConversation,
    validateRequestPayout
};
