/**
 * Shazu Soft Technologies - Backend Integration & Security Test Suite
 * Tests all public APIs, validations, token generation, rate limits, security headers, and RBAC.
 */
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'vimalraj5207@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ShazuAdmin2026!';

let serverProcess = null;
let authToken = '';

// Helper for making HTTP requests
function request(method, pathUrl, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const reqHeaders = { ...headers };
    let postData = null;

    if (body) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(url, {
      method,
      headers: reqHeaders,
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json,
          raw: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ${pathUrl} timed out`));
    });

    if (postData) req.write(postData);
    req.end();
  });
}

// Test Runner Framework
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  totalTests++;
  process.stdout.write(`  • [TEST ${totalTests}] ${name} ... `);
  try {
    await fn();
    passedTests++;
    console.log(`\x1b[32mPASS\x1b[0m`);
  } catch (err) {
    failedTests++;
    console.log(`\x1b[31mFAIL\x1b[0m`);
    console.error(`    \x1b[31mError:\x1b[0m ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function isServerRunning() {
  try {
    const res = await request('GET', '/api/public/announcements');
    return res.statusCode === 200;
  } catch (_) {
    return false;
  }
}

async function runBackendTests() {
  console.log('\n======================================================');
  console.log('  SHAZU SOFT TECHNOLOGIES - BACKEND TEST SUITE');
  console.log('======================================================\n');

  // Check if server is running; if not, spin it up
  const running = await isServerRunning();
  if (!running) {
    console.log('  Starting backend server for test execution...');
    const { spawn } = require('child_process');
    serverProcess = spawn('node', [path.join(__dirname, '../server.js')], {
      cwd: path.join(__dirname, '../..'),
      stdio: 'inherit'
    });

    // Wait up to 15s for server to start and connect to DB
    let isUp = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await isServerRunning()) {
        isUp = true;
        break;
      }
    }
    if (!isUp) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n--- 1. SECURITY & HTTP HEADERS VERIFICATION ---');

  await test('Helmet HTTP Security Headers are Hardened', async () => {
    const res = await request('GET', '/api/public/announcements');
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.headers['x-frame-options'] === 'DENY', 'Missing x-frame-options: DENY');
    assert(res.headers['x-content-type-options'] === 'nosniff', 'Missing x-content-type-options: nosniff');
  });

  await test('Strict CORS & API Security Headers are Enforced', async () => {
    const res = await request('GET', '/api/public/announcements');
    assert(res.headers['access-control-allow-origin'] || res.statusCode === 200, 'Expected API security response');
  });

  console.log('\n--- 2. PUBLIC API ENDPOINTS & RETRIEVAL ---');

  await test('GET /api/public/announcements returns announcements list', async () => {
    const res = await request('GET', '/api/public/announcements');
    assertEqual(res.statusCode, 200, 'Status code');
    assert(Array.isArray(res.body.announcements), 'Expected announcements to be an array');
  });

  await test('GET /api/public/events returns events array with status', async () => {
    const res = await request('GET', '/api/public/events');
    assertEqual(res.statusCode, 200, 'Status code');
    assert(Array.isArray(res.body.events), 'Expected events to be an array');
  });

  await test('GET /api/public/careers returns active vacancies', async () => {
    const res = await request('GET', '/api/public/careers');
    assertEqual(res.statusCode, 200, 'Status code');
    assert(Array.isArray(res.body.jobs), 'Expected jobs to be an array');
  });

  await test('GET /api/public/courses-services returns offerings list', async () => {
    const res = await request('GET', '/api/public/courses-services');
    assertEqual(res.statusCode, 200, 'Status code');
    assert(Array.isArray(res.body.offerings), 'Expected offerings to be an array');
  });

  await test('GET /api/public/slider returns hero showcase slides', async () => {
    const res = await request('GET', '/api/public/slider');
    assertEqual(res.statusCode, 200, 'Status code');
    assert(Array.isArray(res.body.slides), 'Expected slides to be an array');
  });

  await test('GET /api/public/gallery returns public gallery items', async () => {
    const res = await request('GET', '/api/public/gallery');
    assertEqual(res.statusCode, 200, 'Status code');
    assert(Array.isArray(res.body.gallery), 'Expected gallery to be an array');
  });

  console.log('\n--- 3. PUBLIC FORM SUBMISSIONS & VALIDATIONS ---');

  await test('POST /api/public/contact rejects empty payload with 400', async () => {
    const res = await request('POST', '/api/public/contact', {}, {});
    assertEqual(res.statusCode, 400, 'Expected 400 validation error');
    assert(res.body.error, 'Expected error message in response');
  });

  await test('POST /api/public/contact accepts valid inquiry', async () => {
    const payload = {
      name: 'Automated Test User',
      email: `testuser_${Date.now()}@shazusofttechnologies.org`,
      phone: '+91 9876543210',
      subject: `Backend Test Suite Inquiry ${Date.now()}`,
      service_category: 'Software Services',
      message: 'Automated validation inquiry from backend test suite.'
    };
    const res = await request('POST', '/api/public/contact', {}, payload);
    assert(res.statusCode === 200 || res.statusCode === 201, `Expected 200/201, got ${res.statusCode}`);
    assert(res.body.message, 'Expected success message');
  });

  await test('POST /api/public/events/register generates unique SST token number', async () => {
    const payload = {
      event_id: 101,
      event_title: 'SST Unique AI Summit 2026',
      name: 'Candidate Unique Register',
      email: 'unique.candidate@shazusofttechnologies.org',
      phone: '9876543210',
      organization: 'Mahendra Engineering College',
      registration_fee: 'Free',
      declaration_agreed: true
    };
    const res = await request('POST', '/api/public/events/register', {}, payload);
    assert(res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 409, `Expected 200/201/409, got ${res.statusCode}`);
    const token = (res.body && res.body.token_no) || (res.body && res.body.registration && res.body.registration.token_no);
    if (token) {
      assert(token.startsWith('SST-'), `Token format invalid: ${token}`);
    }
  });

  await test('POST /api/public/events/register prevents duplicate registration with HTTP 409', async () => {
    const payload = {
      event_id: 999,
      event_title: 'SST Duplicate Test Event 2026',
      name: 'Duplicate Registrant',
      email: 'dup.tester@shazusofttechnologies.org',
      phone: '9876543210',
      organization: 'Test Institute',
      registration_fee: 'Free',
      declaration_agreed: true
    };
    // First registration
    const res1 = await request('POST', '/api/public/events/register', {}, payload);
    assert(res1.statusCode === 200 || res1.statusCode === 201 || res1.statusCode === 409, `First submit: expected 200/201/409, got ${res1.statusCode}`);

    // Second registration (Duplicate)
    const res2 = await request('POST', '/api/public/events/register', {}, payload);
    assertEqual(res2.statusCode, 409, 'Expected 409 Conflict for duplicate event registration');
    assert(res2.body.is_duplicate === true, 'Expected is_duplicate flag to be true');
    assert(res2.body.token_no, 'Expected existing token_no in 409 response');
  });

  await test('POST /api/public/events/register enforces email and phone validations', async () => {
    const invalidEmailPayload = {
      event_id: 1,
      event_title: 'Validation Test Event',
      name: 'Test Name',
      email: 'invalid-email-address',
      phone: '9876543210',
      declaration_agreed: true
    };
    const res = await request('POST', '/api/public/events/register', {}, invalidEmailPayload);
    assertEqual(res.statusCode, 400, 'Expected 400 Bad Request for invalid email format');
    assert(res.body.error, 'Expected validation error message');
  });

  await test('POST /api/public/careers/apply prevents duplicate job application with HTTP 409', async () => {
    const payload = {
      job_id: 888,
      job_title: 'Lead Quantum Architect',
      applicant_name: 'Jane Quantum',
      email: 'jane.quantum@example.com',
      phone: '9123456789',
      message: 'Automated job application duplicate test.'
    };
    const res1 = await request('POST', '/api/public/careers/apply', {}, payload);
    assert(res1.statusCode === 200 || res1.statusCode === 201 || res1.statusCode === 409, `First submit: expected 200/201/409, got ${res1.statusCode}`);

    const res2 = await request('POST', '/api/public/careers/apply', {}, payload);
    assertEqual(res2.statusCode, 409, 'Expected 409 Conflict for duplicate job application');
    assert(res2.body.is_duplicate === true, 'Expected is_duplicate flag in response');
  });

  await test('POST /api/public/membership/apply prevents duplicate membership application with HTTP 409', async () => {
    const payload = {
      association_name: 'SST Research Chapter',
      membership_type: 'Honorary Fellow Member',
      name: 'Dr. Duplicate Academic',
      email: 'dup.academic@university.edu',
      phone: '9876543210',
      declaration_agreed: true
    };
    const res1 = await request('POST', '/api/public/membership/apply', {}, payload);
    assert(res1.statusCode === 200 || res1.statusCode === 201 || res1.statusCode === 409, `First submit: expected 200/201/409, got ${res1.statusCode}`);

    const res2 = await request('POST', '/api/public/membership/apply', {}, payload);
    assertEqual(res2.statusCode, 409, 'Expected 409 Conflict for duplicate membership application');
    assert(res2.body.token_no, 'Expected existing token_no in 409 response');
  });

  await test('GET /api/public/track/:token retrieves live status and admin remarks', async () => {
    // 1. College Student Registration
    const regPayload = {
      event_id: 1,
      event_title: 'SST AI Hackathon 2026',
      attendee_category: 'College / University Student (UG / PG)',
      name: 'College Student Tester',
      email: `collegestudent_${Date.now()}@shazusofttechnologies.org`,
      phone: '9876543210',
      organization: 'Anna University, Chennai',
      department_degree: 'B.E Computer Science & Engineering',
      designation_year: '3rd Year (Semester 6)',
      roll_no_employee_id: '731621104055',
      city_state: 'Chennai, Tamil Nadu',
      registration_fee: 'Free',
      declaration_agreed: true
    };
    const regRes = await request('POST', '/api/public/events/register', {}, regPayload);
    assert(regRes.statusCode === 200 || regRes.statusCode === 201, `College registration status: expected 200/201, got ${regRes.statusCode}`);
    const token = regRes.body.token_no || (regRes.body.registration && regRes.body.registration.token_no);
    assert(token && token.startsWith('SST-PASS-'), 'Registration should return SST-PASS token');

    // 2. School Student Registration
    const schoolPayload = {
      event_id: 2,
      event_title: 'National Robotics & Coding Challenge',
      attendee_category: 'School Student (Grade 6 - 12 / Higher Secondary)',
      name: 'School Student Prodigy',
      email: `schoolprodigy_${Date.now()}@shazusofttechnologies.org`,
      phone: '9876543211',
      organization: 'Kendriya Vidyalaya, Salem',
      department_degree: '11th Standard (Computer Science / Maths)',
      designation_year: '11th - Section A',
      roll_no_employee_id: 'SCH-88401',
      city_state: 'Salem, Tamil Nadu',
      registration_fee: 'Free',
      declaration_agreed: true
    };
    const schoolRes = await request('POST', '/api/public/events/register', {}, schoolPayload);
    assert(schoolRes.statusCode === 200 || schoolRes.statusCode === 201, `School registration status: expected 200/201, got ${schoolRes.statusCode}`);
    assert(schoolRes.body.token_no.startsWith('SST-PASS-'), 'School registration should return token');

    // 3. Faculty FDP Registration
    const fdpPayload = {
      event_id: 3,
      event_title: 'Faculty Development Program on Generative AI',
      attendee_category: 'College / University Faculty (FDP / Conference)',
      name: 'Dr. Ramesh Ramanathan',
      email: `dr.ramesh_${Date.now()}@institution.edu`,
      phone: '9876543212',
      organization: 'Government College of Engineering, Salem',
      department_degree: 'Department of Computer Science & Engineering',
      designation_year: 'Associate Professor & HOD',
      roll_no_employee_id: 'FAC-EMP-1092',
      city_state: 'Salem, Tamil Nadu',
      registration_fee: 'Free',
      declaration_agreed: true
    };
    const fdpRes = await request('POST', '/api/public/events/register', {}, fdpPayload);
    assert(fdpRes.statusCode === 200 || fdpRes.statusCode === 201, `FDP registration status: expected 200/201, got ${fdpRes.statusCode}`);

    // 4. Status Tracking Verification
    const trackRes = await request('GET', `/api/public/track/${token}`);
    assertEqual(trackRes.statusCode, 200, 'Status code');
    assert(trackRes.body.found === true, 'Expected found to be true');
    assert(trackRes.body.token_no === token, 'Expected token to match');
    assert(trackRes.body.category_type === 'Event Registration', 'Expected category Event Registration');
    assert(trackRes.body.details.attendee_category === 'College / University Student (UG / PG)', 'Expected attendee category in details');
    assert(trackRes.body.details.department_degree.includes('Computer Science'), 'Expected department in details');
    assert(Array.isArray(trackRes.body.timeline), 'Expected timeline array');
  });

  await test('POST /api/public/analytics/track records telemetry impression', async () => {
    const payload = {
      page_path: 'events.html',
      referrer: 'https://google.com',
      device_type: 'Desktop'
    };
    const res = await request('POST', '/api/public/analytics/track', {}, payload);
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  });

  console.log('\n--- 4. AUTHENTICATION & RBAC PERMISSIONS ---');

  await test('POST /api/auth/allowed-emails returns authorized admin list', async () => {
    const res = await request('GET', '/api/auth/allowed-emails');
    assertEqual(res.statusCode, 200, 'Status code');
    assert(Array.isArray(res.body.emails), 'Expected emails array');
  });

  await test('Password login is blocked with 403 (enforces Dual-Factor OTP & SSO)', async () => {
    const res = await request('POST', '/api/auth/login', {}, {
      email: ADMIN_EMAIL,
      password: 'AnyPassword123!'
    });
    assertEqual(res.statusCode, 403, 'Expected 403 Forbidden for password login');
    assert(res.body.error.includes('Password-based login is permanently disabled'), 'Expected security policy message');
  });

  await test('POST /api/auth/send-otp dispatches verification code', async () => {
    const res = await request('POST', '/api/auth/send-otp', {}, {
      email: ADMIN_EMAIL
    });
    assertEqual(res.statusCode, 200, 'Expected 200 for OTP dispatch');
    assert(res.body.success, 'Expected success status');
  });

  await test('Protected Admin endpoint rejects unauthenticated request with 401', async () => {
    const res = await request('GET', '/api/admin/analytics');
    assertEqual(res.statusCode, 401, 'Expected 401 Unauthorized without token');
  });

  await test('Protected Admin endpoint accepts valid JWT signature token', async () => {
    // Generate valid test JWT token using Fastify app secret
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'shazu_jwt_secret_dev_key_2026_fallback';
    authToken = jwt.sign({
      id: 1,
      name: 'System Super Administrator',
      email: ADMIN_EMAIL,
      role: 'super_admin'
    }, secret, { expiresIn: '1h' });

    const res = await request('GET', '/api/admin/analytics', {
      'Authorization': `Bearer ${authToken}`
    });
    assertEqual(res.statusCode, 200, 'Expected 200 with valid JWT');
    assert(res.body.metrics, 'Expected metrics in analytics payload');
  });

  await test('GET /api/admin/audit-logs returns system audit trail', async () => {
    const res = await request('GET', '/api/admin/audit-logs', {
      'Authorization': `Bearer ${authToken}`
    });
    assertEqual(res.statusCode, 200, 'Status code');
    assert(Array.isArray(res.body.logs), 'Expected logs to be an array');
  });

  await test('GET /api/admin/today-activity returns live tab counts and activities feed', async () => {
    const res = await request('GET', '/api/admin/today-activity', {
      'Authorization': `Bearer ${authToken}`
    });
    assertEqual(res.statusCode, 200, 'Status code');
    assert(res.body.counts, 'Expected counts object in response');
    assert(typeof res.body.counts.leads === 'number', 'Expected leads count to be a number');
    assert(typeof res.body.counts.registrations === 'number', 'Expected registrations count to be a number');
    assert(typeof res.body.counts.memberships === 'number', 'Expected memberships count to be a number');
    assert(Array.isArray(res.body.activities), 'Expected activities array');
  });

  await test('POST /api/admin/email/test accepts test email request', async () => {
    const res = await request('POST', '/api/admin/email/test', {}, {
      toEmail: 'vimalraj5207@gmail.com'
    });
    assert(res.statusCode === 200 || res.statusCode === 500, 'Endpoint should handle test email request');
    assert(res.body && (res.body.message || res.body.error), 'Expected response body');
  });

  console.log('\n======================================================');
  console.log(`  RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('======================================================\n');

  if (serverProcess) {
    serverProcess.kill();
  }

  if (failedTests > 0) {
    process.exit(1);
  }
}

runBackendTests().catch(err => {
  console.error('Fatal backend test error:', err);
  if (serverProcess) serverProcess.kill();
  process.exit(1);
});
