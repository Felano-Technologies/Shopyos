const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:YXNIWxHjucsnmyTWKqKgDAosGorlVDSu@hayabusa.proxy.rlwy.net:27466/railway' });
(async () => {
  await client.connect();
  const app = await client.query(`
    SELECT id, status, entity_id, legacy_migrated FROM verification_applications
    WHERE user_id = '29c2124d-8875-4e7a-9bd4-83dd1833aecc' AND role = 'seller'
    ORDER BY created_at DESC LIMIT 1
  `);
  console.log('=== testbuyer application ===');
  console.table(app.rows);
  if (app.rows.length) {
    const steps = await client.query(`SELECT step_key, status, data FROM verification_steps WHERE application_id = $1`, [app.rows[0].id]);
    console.log('=== steps ===');
    console.log(JSON.stringify(steps.rows, null, 2));
  }
  await client.end();
})().catch(e => { console.error(e); process.exit(1); });
