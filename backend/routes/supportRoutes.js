// routes/supportRoutes.js
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { createTicket, getMyTickets, adminGetTickets, adminUpdateTicket } = require('../controllers/supportController');

// Authenticated user routes
router.post('/tickets', protect, createTicket);
router.get('/tickets/mine', protect, getMyTickets);

// Admin-only routes
router.get('/admin/tickets', protect, admin, adminGetTickets);
router.patch('/admin/tickets/:id', protect, admin, adminUpdateTicket);

module.exports = router;
