const { getPool } = require('../config/postgres');
const db = getPool();

exports.createSnap = async (req, res) => {
  try {
    const { media_url, caption, product_id } = req.body;
    const storeId = req.store.id; // From requireStore middleware

    if (!media_url) {
      return res.status(400).json({ success: false, error: 'Media URL is required' });
    }

    const { rows } = await db.query(
      `INSERT INTO snaps (store_id, media_url, caption, product_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [storeId, media_url, caption, product_id || null]
    );

    const { toPublicUrl } = require('../config/storage');
    const snap = rows[0];
    if (snap) {
      snap.media_url = toPublicUrl(snap.media_url);
    }

    res.status(201).json({ success: true, snap });
  } catch (error) {
    console.error('Error creating snap:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.getSnapFeed = async (req, res) => {
  try {
    // Group snaps by store, latest first, only active ones
    const { rows } = await db.query(`
      SELECT 
        s.id as store_id, 
        s.store_name, 
        s.logo_url as store_logo,
        json_agg(
          json_build_object(
            'id', sn.id,
            'media_url', sn.media_url,
            'caption', sn.caption,
            'product_id', sn.product_id,
            'view_count', sn.view_count,
            'created_at', sn.created_at,
            'expires_at', sn.expires_at
          ) ORDER BY sn.created_at ASC
        ) as snaps
      FROM stores s
      JOIN snaps sn ON s.id = sn.store_id
      WHERE sn.expires_at > NOW()
      GROUP BY s.id
      ORDER BY MAX(sn.created_at) DESC
      LIMIT 20
    `);

    const { toPublicUrl } = require('../config/storage');
    const feed = rows.map(row => ({
      ...row,
      store_logo: toPublicUrl(row.store_logo),
      snaps: row.snaps.map(snap => ({
        ...snap,
        media_url: toPublicUrl(snap.media_url)
      }))
    }));

    res.json({ success: true, feed });
  } catch (error) {
    console.error('Error fetching snap feed:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.viewSnap = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`UPDATE snaps SET view_count = view_count + 1 WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error viewing snap:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.deleteSnap = async (req, res) => {
  try {
    const { id } = req.params;
    const storeId = req.store.id;
    
    const { rowCount } = await db.query(`DELETE FROM snaps WHERE id = $1 AND store_id = $2`, [id, storeId]);
    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Snap not found or unauthorized' });
    }
    
    res.json({ success: true, message: 'Snap deleted' });
  } catch (error) {
    console.error('Error deleting snap:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
