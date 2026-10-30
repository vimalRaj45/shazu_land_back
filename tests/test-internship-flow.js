/**
 * Targeted Test Suite: Free Internship Registration & Admin Sync
 */
const http = require('http');

const PORT = 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, data: json || data });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('======================================================');
  console.log('  TESTING WINTER INTERNSHIP & ADMIN PANEL INTEGRATION   ');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await makeRequest('GET', '/api/health');
    assert('Server is online and healthy', health.status === 200);

    // 2. Submit internship with missing fields (should fail 400)
    const badReq = await makeRequest('POST', '/api/public/internships/apply', {
      name: 'A' // too short name, missing required
    });
    assert('Rejects invalid / incomplete internship submission with 400', badReq.status === 400);

    // 3. Submit valid internship application
    const uniqueEmail = `intern_${Date.now()}@college.edu`;
    const internPayload = {
      name: 'Priya Sharma',
      email: uniqueEmail,
      phone: '+91 9876543210',
      gender: 'Female',
      college_name: 'Government College of Engineering, Salem',
      degree_department: 'B.E Computer Science and Engineering',
      year_of_study: '3rd Year',
      roll_no: '710022104055',
      domain: 'Full Stack Web Development',
      training_period: '2 Weeks',
      preferred_mode: 'Online / Virtual',
      start_date: '2026-11-15',
      notes: 'Keen on learning React and Fastify backend architectures'
    };

    const submitRes = await makeRequest('POST', '/api/public/internships/apply', internPayload);
    assert('Submits valid internship application with 200', submitRes.status === 200);
    assert('Returns generated token with prefix SST-INT-', submitRes.data.token_no && submitRes.data.token_no.startsWith('SST-INT-'));
    assert('Stores student and college credentials accurately', submitRes.data.internship && submitRes.data.internship.college_name === internPayload.college_name);

    const tokenNo = submitRes.data.token_no;
    const internId = submitRes.data.internship.id;

    // 4. Duplicate check with same email & domain (should return 409)
    const dupRes = await makeRequest('POST', '/api/public/internships/apply', internPayload);
    assert('Duplicate registration returns HTTP 409 with existing token', dupRes.status === 409 && dupRes.data.is_duplicate === true);

    // 5. Public Track endpoint by token
    const trackRes = await makeRequest('GET', `/api/public/track/${tokenNo}`);
    assert('GET /api/public/track/:token resolves internship dossier', trackRes.status === 200 && trackRes.data.found === true);
    assert('Returns correct category type and student name', trackRes.data.category_type === 'Internship Application' && trackRes.data.applicant_name === 'Priya Sharma');
    assert('Returns detailed college credentials in details payload', trackRes.data.details && trackRes.data.details.college_name === internPayload.college_name);

    // 6. Admin Authentication Header
    const authHeader = { 'Authorization': 'Bearer dev_bypass_active_local_session' };

    // 7. GET /api/admin/internships
    const adminList = await makeRequest('GET', '/api/admin/internships', null, authHeader);
    assert('Admin endpoint GET /api/admin/internships returns 200', adminList.status === 200);
    const foundInList = (adminList.data.internships || []).some(i => i.token_no === tokenNo);
    assert('New internship application is visible in admin list', foundInList);

    // 8. PUT /api/admin/internships/:id/status (Approve candidate)
    const updateRes = await makeRequest('PUT', `/api/admin/internships/${internId}/status`, {
      status: 'Approved',
      admin_notes: 'Eligible for Batch A starting Nov 15th.'
    }, authHeader);
    assert('Admin can approve internship application with 200', updateRes.status === 200);
    assert('Status updated to Approved', updateRes.data.internship && updateRes.data.internship.status === 'Approved');

    // 9. Verify track endpoint now reflects 'Approved' status
    const trackApproved = await makeRequest('GET', `/api/public/track/${tokenNo}`);
    assert('Track endpoint reflects Approved status', trackApproved.data.status === 'Approved');

    // 10. Summary count includes internships
    const summaryRes = await makeRequest('GET', '/api/admin/today-activity', null, authHeader);
    assert('Summary activity counts include internships count', summaryRes.data && summaryRes.data.counts && typeof summaryRes.data.counts.internships === 'number');

    // 11. DELETE /api/admin/internships/:id
    const delRes = await makeRequest('DELETE', `/api/admin/internships/${internId}`, null, authHeader);
    assert('Admin can delete internship record with 200', delRes.status === 200);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`  RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
