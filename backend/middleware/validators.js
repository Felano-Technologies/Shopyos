const { body, query, param, validationResult } = require('express-validator');

// Create a middleware that actually runs the validation result check
const executeValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Generate an error that the errorHandler can catch
        const err = new Error('Validation Error');
        err.name = 'ValidationError';
        // Match the shape expected by errorHandler.js: Object.values(err.errors).map(e => e.message)
        err.errors = errors.array().reduce((acc, current, index) => {
            acc[index] = { message: current.msg };
            return acc;
        }, {});
        return next(err);
    }
    next();
};

const validateRegister = [
    body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('name').notEmpty().withMessage('Name is required').trim(),
    executeValidation
];

const validateLogin = [
    body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    executeValidation
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
    executeValidation
];

const validateCreateOrder = [
    body('deliveryAddress').notEmpty().withMessage('Delivery address is required').trim(),
    body('deliveryCity').notEmpty().withMessage('Delivery city is required').trim(),
    body('deliveryPhone').notEmpty().withMessage('Delivery phone is required').isMobilePhone('any').withMessage('Must be a valid phone number'),
    executeValidation
];

const validateSearch = [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a positive integer'),
    query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a positive number'),
    query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a positive number'),
    executeValidation
];

const validateAddToCart = [
    body('productId').isUUID().withMessage('Product ID must be a valid UUID'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    executeValidation
];

module.exports = {
    validateRegister,
    validateLogin,
    validateCreateProduct,
    validateCreateOrder,
    validateSearch,
    validateAddToCart
};
