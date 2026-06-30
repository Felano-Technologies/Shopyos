const ApiResponse = require('../utils/apiResponse');
const { getPool } = require('../config/postgres');
const db = getPool();

exports.createSnap = async (req, res) => {
  try {
    const { media_url, caption, product_id } = req.body;
    const storeId = req.store.id; // From requireStore middleware

    if (!media_url) {
      return ApiResponse.error(res, 'Media URL is required', 400);
    }

    const { rows } = await db.query(
      `INSERT INTO snaps (store_id, media_url, caption, product_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [storeId, media_url, caption, product_id || null]
    );

    const { resolveImageUrl } = require('../config/storage');
    const snap = rows[0];
    if (snap) {
      snap.media_url = await resolveImageUrl(snap.media_url);
    }

    ApiResponse.withEntity(res, 'snap', snap, null, null, 201);
  } catch (error) {
    console.error('Error creating snap:', error);
    ApiResponse.error(res, 'Server Error', 500);
  }
};

exports.getSnapFeed = async (req, res) => {
  try {
    // Group snaps by store, latest first — view filters expired snaps
    const { rows } = await db.query(`
      SELECT
        store_id,
        store_name,
        store_logo,
        json_agg(
          json_build_object(
            'id', id,
            'media_url', media_url,
            'caption', caption,
            'product_id', product_id,
            'view_count', view_count,
            'created_at', created_at,
            'expires_at', expires_at
          ) ORDER BY created_at ASC
        ) AS snaps
      FROM vw_active_snap_feed
      GROUP BY store_id, store_name, store_logo
      ORDER BY MAX(created_at) DESC
      LIMIT 20
    `);

    const { resolveImageUrl } = require('../config/storage');
    const feed = await Promise.all(rows.map(async row => ({
      ...row,
      store_logo: await resolveImageUrl(row.store_logo),
      snaps: await Promise.all(row.snaps.map(async snap => ({
        ...snap,
        media_url: await resolveImageUrl(snap.media_url)
      })))
    })));

    ApiResponse.withEntity(res, 'feed', feed);
  } catch (error) {
    console.error('Error fetching snap feed:', error);
    ApiResponse.error(res, 'Server Error', 500);
  }
};

exports.viewSnap = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    if (userId) {
      // Try to register a unique view for this snap/user
      const { rowCount } = await db.query(
        `INSERT INTO snap_views (snap_id, user_id, ip_address) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (snap_id, user_id) WHERE user_id IS NOT NULL DO NOTHING`,
        [id, userId, ipAddress]
      );
      
      // If a new view was inserted, increment the snap's view_count
      if (rowCount > 0) {
        await db.query(`UPDATE snaps SET view_count = view_count + 1 WHERE id = $1`, [id]);
      }
    } else {
      // Guest view: track uniquely by IP address
      const { rowCount } = await db.query(
        `INSERT INTO snap_views (snap_id, user_id, ip_address) 
         VALUES ($1, NULL, $2) 
         ON CONFLICT (snap_id, ip_address) WHERE user_id IS NULL DO NOTHING`,
        [id, ipAddress]
      );
      
      // If a new guest view was inserted, increment the snap's view_count
      if (rowCount > 0) {
        await db.query(`UPDATE snaps SET view_count = view_count + 1 WHERE id = $1`, [id]);
      }
    }

    ApiResponse.success(res, null);
  } catch (error) {
    console.error('Error viewing snap:', error);
    ApiResponse.error(res, 'Server Error', 500);
  }
};

exports.deleteSnap = async (req, res) => {
  try {
    const { id } = req.params;
    const storeId = req.store.id;
    
    const { rowCount } = await db.query(`DELETE FROM snaps WHERE id = $1 AND store_id = $2`, [id, storeId]);
    if (rowCount === 0) {
      return ApiResponse.error(res, 'Snap not found or unauthorized', 404);
    }
    
    ApiResponse.success(res, null, 'Snap deleted');
  } catch (error) {
    console.error('Error deleting snap:', error);
    ApiResponse.error(res, 'Server Error', 500);
  }
};

exports.getMySnaps = async (req, res) => {
  try {
    const storeId = req.store.id;
    const { status } = req.query; // 'active', 'expired', or 'all'

    let query = `
      SELECT sn.*, p.title as product_title, p.price as product_price
      FROM snaps sn
      LEFT JOIN products p ON sn.product_id = p.id
      WHERE sn.store_id = $1
    `;
    const params = [storeId];

    if (status === 'active') {
      query += ' AND sn.expires_at > NOW()';
    } else if (status === 'expired') {
      query += ' AND sn.expires_at <= NOW()';
    }

    query += ' ORDER BY sn.created_at DESC';

    const { rows } = await db.query(query, params);

    const { resolveImageUrl } = require('../config/storage');
    const snaps = await Promise.all(
      rows.map(async (snap) => ({
        ...snap,
        media_url: await resolveImageUrl(snap.media_url),
      }))
    );

    ApiResponse.withEntity(res, 'snaps', snaps);
  } catch (error) {
    console.error('Error fetching seller snaps:', error);
    ApiResponse.error(res, 'Server Error', 500);
  }
};

exports.repostSnap = async (req, res) => {
  try {
    const { id } = req.params;
    const storeId = req.store.id;

    // Verify ownership and update snap expiration and creation time
    const { rows } = await db.query(
      `UPDATE snaps 
       SET expires_at = NOW() + INTERVAL '24 hours', 
           created_at = NOW(), 
           expiration_notified = FALSE
       WHERE id = $1 AND store_id = $2
       RETURNING *`,
      [id, storeId]
    );

    if (rows.length === 0) {
      return ApiResponse.error(res, 'Snap not found or unauthorized', 404);
    }

    const { resolveImageUrl } = require('../config/storage');
    const snap = rows[0];
    snap.media_url = await resolveImageUrl(snap.media_url);

    ApiResponse.success(res, { snap, message: 'Snap reposted successfully' });
  } catch (error) {
    console.error('Error reposting snap:', error);
    ApiResponse.error(res, 'Server Error', 500);
  }
};
