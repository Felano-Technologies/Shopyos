const { validationResult } = require('express-validator');

/**
 * Middleware to check for validation errors and return them
 */
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        // Generate an error that the errorHandler can catch
        const err = new Error('Validation Error');
        err.name = 'ValidationError';
        
        // Match the shape expected by errorHandler.js
        err.errors = errors.array().reduce((acc, current, index) => {
            acc[index] = { message: current.msg };
            return acc;
        }, {});
        
        return next(err);
    }
    
    next();
};

module.exports = { validateRequest };
