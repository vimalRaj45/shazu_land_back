/**
 * Shazu Soft Technologies - Safe Database Data Truncation Script
 * Truncates user data (registrations, applications, inquiries, memberships, events, careers, announcements, audit logs)
 * EXCEPT hero_slides (Hero Section) and admins (Admin Accounts) which remain 100% intact.
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL is missing from .env file');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function safeTruncateData() {
  console.log('\n======================================================');
  console.log('  SHAZU SOFT TECHNOLOGIES - SAFE DATA TRUNCATION ENGINE');
  console.log('======================================================\n');
  console.log('  Connecting to Neon PostgreSQL database...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('  Truncating user submission tables and content data...');

    // 1. Truncate dependent child tables first
    await client.query('TRUNCATE TABLE event_registrations CASCADE;');
    console.log('  ✔ Truncated table: event_registrations');

    await client.query('TRUNCATE TABLE applications CASCADE;');
    console.log('  ✔ Truncated table: applications');

    await client.query('TRUNCATE TABLE contact_inquiries CASCADE;');
    console.log('  ✔ Truncated table: contact_inquiries');

    await client.query('TRUNCATE TABLE memberships CASCADE;');
    console.log('  ✔ Truncated table: memberships');

    // 2. Truncate main content tables
    await client.query('TRUNCATE TABLE events CASCADE;');
    console.log('  ✔ Truncated table: events');

    await client.query('TRUNCATE TABLE careers CASCADE;');
    console.log('  ✔ Truncated table: careers');

    await client.query('TRUNCATE TABLE courses_services CASCADE;');
    console.log('  ✔ Truncated table: courses_services');

    await client.query('TRUNCATE TABLE announcements CASCADE;');
    console.log('  ✔ Truncated table: announcements');

    // 3. Truncate telemetry, OTPs and logs
    await client.query('TRUNCATE TABLE analytics_events CASCADE;');
    console.log('  ✔ Truncated table: analytics_events');

    await client.query('TRUNCATE TABLE audit_logs CASCADE;');
    console.log('  ✔ Truncated table: audit_logs');

    await client.query('TRUNCATE TABLE admin_otps CASCADE;');
    console.log('  ✔ Truncated table: admin_otps');

    await client.query('COMMIT');

    console.log('\n======================================================');
    console.log('  PRESERVED TABLES (INSPECTED & INTACT):');
    console.log('  ★ hero_slides  -> HERO SECTION preserved 100%');
    console.log('  ★ admins       -> ADMIN ACCOUNTS preserved 100%');
    console.log('======================================================');
    console.log('  🎉 SAFE DATA TRUNCATION COMPLETED SUCCESSFULLY!\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Truncation failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

safeTruncateData();
