const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_1GkM8QvdjRse@ep-proud-waterfall-a1y7q2v6-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runTest() {
  console.log('--- Testing System Audit Logs DB & Pipeline ---');
  const client = await pool.connect();
  try {
    // 1. Ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER,
        admin_name VARCHAR(255),
        admin_email VARCHAR(255),
        action_type VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(100),
        details TEXT,
        ip_address VARCHAR(100),
        status VARCHAR(50) DEFAULT 'SUCCESS',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ audit_logs table verified');

    // 2. Insert a test audit event
    const insertRes = await client.query(`
      INSERT INTO audit_logs (admin_name, admin_email, action_type, entity_type, entity_id, details, ip_address, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, ['Test Admin', 'admin@shazusofttechnologies.org', 'TEST_EVENT', 'SYSTEM_AUDIT', 'AUTO_TEST_1', 'Automated system audit verification event', '127.0.0.1', 'SUCCESS']);
    
    console.log('✓ Inserted test audit log event ID:', insertRes.rows[0].id);

    // 3. Query audit events
    const queryRes = await client.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5');
    console.log(`✓ Successfully retrieved ${queryRes.rows.length} audit logs:`);
    queryRes.rows.forEach(r => {
      console.log(`  - [${r.created_at.toISOString()}] [${r.action_type}] ${r.admin_name}: ${r.details}`);
    });

    console.log('--- ALL SYSTEM AUDIT TESTS PASSED 100% ---');
  } catch (err) {
    console.error('Audit Log Test Failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runTest();
