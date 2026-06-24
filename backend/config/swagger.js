const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Shopyos API',
      version: '1.0.0',
      description: 'Shopyos ecommerce REST API — all endpoints, fully documented.',
    },
    servers: [
      ...(process.env.SWAGGER_URL ? [{ url: process.env.SWAGGER_URL, description: 'Ngrok tunnel' }] : []),
      { url: `http://localhost:${process.env.PORT || 5000}`, description: 'Development' },
      { url: 'https://api.yourdomain.com', description: 'Production' },
    ],
    tags: [
      { name: 'Admin' },
      { name: 'Advertising' },
      { name: 'Auth' },
      { name: 'Business' },
      { name: 'Cart' },
      { name: 'Categories' },
      { name: 'Delivery' },
      { name: 'Delivery Fee' },
      { name: 'Favorites' },
      { name: 'Flash Sales' },
      { name: 'Loyalty' },
      { name: 'Messaging' },
      { name: 'Notifications' },
      { name: 'Orders' },
      { name: 'Payment Methods' },
      { name: 'Payments' },
      { name: 'Payouts' },
      { name: 'Products' },
      { name: 'Promo' },
      { name: 'Recommendations' },
      { name: 'Returns' },
      { name: 'Reviews' },
      { name: 'Snaps' },
      { name: 'Upload' },
      { name: 'User Actions' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token (obtained from /api/v1/auth/login)',
        },
      },
    },
  },
  apis: [require('path').resolve(__dirname, '../routes').replace(/\\/g, '/') + '/*.js'],
};

module.exports = swaggerJsdoc(options);
