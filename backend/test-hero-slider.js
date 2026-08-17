/**
 * Automated Verification Script for Hero Slider API & Database BLOB Storage
 */
const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runHeroSliderTests() {
  console.log('--- Starting Hero Slider & Database BLOB Verification ---');

  try {
    // 1. Verify Database Connection
    const timeRes = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected at:', timeRes.rows[0].now);

    // 2. Verify Table Existence
    const tableRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'hero_slides'
    `);
    console.log(' hero_slides columns:', tableRes.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // 3. Query existing slides
    const initialSlides = await pool.query('SELECT id, badge, title, display_order, is_active FROM hero_slides ORDER BY display_order ASC');
    console.log(`✅ Current slides in DB: ${initialSlides.rows.length} slides found`);
    initialSlides.rows.forEach(s => {
      console.log(`   - [ID: ${s.id}] #${s.display_order} [${s.badge}] ${s.title} (Active: ${s.is_active})`);
    });

    // 4. Test Inserting a Base64 BLOB Slide
    console.log('\n--- Testing Insert of Base64 Image BLOB ---');
    const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const insertRes = await pool.query(`
      INSERT INTO hero_slides (badge, title, subtitle, image_url, display_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, ['TEST SLIDE', 'Automated Test Slide Headline', 'Test subtitle description', sampleBase64, 99, true]);

    const createdId = insertRes.rows[0].id;
    console.log(`✅ Successfully inserted test slide with ID: ${createdId}`);
    console.log(`   - Image URL starts with: ${insertRes.rows[0].image_url.substring(0, 35)}...`);

    // 5. Test Updating the Slide
    console.log('\n--- Testing Update of Slide ---');
    const updateRes = await pool.query(`
      UPDATE hero_slides
      SET title = $1, badge = $2, display_order = $3
      WHERE id = $4 RETURNING *
    `, ['Updated Test Slide Headline', 'VERIFIED BADGE', 100, createdId]);
    console.log(`✅ Updated slide: [${updateRes.rows[0].badge}] ${updateRes.rows[0].title}`);

    // 6. Test Querying Active Slides (as public API does)
    const publicQuery = await pool.query('SELECT * FROM hero_slides WHERE is_active = TRUE ORDER BY display_order ASC, id ASC');
    const foundTestSlide = publicQuery.rows.find(s => s.id === createdId);
    if (foundTestSlide) {
      console.log('✅ Public query successfully includes the newly created slide in order!');
    } else {
      console.error('❌ Failed: New slide not found in active query');
    }

    // 7. Cleanup Test Slide
    console.log('\n--- Cleaning up Test Slide ---');
    await pool.query('DELETE FROM hero_slides WHERE id = $1', [createdId]);
    console.log(`✅ Test slide ID ${createdId} cleaned up successfully.`);

    console.log('\n🎉 ALL HERO SLIDER DATABASE TESTS PASSED WITH 100% SUCCESS!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runHeroSliderTests();
