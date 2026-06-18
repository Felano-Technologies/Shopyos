// controllers/adminExportController.js
// Generic export handler for admin list screens (XLSX + CSV)

const ExcelJS = require('exceljs');
const { format: csvFormat } = require('fast-csv');
const { getPool } = require('../config/postgres');

const MAX_ROWS = 50_000;

// ─── Column definitions per resource ─────────────────────────────────────────
const RESOURCE_CONFIG = {
  users: {
    sql: (filters, params) => {
      const conds = ['u.deleted_at IS NULL'];
      if (filters.role)    { params.push(filters.role);   conds.push(`r.name = $${params.length}`); }
      if (filters.status)  { params.push(filters.status === 'active'); conds.push(`u.is_active = $${params.length}`); }
      if (filters.search)  { params.push(`%${filters.search}%`); conds.push(`(u.email ILIKE $${params.length} OR up.full_name ILIKE $${params.length})`); }
      if (filters.startDate) { params.push(filters.startDate); conds.push(`u.created_at >= $${params.length}`); }
      if (filters.endDate)   { params.push(filters.endDate);   conds.push(`u.created_at <= $${params.length}`); }
      return `SELECT u.id, up.full_name AS "Name", u.email AS "Email", up.phone AS "Phone",
                     r.name AS "Role", CASE WHEN u.is_active THEN 'Active' ELSE 'Inactive' END AS "Status",
                     u.created_at AS "Joined"
              FROM users u
              LEFT JOIN user_profiles up ON up.user_id = u.id
              LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = TRUE
              LEFT JOIN roles r ON r.id = ur.role_id
              WHERE ${conds.join(' AND ')}
              ORDER BY u.created_at DESC LIMIT ${MAX_ROWS}`;
    },
    columns: ['Name', 'Email', 'Phone', 'Role', 'Status', 'Joined'],
  },

  orders: {
    sql: (filters, params) => {
      const conds = ['1=1'];
      if (filters.status)  { params.push(filters.status); conds.push(`o.status = $${params.length}`); }
      if (filters.storeId) { params.push(filters.storeId); conds.push(`o.store_id = $${params.length}`); }
      if (filters.startDate) { params.push(filters.startDate); conds.push(`o.created_at >= $${params.length}`); }
      if (filters.endDate)   { params.push(filters.endDate);   conds.push(`o.created_at <= $${params.length}`); }
      return `SELECT o.order_number AS "Order #", up.full_name AS "Buyer",
                     s.store_name AS "Store", o.total_amount AS "Total (GHS)",
                     o.status AS "Status", o.created_at AS "Date"
              FROM orders o
              LEFT JOIN user_profiles up ON up.user_id = o.buyer_id
              LEFT JOIN stores s ON s.id = o.store_id
              WHERE ${conds.join(' AND ')}
              ORDER BY o.created_at DESC LIMIT ${MAX_ROWS}`;
    },
    columns: ['Order #', 'Buyer', 'Store', 'Total (GHS)', 'Status', 'Date'],
  },

  'audit-logs': {
    sql: (filters, params) => {
      const conds = ['1=1'];
      if (filters.role)    { params.push(filters.role);   conds.push(`r.name = $${params.length}`); }
      if (filters.status)  { params.push(filters.status); conds.push(`al.status = $${params.length}`); }
      if (filters.action)  { params.push(filters.action); conds.push(`al.action = $${params.length}`); }
      if (filters.startDate) { params.push(filters.startDate); conds.push(`al.created_at >= $${params.length}`); }
      if (filters.endDate)   { params.push(filters.endDate);   conds.push(`al.created_at <= $${params.length}`); }
      return `SELECT al.created_at AS "Timestamp", up.full_name AS "Actor Name",
                     r.name AS "Role", al.action AS "Action", al.entity_type AS "Entity Type",
                     al.entity_id AS "Entity ID", al.status AS "Status",
                     al.failure_reason AS "Failure Reason"
              FROM audit_logs al
              LEFT JOIN user_profiles up ON up.user_id = al.user_id
              LEFT JOIN user_roles ur ON ur.user_id = al.user_id AND ur.is_active = TRUE
              LEFT JOIN roles r ON r.id = ur.role_id
              WHERE ${conds.join(' AND ')}
              ORDER BY al.created_at DESC LIMIT ${MAX_ROWS}`;
    },
    columns: ['Timestamp', 'Actor Name', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Status', 'Failure Reason'],
  },

  stores: {
    sql: (filters, params) => {
      const conds = ['1=1'];
      if (filters.verification_status) { params.push(filters.verification_status); conds.push(`s.verification_status = $${params.length}`); }
      if (filters.search)  { params.push(`%${filters.search}%`); conds.push(`s.store_name ILIKE $${params.length}`); }
      if (filters.startDate) { params.push(filters.startDate); conds.push(`s.created_at >= $${params.length}`); }
      if (filters.endDate)   { params.push(filters.endDate);   conds.push(`s.created_at <= $${params.length}`); }
      return `SELECT s.store_name AS "Store Name", up.full_name AS "Owner",
                     s.category AS "Category", s.city AS "City",
                     s.verification_status AS "Verification Status",
                     COUNT(p.id) AS "Products", s.created_at AS "Created"
              FROM stores s
              LEFT JOIN user_profiles up ON up.user_id = s.owner_id
              LEFT JOIN products p ON p.store_id = s.id
              WHERE ${conds.join(' AND ')}
              GROUP BY s.id, up.full_name
              ORDER BY s.created_at DESC LIMIT ${MAX_ROWS}`;
    },
    columns: ['Store Name', 'Owner', 'Category', 'City', 'Verification Status', 'Products', 'Created'],
  },

  revenue: {
    sql: (filters, params) => {
      const conds = ['1=1'];
      if (filters.storeId) { params.push(filters.storeId); conds.push(`o.store_id = $${params.length}`); }
      if (filters.startDate) { params.push(filters.startDate); conds.push(`p.created_at >= $${params.length}`); }
      if (filters.endDate)   { params.push(filters.endDate);   conds.push(`p.created_at <= $${params.length}`); }
      return `SELECT p.created_at AS "Date", s.store_name AS "Store",
                     p.amount AS "Amount (GHS)",
                     ROUND(p.amount * 0.05, 2) AS "Platform Fee (GHS)",
                     ROUND(p.amount * 0.95, 2) AS "Seller Payout (GHS)",
                     p.status AS "Status"
              FROM payments p
              LEFT JOIN orders o ON o.id = p.order_id
              LEFT JOIN stores s ON s.id = o.store_id
              WHERE ${conds.join(' AND ')}
              ORDER BY p.created_at DESC LIMIT ${MAX_ROWS}`;
    },
    columns: ['Date', 'Store', 'Amount (GHS)', 'Platform Fee (GHS)', 'Seller Payout (GHS)', 'Status'],
  },

  payouts: {
    sql: (filters, params) => {
      const conds = ['1=1'];
      if (filters.status) { params.push(filters.status); conds.push(`po.status = $${params.length}`); }
      if (filters.startDate) { params.push(filters.startDate); conds.push(`po.created_at >= $${params.length}`); }
      if (filters.endDate)   { params.push(filters.endDate);   conds.push(`po.created_at <= $${params.length}`); }
      return `SELECT s.store_name AS "Store", po.amount AS "Amount (GHS)",
                     po.status AS "Status", po.created_at AS "Requested",
                     po.processed_at AS "Processed"
              FROM payouts po
              LEFT JOIN stores s ON s.id = po.store_id
              WHERE ${conds.join(' AND ')}
              ORDER BY po.created_at DESC LIMIT ${MAX_ROWS}`;
    },
    columns: ['Store', 'Amount (GHS)', 'Status', 'Requested', 'Processed'],
  },

  'driver-verifications': {
    sql: (filters, params) => {
      const conds = ['1=1'];
      if (filters.status) { params.push(filters.status === 'verified'); conds.push(`dp.is_verified = $${params.length}`); }
      if (filters.startDate) { params.push(filters.startDate); conds.push(`dp.created_at >= $${params.length}`); }
      if (filters.endDate)   { params.push(filters.endDate);   conds.push(`dp.created_at <= $${params.length}`); }
      return `SELECT up.full_name AS "Name", u.email AS "Email", up.phone AS "Phone",
                     dp.vehicle_type AS "Vehicle", dp.plate_number AS "Plate",
                     CASE WHEN dp.is_verified THEN 'Verified' ELSE 'Pending' END AS "Status",
                     dp.created_at AS "Submitted"
              FROM driver_profiles dp
              LEFT JOIN users u ON u.id = dp.user_id
              LEFT JOIN user_profiles up ON up.user_id = dp.user_id
              WHERE ${conds.join(' AND ')}
              ORDER BY dp.created_at DESC LIMIT ${MAX_ROWS}`;
    },
    columns: ['Name', 'Email', 'Phone', 'Vehicle', 'Plate', 'Status', 'Submitted'],
  },

  reports: {
    sql: (filters, params) => {
      const conds = ['1=1'];
      if (filters.status)     { params.push(filters.status);     conds.push(`rp.status = $${params.length}`); }
      if (filters.entityType) { params.push(filters.entityType); conds.push(`rp.entity_type = $${params.length}`); }
      if (filters.startDate)  { params.push(filters.startDate);  conds.push(`rp.created_at >= $${params.length}`); }
      if (filters.endDate)    { params.push(filters.endDate);    conds.push(`rp.created_at <= $${params.length}`); }
      return `SELECT up.full_name AS "Reporter", rp.entity_type AS "Entity Type",
                     rp.reason AS "Reason", rp.status AS "Status",
                     rev.full_name AS "Reviewed By", rp.created_at AS "Date"
              FROM reports rp
              LEFT JOIN user_profiles up  ON up.user_id = rp.reporter_id
              LEFT JOIN user_profiles rev ON rev.user_id = rp.reviewed_by
              WHERE ${conds.join(' AND ')}
              ORDER BY rp.created_at DESC LIMIT ${MAX_ROWS}`;
    },
    columns: ['Reporter', 'Entity Type', 'Reason', 'Status', 'Reviewed By', 'Date'],
  },
};

// ─── Serialise a cell value for output ───────────────────────────────────────
const serialize = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  return v;
};

// ─── Main export handler ──────────────────────────────────────────────────────
exports.exportResource = async (req, res, next) => {
  try {
    const { resource } = req.params;
    const format = (req.query.format || 'xlsx').toLowerCase();
    const config = RESOURCE_CONFIG[resource];

    if (!config) {
      return res.status(400).json({ error: `Unknown export resource: ${resource}` });
    }

    const params = [];
    const sql = config.sql(req.query, params);
    const db = getPool();
    const { rows } = await db.query(sql, params);

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${resource}-${dateStr}`;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);

      const stream = csvFormat({ headers: config.columns });
      stream.pipe(res);
      for (const row of rows) {
        const out = {};
        for (const col of config.columns) out[col] = serialize(row[col]);
        stream.write(out);
      }
      stream.end();
      return;
    }

    // Default: XLSX
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(resource);
    ws.columns = config.columns.map((col) => ({ header: col, key: col, width: 20 }));

    for (const row of rows) {
      const out = {};
      for (const col of config.columns) out[col] = serialize(row[col]);
      ws.addRow(out);
    }

    // Style header row
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0A1628' },
    };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFC6F135' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};
