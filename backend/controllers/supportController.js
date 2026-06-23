// controllers/supportController.js
const { getPool } = require('../config/postgres');
const { logger } = require('../config/logger');

const VALID_CATEGORIES = [
  'order_issue', 'delivery_issue', 'product_issue', 'payment_issue',
  'driver_issue', 'parcel_partner_issue', 'platform_issue', 'other',
];
const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const VALID_ROLES = ['buyer', 'seller', 'driver', 'parcel_partner'];

// POST /api/v1/support/tickets
const createTicket = async (req, res, next) => {
  try {
    const db = getPool();
    const reporterId = req.user.id;
    const { reporter_role, category, subject, description, entity_type, entity_id } = req.body;

    if (!VALID_ROLES.includes(reporter_role)) {
      return res.status(400).json({ success: false, message: 'Invalid reporter_role' });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }
    if (!subject?.trim() || !description?.trim()) {
      return res.status(400).json({ success: false, message: 'subject and description are required' });
    }
    if (description.trim().length < 20) {
      return res.status(400).json({ success: false, message: 'description must be at least 20 characters' });
    }

    const { rows } = await db.query(
      `INSERT INTO support_tickets
         (reporter_id, reporter_role, category, subject, description, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [reporterId, reporter_role, category, subject.trim(), description.trim(), entity_type || null, entity_id || null]
    );

    res.status(201).json({ success: true, ticket: rows[0] });
  } catch (error) {
    logger.error(`createTicket error: ${error.message}`);
    next(error);
  }
};

// GET /api/v1/support/tickets/mine
const getMyTickets = async (req, res, next) => {
  try {
    const db = getPool();
    const reporterId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const { rows } = await db.query(
      `SELECT id, category, subject, description, entity_type, entity_id,
              status, priority, admin_notes, created_at, updated_at
       FROM support_tickets
       WHERE reporter_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [reporterId, limit, offset]
    );

    const { rows: countRows } = await db.query(
      'SELECT COUNT(*) FROM support_tickets WHERE reporter_id = $1',
      [reporterId]
    );

    res.json({
      success: true,
      tickets: rows,
      total: parseInt(countRows[0].count),
      page,
      pages: Math.ceil(parseInt(countRows[0].count) / limit),
    });
  } catch (error) {
    logger.error(`getMyTickets error: ${error.message}`);
    next(error);
  }
};

// GET /api/v1/admin/support/tickets
const adminGetTickets = async (req, res, next) => {
  try {
    const db = getPool();
    const { status, category, reporter_role, page: pageParam } = req.query;
    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = 25;
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (status && VALID_STATUSES.includes(status)) {
      conditions.push(`st.status = $${idx++}`);
      params.push(status);
    }
    if (category && VALID_CATEGORIES.includes(category)) {
      conditions.push(`st.category = $${idx++}`);
      params.push(category);
    }
    if (reporter_role && VALID_ROLES.includes(reporter_role)) {
      conditions.push(`st.reporter_role = $${idx++}`);
      params.push(reporter_role);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT st.*,
              up.full_name AS reporter_name,
              up.avatar_url AS reporter_avatar
       FROM support_tickets st
       LEFT JOIN user_profiles up ON up.user_id = st.reporter_id
       ${where}
       ORDER BY st.priority DESC, st.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) FROM support_tickets st ${where}`,
      params
    );

    res.json({
      success: true,
      tickets: rows,
      total: parseInt(countRows[0].count),
      page,
      pages: Math.ceil(parseInt(countRows[0].count) / limit),
    });
  } catch (error) {
    logger.error(`adminGetTickets error: ${error.message}`);
    next(error);
  }
};

// PATCH /api/v1/admin/support/tickets/:id
const adminUpdateTicket = async (req, res, next) => {
  try {
    const db = getPool();
    const { id } = req.params;
    const adminId = req.user.id;
    const { status, priority, admin_notes } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    if (priority !== undefined && (priority < 1 || priority > 3)) {
      return res.status(400).json({ success: false, message: 'priority must be 1, 2, or 3' });
    }

    const isResolving = status === 'resolved' || status === 'closed';

    const { rows } = await db.query(
      `UPDATE support_tickets SET
         status       = COALESCE($1::ticket_status, status),
         priority     = COALESCE($2, priority),
         admin_notes  = COALESCE($3, admin_notes),
         resolved_by  = CASE WHEN $4 THEN $5::uuid ELSE resolved_by END,
         resolved_at  = CASE WHEN $4 THEN NOW() ELSE resolved_at END,
         updated_at   = NOW()
       WHERE id = $6
       RETURNING *`,
      [status || null, priority || null, admin_notes || null, isResolving, adminId, id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    res.json({ success: true, ticket: rows[0] });
  } catch (error) {
    logger.error(`adminUpdateTicket error: ${error.message}`);
    next(error);
  }
};

module.exports = { createTicket, getMyTickets, adminGetTickets, adminUpdateTicket };
