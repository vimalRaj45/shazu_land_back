const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shazu_db',
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function runTests() {
  console.log('--- Starting Dynamic Events & Payment Verification Test ---');
  const client = await pool.connect();
  try {
    // 1. Run migrations to ensure columns exist
    await client.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS target_audience VARCHAR(50) DEFAULT 'College';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS fee_amount VARCHAR(100) DEFAULT '0';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100) DEFAULT '8807099288@upi';

      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS target_audience VARCHAR(50) DEFAULT 'College';
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS school_name VARCHAR(255);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS grade_standard VARCHAR(100);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS section_roll VARCHAR(100);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS college_name VARCHAR(255);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS degree VARCHAR(100);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS department VARCHAR(100);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS year_of_study VARCHAR(50);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS register_no VARCHAR(100);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS designation VARCHAR(100);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS experience_years VARCHAR(50);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT;
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS fee_amount VARCHAR(100);
    `);
    console.log('✅ Database schema migrations verified successfully.');

    // 2. Insert test School event
    const schoolEventRes = await client.query(`
      INSERT INTO events (title, category, description, event_date, location, registration_fee, status, target_audience, is_paid, fee_amount, upi_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
    `, ['Interschool Robotics & Coding Championship 2026', 'Competition', 'State-level school coding contest', 'Nov 14, 2026', 'Salem Main Hall', 'Free', 'Upcoming', 'School', false, '0', '8807099288@upi']);
    const schoolEvent = schoolEventRes.rows[0];
    console.log('✅ Created School Event:', schoolEvent.title, `[Audience: ${schoolEvent.target_audience}, Fee: ${schoolEvent.registration_fee}]`);

    // 3. Insert test Paid College Hackathon
    const collegeEventRes = await client.query(`
      INSERT INTO events (title, category, description, event_date, location, registration_fee, status, target_audience, is_paid, fee_amount, upi_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
    `, ['Grand National AI Hackathon 2026', 'Hackathon', '36-hour national hackathon for college devs', 'Dec 05-06, 2026', 'SST Tech Hub Salem', '₹499', 'Upcoming', 'College', true, '499', '8807099288@upi']);
    const collegeEvent = collegeEventRes.rows[0];
    console.log('✅ Created Paid College Event:', collegeEvent.title, `[Audience: ${collegeEvent.target_audience}, Fee: ${collegeEvent.registration_fee}, UPI: ${collegeEvent.upi_id}]`);

    // 4. Insert registration for School event
    const schoolRegRes = await client.query(`
      INSERT INTO event_registrations (
        event_id, event_title, name, email, phone, organization, registration_fee, payment_method, transaction_id, token_no, payment_status,
        target_audience, school_name, grade_standard, section_roll, guardian_name, guardian_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *
    `, [
      schoolEvent.id, schoolEvent.title, 'Aravind Kumar', 'aravind@example.com', '9876543210', 'St. Joseph School', 'Free', 'Free Entry', '', 'SST-PASS-SCH123', 'Verified',
      'School', 'St. Joseph Matric Higher Secondary School', '10th Standard', '10-A / Roll #15', 'R. Kumar', '9876500000'
    ]);
    console.log('✅ Created School Registration:', schoolRegRes.rows[0].name, `[School: ${schoolRegRes.rows[0].school_name}, Grade: ${schoolRegRes.rows[0].grade_standard}]`);

    // 5. Insert registration for Paid College event
    const collegeRegRes = await client.query(`
      INSERT INTO event_registrations (
        event_id, event_title, name, email, phone, organization, registration_fee, payment_method, transaction_id, token_no, payment_status,
        target_audience, college_name, degree, department, year_of_study, register_no, payment_screenshot_url, fee_amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *
    `, [
      collegeEvent.id, collegeEvent.title, 'Priya Dharshini', 'priya@example.com', '9876512345', 'Mahendra Engg College', '₹499', 'UPI QR', '423589102456', 'SST-PASS-COL456', 'Pending Verification',
      'College', 'Mahendra Engineering College', 'B.E / B.Tech', 'Computer Science and Engineering', '3rd Year', '712022104045', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', '499'
    ]);
    console.log('✅ Created Paid College Registration:', collegeRegRes.rows[0].name, `[College: ${collegeRegRes.rows[0].college_name}, Dept: ${collegeRegRes.rows[0].department}, UTR: ${collegeRegRes.rows[0].transaction_id}]`);

    // Clean up test records
    await client.query(`DELETE FROM event_registrations WHERE id IN ($1, $2)`, [schoolRegRes.rows[0].id, collegeRegRes.rows[0].id]);
    await client.query(`DELETE FROM events WHERE id IN ($1, $2)`, [schoolEvent.id, collegeEvent.id]);
    console.log('✅ Cleaned up test records.');

    console.log('\n🎉 All dynamic event registration & UPI tests passed successfully!');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runTests();
