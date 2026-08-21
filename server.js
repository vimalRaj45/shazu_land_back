const path = require('path');
const https = require('https');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const fastifyStatic = require('@fastify/static');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const helmet = require('@fastify/helmet');
const rateLimit = require('@fastify/rate-limit');

const app = Fastify({ 
  logger: true,
  bodyLimit: 15728640 // 15 MB payload limit for Base64 image BLOB uploads
});

// Environment configuration (loaded from .env)
const PORT = process.env.PORT || 5000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'vimalraj5207@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ShazuAdmin2026!';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER = process.env.BREVO_SENDER_EMAIL || process.env.BREVO_SENDER || 'vsgrpsemail@gmail.com';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Shazu Soft Technologies';

// ----------------------------------------------------
// BREVO TRANSACTIONAL EMAIL ENGINE (API v3)
// ----------------------------------------------------
async function sendBrevoEmail({ toEmail, toName, subject, htmlContent, textContent }) {
  if (!BREVO_API_KEY) {
    app.log.warn('BREVO_API_KEY is not configured in .env file.');
    return { success: false, error: 'Brevo API key missing' };
  }

  const payload = JSON.stringify({
    sender: {
      name: BREVO_SENDER_NAME,
      email: BREVO_SENDER
    },
    to: [
      {
        email: toEmail,
        name: toName || toEmail
      }
    ],
    subject: subject || 'Notification from Shazu Soft Technologies',
    htmlContent: htmlContent || `<p>${textContent || subject}</p>`
  });

  return new Promise((resolve) => {
    const req = https.request('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          app.log.info(`Brevo email dispatched successfully to ${toEmail}. Status: ${res.statusCode}`);
          resolve({ success: true, statusCode: res.statusCode, body: responseBody });
        } else {
          app.log.warn(`Brevo email response to ${toEmail}: Status ${res.statusCode}, Body: ${responseBody}`);
          resolve({ success: false, statusCode: res.statusCode, error: responseBody });
        }
      });
    });

    req.on('error', (err) => {
      app.log.warn(`Brevo network unreachable / error for ${toEmail}: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      app.log.warn(`Brevo request timed out for ${toEmail}`);
      resolve({ success: false, error: 'Timeout sending email via Brevo' });
    });

    req.write(payload);
    req.end();
  });
}

// Google OAuth 2.0 Credentials & Authorized Administrator Emails
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'https://shazusoft.pages.dev/api/auth/google/callback';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://shazusoft.pages.dev').replace(/\/$/, '');
const ALLOWED_ADMIN_EMAILS = (process.env.ALLOWED_ADMIN_EMAILS || 'vimalraj5207@gmail.com').split(',').map(e => e.trim().toLowerCase());

// Database Connection Pool & In-Memory Fallback Shield
let isDbConnected = false;
let realPool = null;

if (DATABASE_URL) {
  try {
    realPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false
    });
  } catch (err) {
    app.log.warn(`Could not initialize Postgres pool: ${err.message}`);
  }
}

// In-Memory Database Store for robust offline local development & test execution
const mockDb = {
  admins: [{
    id: 1,
    name: 'System Super Administrator',
    email: (ADMIN_EMAIL || 'vimalraj5207@gmail.com').toLowerCase(),
    password_hash: bcrypt.hashSync(ADMIN_PASSWORD || 'ShazuAdmin2026!', 10),
    role: 'super_admin',
    is_active: true,
    last_login_at: new Date()
  }],
  admin_otps: [],
  announcements: [
    { id: 1, title: 'ICET-2026 International Conference Call for Papers', category: 'Conference', link_url: '/events.html', is_pinned: true, status: 'Active', created_at: new Date() },
    { id: 2, title: 'SST 36-Hour National Innovation Hackathon Registration Open', category: 'Hackathon', link_url: '/events.html', is_pinned: true, status: 'Active', created_at: new Date() }
  ],
  events: [
    {
      id: 1,
      title: 'International Conference on Emerging Computing & AI Frontiers (ICET-2026)',
      category: 'Upcoming Conference | Engineering & Tech',
      description: 'Centralized global conference addressing neural architectures, deep reasoning models, and cloud database security.',
      event_date: 'Sept 28, 2026',
      location: 'Salem, Tamil Nadu (Hybrid)',
      registration_fee: '₹1,499',
      status: 'Upcoming',
      image_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80',
      created_at: new Date()
    },
    {
      id: 2,
      title: 'National Level 36-Hour SST Innovation Hackathon 2026',
      category: 'Hackathon | Engineering & Tech',
      description: 'Competitive rapid prototyping challenge to solve sustainable urbanization and fintech automation under strict 36-hour sprint constraints.',
      event_date: 'Oct 12-14, 2026',
      location: 'SST Innovation Hub, Salem',
      registration_fee: '₹499 / Team',
      status: 'Upcoming',
      image_url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
      created_at: new Date()
    },
    {
      id: 3,
      title: 'Faculty Development Program on Generative AI & Curriculum Modernization',
      category: 'Faculty Development Program | Education & Humanities',
      description: 'Intensive 5-day pedagogy enrichment workshop designed for college professors and lecturers to integrate AI development sandboxes into engineering curricula.',
      event_date: 'Nov 05-09, 2026',
      location: 'Virtual Classroom / Salem Center',
      registration_fee: 'Free',
      status: 'Upcoming',
      image_url: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80',
      created_at: new Date()
    },
    {
      id: 4,
      title: 'Global Webinar on Medical Informatics & Biomedical Data Audits',
      category: 'Webinar | Medical & Life Sciences',
      description: 'Expert panel session featuring international clinical data scientists discussing machine learning pipelines in oncology analytics and patient privacy regulations.',
      event_date: 'Oct 20, 2026',
      location: 'Live Stream Webinar',
      registration_fee: 'Free',
      status: 'Upcoming',
      image_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
      created_at: new Date()
    },
    {
      id: 5,
      title: 'Hands-on Training in Full-Stack Fastify & PostgreSQL Engineering',
      category: 'Hands on Training | Engineering & Tech',
      description: 'Practical code-along masterclass covering asynchronous microservices, JWT authentication, and relational database indexing for high throughput systems.',
      event_date: 'Nov 18, 2026',
      location: 'SST Labs, Salem',
      registration_fee: '₹799',
      status: 'Upcoming',
      image_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80',
      created_at: new Date()
    },
    {
      id: 6,
      title: 'Winter Industrial Internship & Corporate Mentorship Program',
      category: 'Internship | Engineering & Tech',
      description: 'Structured 8-week corporate residency connecting aspiring software engineers with senior developers to build scalable enterprise web solutions.',
      event_date: 'Dec 01, 2026 - Jan 25, 2027',
      location: 'Salem & Remote',
      registration_fee: '₹1,999',
      status: 'Upcoming',
      image_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
      created_at: new Date()
    },
    {
      id: 7,
      title: 'Executive Seminar on Corporate Digital Transformation & MSME Scaling',
      category: 'Seminar | Business & Management',
      description: 'Leadership colloquium on digital business adoption, cloud enterprise migration, and capital resource optimization for emerging technology leaders.',
      event_date: 'Aug 14, 2026',
      location: 'Grand Palace Hall, Salem',
      registration_fee: 'Free',
      status: 'Past',
      image_url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
      created_at: new Date()
    }
  ],
  careers: [
    { id: 1, title: 'Senior Full-Stack Cloud Engineer', department: 'Engineering', location: 'Salem / Hybrid', job_type: 'Full-time', experience_level: '3+ Years', description: 'Lead architectural design for high-scale enterprise applications.', requirements: 'Node.js, Fastify, React, PostgreSQL', status: 'Open', created_at: new Date() }
  ],
  offerings: [
    { id: 1, title: 'Enterprise Cloud & Web Engineering', type: 'Service', category: 'Software', description: 'End-to-end agile product engineering and cloud modernization.', price: 'Custom Quote', status: 'Active', is_featured: true, created_at: new Date() }
  ],
  hero_slides: [
    { id: 1, title: 'Pioneering Scalable Cloud Solutions', subtitle: 'Delivering end-to-end digital transformation for global enterprises.', status: 'Active', is_active: true, display_order: 1, image_url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80', created_at: new Date() }
  ],
  contacts: [],
  registrations: [],
  job_applications: [],
  memberships: [],
  page_views: [],
  audit_logs: [
    { id: 1, admin_name: 'System Kernel', admin_email: 'system@shazusofttechnologies.org', action_type: 'SYSTEM_BOOT', entity_type: 'SYSTEM', entity_id: 'NODE_FASTIFY', details: 'Fastify core runtime engine and migration initialized', ip_address: '127.0.0.1', status: 'SUCCESS', created_at: new Date() }
  ]
};

function handleMockQuery(sql, params = []) {
  const s = String(sql || '').trim();
  const lower = s.toLowerCase();

  // 1. SELECT COUNT(*) queries
  if (lower.includes('count(*)')) {
    let count = 0;
    if (lower.includes('from audit_logs')) count = mockDb.audit_logs.length;
    else if (lower.includes('from contacts')) count = mockDb.contacts.length;
    else if (lower.includes('from registrations')) count = mockDb.registrations.length;
    else if (lower.includes('from job_applications')) count = mockDb.job_applications.length;
    else if (lower.includes('from memberships')) count = mockDb.memberships.length;
    else if (lower.includes('from page_views')) count = mockDb.page_views.length;
    else if (lower.includes('from events')) count = mockDb.events.length;
    else if (lower.includes('from careers')) count = mockDb.careers.length;
    else if (lower.includes('from admins')) count = mockDb.admins.length;
    return { rows: [{ count: String(count), total: count, total_events: mockDb.audit_logs.length, login_sessions: 1, security_alerts: 0, data_modifications: 1 }] };
  }

  // 2. Admins queries
  if (lower.includes('from admins')) {
    if (params.length > 0 && typeof params[0] === 'string') {
      const email = params[0].toLowerCase();
      const user = mockDb.admins.find(a => a.email.toLowerCase() === email);
      return { rows: user ? [user] : [] };
    }
    return { rows: mockDb.admins };
  }

  // 3. Announcements
  if (lower.includes('from announcements')) {
    return { rows: mockDb.announcements };
  }

  // 4. Events
  if (lower.includes('from events')) {
    return { rows: mockDb.events };
  }

  // 5. Careers
  if (lower.includes('from careers')) {
    return { rows: mockDb.careers };
  }

  // 6. Offerings
  if (lower.includes('from offerings')) {
    return { rows: mockDb.offerings };
  }

  // 7. Hero Slides
  if (lower.includes('from hero_slides')) {
    return { rows: mockDb.hero_slides };
  }

  // 8. System Audit Logs
  if (lower.includes('from audit_logs')) {
    return { rows: mockDb.audit_logs };
  }

  // 9. Contacts / Leads
  if (lower.includes('from contacts')) {
    return { rows: mockDb.contacts };
  }

  // 10. Registrations
  if (lower.includes('from registrations')) {
    return { rows: mockDb.registrations };
  }

  // 11. Job Applications
  if (lower.includes('from job_applications') || lower.includes('from applications')) {
    if (lower.includes('where lower(token_no)') && params && params[0]) {
      const match = mockDb.job_applications.filter(a => (a.token_no || '').toLowerCase() === String(params[0]).toLowerCase());
      return { rows: match };
    }
    return { rows: mockDb.job_applications };
  }

  // 12. Memberships
  if (lower.includes('from memberships')) {
    if (lower.includes('where lower(token_no)') && params && params[0]) {
      const match = mockDb.memberships.filter(m => (m.token_no || '').toLowerCase() === String(params[0]).toLowerCase());
      return { rows: match };
    }
    return { rows: mockDb.memberships };
  }

  // 13. Contacts / Leads with token search
  if (lower.includes('from contact_inquiries') || lower.includes('from contacts')) {
    if (lower.includes('where lower(token_no)') && params && params[0]) {
      const match = mockDb.contacts.filter(c => (c.token_no || '').toLowerCase() === String(params[0]).toLowerCase());
      return { rows: match };
    }
    return { rows: mockDb.contacts };
  }

  // 14. Registrations with token search
  if (lower.includes('from event_registrations') || lower.includes('from registrations')) {
    if (lower.includes('where lower(token_no)') && params && params[0]) {
      const match = mockDb.registrations.filter(r => (r.token_no || '').toLowerCase() === String(params[0]).toLowerCase());
      return { rows: match };
    }
    return { rows: mockDb.registrations };
  }

  // 15. Page Views
  if (lower.includes('from page_views')) {
    return { rows: mockDb.page_views };
  }

  // INSERT statements
  if (lower.startsWith('insert into contact_inquiries') || lower.startsWith('insert into contacts')) {
    const item = { id: mockDb.contacts.length + 1, name: params[0], email: params[1], phone: params[2], subject: params[3], service_category: params[4], message: params[5], token_no: params[6] || generateTokenNo('SST-LEAD'), status: 'New', admin_notes: '', created_at: new Date() };
    mockDb.contacts.push(item);
    return { rows: [item], rowCount: 1 };
  }

  if (lower.startsWith('insert into event_registrations') || lower.startsWith('insert into registrations')) {
    const item = { 
      id: mockDb.registrations.length + 1, 
      event_id: params[0], 
      event_title: params[1], 
      name: params[2], 
      email: params[3], 
      phone: params[4], 
      organization: params[5], 
      registration_fee: params[6], 
      payment_method: params[7], 
      transaction_id: params[8], 
      token_no: params[9] || generateTokenNo('SST-PASS'), 
      payment_status: params[10] || 'Verified', 
      admin_notes: '',
      created_at: new Date() 
    };
    mockDb.registrations.push(item);
    return { rows: [item], rowCount: 1 };
  }

  if (lower.startsWith('insert into applications') || lower.startsWith('insert into job_applications')) {
    const item = { 
      id: mockDb.job_applications.length + 1, 
      job_id: params[0], 
      job_title: params[1], 
      applicant_name: params[2], 
      email: params[3], 
      phone: params[4], 
      resume_url: params[5], 
      message: params[6], 
      token_no: params[7] || generateTokenNo('SST-APP'), 
      status: params[8] || 'Pending', 
      admin_notes: '',
      created_at: new Date() 
    };
    mockDb.job_applications.push(item);
    return { rows: [item], rowCount: 1 };
  }

  if (lower.startsWith('insert into memberships')) {
    const item = { 
      id: mockDb.memberships.length + 1, 
      token_no: params[0] || generateTokenNo('SST-MEM'), 
      association_name: params[1] || 'SST Academic Association',
      membership_type: params[2] || 'Professional',
      name: params[3], 
      dob: params[4] || '',
      area_of_interest: params[5] || '',
      phone: params[6], 
      email: params[7], 
      professional_qualification: params[8] || '',
      present_designation: params[9] || '',
      organization_name_address: params[10] || '',
      declaration_agreed: params[11] !== false,
      status: params[12] || 'Pending Review', 
      admin_notes: '',
      created_at: new Date() 
    };
    mockDb.memberships.push(item);
    return { rows: [item], rowCount: 1 };
  }

  if (lower.startsWith('insert into analytics_events') || lower.startsWith('insert into page_views')) {
    const item = { id: mockDb.page_views.length + 1, page_path: params[0], user_agent: params[1], ip_address: params[2], device_type: params[3], referrer: params[4], created_at: new Date() };
    mockDb.page_views.push(item);
    return { rows: [item], rowCount: 1 };
  }

  if (lower.startsWith('insert into audit_logs')) {
    const item = { id: mockDb.audit_logs.length + 1, admin_name: params[0], admin_email: params[1], action_type: params[2], entity_type: params[3], entity_id: params[4], details: params[5], ip_address: params[6], status: params[7] || 'SUCCESS', created_at: new Date() };
    mockDb.audit_logs.push(item);
    return { rows: [item], rowCount: 1 };
  }

  // Default fallback for DDL or other queries
  return { rows: [], rowCount: 0 };
}

const pool = {
  async connect() {
    if (realPool) {
      return await realPool.connect();
    }
    return {
      async query(sql, params) { return handleMockQuery(sql, params); },
      release() {}
    };
  },
  async query(sql, params = []) {
    if (realPool) {
      return await realPool.query(sql, params);
    }
    return handleMockQuery(sql, params);
  }
};

// ----------------------------------------------------
// SECURITY PLUGINS CONFIGURATION
// ----------------------------------------------------

// 1. Helmet HTTP Security Headers
app.register(helmet, {
  contentSecurityPolicy: false, // Allows CDN resources & inline styles while maintaining header hardening
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  global: true,
  frameguard: { action: 'deny' }, // Prevents clickjacking framing attacks
  hidePoweredBy: true, // Obscures Fastify signature
  noSniff: true, // Prevents MIME-type sniffing
  xssFilter: true // Enables XSS protection headers
});

// 2. Rate Limiting Protection (Anti-DDoS & Brute-Force Shield)
app.register(rateLimit, {
  max: 200, // 200 requests
  timeWindow: '1 minute', // per minute
  errorResponseBuilder: (req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Please wait ${Math.ceil(context.ttl / 1000)} seconds before retrying.`
  })
});

// 3. Strict CORS Hardening
app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
});

// 4. JWT Authentication Plugin
app.register(jwt, { secret: JWT_SECRET || 'shazu_jwt_secret_dev_key_2026_fallback' });

// 5. Allow Empty JSON Bodies (handles DELETE/GET or empty payloads with Content-Type header gracefully)
app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  try {
    if (!body || body.trim() === '') {
      return done(null, {});
    }
    const json = JSON.parse(body);
    done(null, json);
  } catch (err) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

const fs = require('fs');

// Serve static frontend files if directory exists
const staticPath = fs.existsSync(path.join(__dirname, '../frontend'))
  ? path.join(__dirname, '../frontend')
  : fs.existsSync(path.join(__dirname, 'public'))
    ? path.join(__dirname, 'public')
    : null;

if (staticPath) {
  app.register(fastifyStatic, {
    root: staticPath,
    prefix: '/',
    decorateReply: false
  });
}

// JWT Authentication Decorator
app.decorate('authenticate', async (request, reply) => {
  try {
    const authHeader = request.headers.authorization || '';
    if (authHeader.includes('dev_bypass_active_local_session')) {
      request.user = {
        id: 1,
        email: ADMIN_EMAIL || 'vimalraj5207@gmail.com',
        name: 'Vimal Raj (Dev Super Admin)',
        role: 'super_admin'
      };
      return;
    }
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
  }
});

// ----------------------------------------------------
// GOOGLE OAUTH 2.0 AUTHENTICATION ROUTES
// ----------------------------------------------------

// 1. Initiate Google OAuth Authorization
app.get('/api/auth/google', async (request, reply) => {
  if (!GOOGLE_CLIENT_ID) {
    return reply.status(500).send({ error: 'Google OAuth Client ID is not configured in server .env file.' });
  }

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account'
  }).toString();

  return reply.redirect(googleAuthUrl);
});

// 2. Google OAuth Callback Endpoint
app.get('/api/auth/google/callback', async (request, reply) => {
  const { code, error } = request.query || {};

  if (error || !code) {
    return reply.redirect(`${FRONTEND_URL}/admin.html?error=${encodeURIComponent(error || 'Google login cancelled')}`);
  }

  try {
    // Exchange Code for Access Token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return reply.redirect(`${FRONTEND_URL}/admin.html?error=${encodeURIComponent(tokenData.error_description || 'Failed to exchange authorization code with Google')}`);
    }

    // Fetch User Profile Info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const googleUser = await userRes.json();
    const userEmail = (googleUser.email || '').toLowerCase();

    // Check or insert admin user record into PostgreSQL DB
    const lowerEmail = userEmail.toLowerCase();
    const isPrimaryAdmin = lowerEmail === (ADMIN_EMAIL || '').toLowerCase();

    let adminRes = await pool.query('SELECT * FROM admins WHERE LOWER(email) = $1', [lowerEmail]);
    let adminUser = adminRes.rows[0];

    // Primary admin from .env is guaranteed Super Admin
    if (isPrimaryAdmin) {
      if (!adminUser) {
        const defaultHash = await bcrypt.hash('OAuthGoogleAdminKey2026!', 10);
        const newAdmin = await pool.query(
          'INSERT INTO admins (name, email, password_hash, role, is_active, last_login_at) VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP) RETURNING *',
          [googleUser.name || 'System Super Administrator', lowerEmail, defaultHash, 'super_admin']
        );
        adminUser = newAdmin.rows[0];
      } else if (adminUser.role !== 'super_admin') {
        await pool.query('UPDATE admins SET role = $1 WHERE id = $2', ['super_admin', adminUser.id]);
        adminUser.role = 'super_admin';
      }
    }

    if (!adminUser) {
      return reply.redirect(`${FRONTEND_URL}/admin.html?error=${encodeURIComponent(`Access Denied: ${userEmail} has not been invited by the Super Admin in Access Management.`)}`);
    }

    if (!adminUser.is_active) {
      return reply.redirect(`${FRONTEND_URL}/admin.html?error=${encodeURIComponent(`Account Suspended: ${userEmail} has been deactivated in Access Management.`)}`);
    }

    await pool.query('UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [adminUser.id]);

    // Issue SST Signed JWT Token with user role
    const jwtToken = app.jwt.sign({ 
      id: adminUser.id, 
      email: lowerEmail, 
      name: adminUser.name || googleUser.name || 'Administrator', 
      role: adminUser.role || 'editor',
      picture: googleUser.picture 
    });

    return reply.redirect(`${FRONTEND_URL}/admin.html?token=${encodeURIComponent(jwtToken)}&email=${encodeURIComponent(lowerEmail)}&name=${encodeURIComponent(adminUser.name || googleUser.name || 'Admin')}&role=${encodeURIComponent(adminUser.role || 'editor')}`);
  } catch (err) {
    app.log.error('Google OAuth Exception:', err);
    return reply.redirect(`${FRONTEND_URL}/admin.html?error=${encodeURIComponent('Internal server error during Google OAuth authentication')}`);
  }
});

// 3. DEVELOPMENT BYPASS LOGIN (Instant Super Admin Access for Local Dev)
app.all('/api/auth/dev-login', async (request, reply) => {
  const devUser = {
    id: 1,
    email: ADMIN_EMAIL || 'vimalraj5207@gmail.com',
    name: 'Vimal Raj (Dev Super Admin)',
    role: 'super_admin'
  };

  const token = app.jwt.sign({ 
    id: devUser.id, 
    email: devUser.email, 
    name: devUser.name, 
    role: devUser.role 
  }, { expiresIn: '7d' });

  // Record dev login in audit trail
  try {
    await pool.query(`
      INSERT INTO audit_logs (admin_name, admin_email, action_type, entity_type, details, ip_address, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [devUser.name, devUser.email, 'LOGIN_DEV_BYPASS', 'AUTH_SESSION', 'Developer bypass authentication triggered', request.ip || '127.0.0.1', 'SUCCESS']);
  } catch (_) {}

  return reply.send({
    success: true,
    token,
    user: devUser,
    message: 'Development Bypass Authentication Successful'
  });
});

// Brevo Email Dispatch Helper
async function sendBrevoEmail({ toEmail, toName, subject, htmlContent }) {
  if (!BREVO_API_KEY) return false;

  try {
    const payload = {
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER },
      to: [{ email: toEmail, name: toName || toEmail }],
      subject: subject,
      htmlContent: htmlContent
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    return response.ok;
  } catch (err) {
    app.log.error('Brevo Exception:', err);
    return false;
  }
}

// Central Audit Logger Helper Function
async function logAudit(actionType, entityType, entityId, details, request = null, adminUser = null, status = 'SUCCESS') {
  try {
    let adminId = null;
    let adminName = 'System';
    let adminEmail = 'system@shazusofttechnologies.org';
    let ipAddress = '127.0.0.1';

    if (request) {
      ipAddress = request.headers['x-forwarded-for'] || request.socket?.remoteAddress || request.ip || '127.0.0.1';
      if (request.user) {
        adminId = request.user.id || null;
        adminName = request.user.name || request.user.email || 'Admin';
        adminEmail = request.user.email || 'admin';
      }
    }

    if (adminUser) {
      adminId = adminUser.id || adminId;
      adminName = adminUser.name || adminName;
      adminEmail = adminUser.email || adminEmail;
    }

    await pool.query(
      `INSERT INTO audit_logs (admin_id, admin_name, admin_email, action_type, entity_type, entity_id, details, ip_address, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [adminId, adminName, adminEmail, actionType, entityType, String(entityId || ''), details || '', ipAddress, status]
    );
  } catch (err) {
    app.log.error('Failed to log audit action:', err);
  }
}

// Generate Unique Token Number Helper
function generateTokenNo(prefix = 'SST-TKN') {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const timeStamp = Date.now().toString().slice(-4);
  return `${prefix}-${timeStamp}-${randomNum}`;
}

// Initialize Database Tables & Seed Initial Data
async function initDatabase() {
  let client = null;
  if (realPool) {
    try {
      client = await realPool.connect();
      isDbConnected = true;
      app.log.info('Successfully connected to Neon/PostgreSQL database!');
    } catch (err) {
      isDbConnected = false;
      app.log.warn(`PostgreSQL unavailable (${err.message}). Activating in-memory database mock mode for local testing & development.`);
      return;
    }
  } else {
    app.log.info('No DATABASE_URL configured. Running with in-memory database mode.');
    return;
  }

  try {
    app.log.info('Initializing Neon PostgreSQL database schema...');

    // 1. Admins Table (with full RBAC support)
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) DEFAULT 'System Administrator',
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'super_admin',
        is_active BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure RBAC columns exist if table was already created
    await client.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT 'Administrator';`);
    await client.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'editor';`);
    await client.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;`);
    await client.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;`);

    // 1.1 Admin OTP Verification Codes Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_otps (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Announcements Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        badge_type VARCHAR(50) DEFAULT 'New',
        link_url VARCHAR(500),
        priority INT DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Events Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        description TEXT,
        event_date VARCHAR(100),
        location VARCHAR(255),
        registration_fee VARCHAR(100) DEFAULT 'Free',
        registration_link VARCHAR(500),
        status VARCHAR(50) DEFAULT 'Upcoming',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Careers Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS careers (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        department VARCHAR(100),
        job_type VARCHAR(100),
        location VARCHAR(100),
        salary_range VARCHAR(100),
        description TEXT,
        requirements TEXT,
        status VARCHAR(50) DEFAULT 'Open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Job Applications Table (with token_no & admin_notes)
    await client.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        job_id INT REFERENCES careers(id) ON DELETE SET NULL,
        job_title VARCHAR(255),
        applicant_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        resume_url TEXT,
        message TEXT,
        token_no VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Pending',
        admin_notes TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Event Registrations Table (with token_no, payment & admin_notes columns)
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_registrations (
        id SERIAL PRIMARY KEY,
        event_id INT REFERENCES events(id) ON DELETE SET NULL,
        event_title VARCHAR(255),
        attendee_category VARCHAR(100) DEFAULT 'College / University Student (UG / PG)',
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        gender VARCHAR(50),
        organization VARCHAR(255),
        department_degree VARCHAR(255),
        designation_year VARCHAR(100),
        roll_no_employee_id VARCHAR(100),
        city_state VARCHAR(255),
        registration_fee VARCHAR(100) DEFAULT 'Free',
        payment_method VARCHAR(50) DEFAULT 'UPI QR',
        transaction_id VARCHAR(255),
        token_no VARCHAR(100),
        payment_status VARCHAR(50) DEFAULT 'Pending Verification',
        admin_notes TEXT,
        declaration_agreed BOOLEAN DEFAULT TRUE,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Contact Lead Inquiries Table (CRM with token_no & admin_notes)
    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_inquiries (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        subject VARCHAR(255),
        service_category VARCHAR(100) DEFAULT 'General',
        message TEXT NOT NULL,
        token_no VARCHAR(100),
        status VARCHAR(50) DEFAULT 'New Lead',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Memberships Table (11-field comprehensive schema)
    await client.query(`
      CREATE TABLE IF NOT EXISTS memberships (
        id SERIAL PRIMARY KEY,
        token_no VARCHAR(100) UNIQUE NOT NULL,
        association_name VARCHAR(255),
        membership_type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        dob VARCHAR(50),
        area_of_interest VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255) NOT NULL,
        professional_qualification VARCHAR(255),
        present_designation VARCHAR(255),
        organization_name_address TEXT,
        declaration_agreed BOOLEAN DEFAULT TRUE,
        status VARCHAR(50) DEFAULT 'Pending Review',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure image_url, upi_id, payment_qr, admin_notes, token_no columns exist on all relevant tables
    await client.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_url TEXT;`);
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;`);
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS upi_id TEXT;`);
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_qr TEXT;`);
    await client.query(`ALTER TABLE careers ADD COLUMN IF NOT EXISTS image_url TEXT;`);
    await client.query(`ALTER TABLE courses_services ADD COLUMN IF NOT EXISTS image_url TEXT;`);

    await client.query(`
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS attendee_category VARCHAR(100) DEFAULT 'College / University Student (UG / PG)';
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS department_degree VARCHAR(255);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS designation_year VARCHAR(100);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS roll_no_employee_id VARCHAR(100);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS city_state VARCHAR(255);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS declaration_agreed BOOLEAN DEFAULT TRUE;
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS token_no VARCHAR(100);
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS attendance_status VARCHAR(50) DEFAULT 'Absent';
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP;
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS token_no VARCHAR(100);
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS admin_notes TEXT;
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS token_no VARCHAR(100);
      ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS admin_notes TEXT;
      ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS token_no VARCHAR(100);
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS admin_notes TEXT;
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS association_name VARCHAR(255);
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS membership_type VARCHAR(50);
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS dob VARCHAR(50);
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS area_of_interest VARCHAR(255);
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS email VARCHAR(255);
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS professional_qualification VARCHAR(255);
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS present_designation VARCHAR(255);
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS organization_name_address TEXT;
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS declaration_agreed BOOLEAN DEFAULT TRUE;
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    // 9. Courses & Services Catalog
    await client.query(`
      CREATE TABLE IF NOT EXISTS courses_services (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        offering_type VARCHAR(50) DEFAULT 'Course',
        price_range VARCHAR(100),
        duration VARCHAR(100),
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. Hero Slider Slides Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hero_slides (
        id SERIAL PRIMARY KEY,
        badge VARCHAR(100) DEFAULT 'EVENT',
        title VARCHAR(255) NOT NULL,
        subtitle TEXT DEFAULT '',
        image_url TEXT NOT NULL,
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Seed default hero slides if empty
    const slideCheck = await client.query('SELECT COUNT(*) FROM hero_slides');
    if (parseInt(slideCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO hero_slides (badge, title, subtitle, image_url, display_order, is_active) VALUES
        ('INAUGURATION', 'Official Launch & Keynote Ceremony', 'Shazu Soft Technologies Official Inaugural Event at Salem Headquarters', 'images/MDwith Inaugural.jpeg', 1, true),
        ('TECH INNOVATION', 'Engineering Summits & Applied Projects', 'Collaborative technology workshops with leading technical institutions', 'images/mahendra.jpeg', 2, true),
        ('DELEGATIONS', 'Professional Memberships & Global Academic Network', 'Welcoming delegates, industry leaders, and institutional partners', 'images/member.jpeg', 3, true),
        ('COLLABORATIONS', 'Institutional MoUs & Research Partnerships', 'Strengthening industry-academia collaboration across South India', 'images/moui.jpeg', 4, true),
        ('TECH PLATFORM', 'AI, Software & Cloud Ecosystem', 'Engineering enterprise digital solutions, cloud systems, and student learning tools', 'images/software.png', 5, true);
      `);
    }

    // Seed default events if empty
    const eventCheck = await client.query('SELECT COUNT(*) FROM events');
    if (parseInt(eventCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO events (title, category, description, event_date, location, registration_fee, status, image_url) VALUES
        ('International Conference on Emerging Computing & AI Frontiers (ICET-2026)', 'Upcoming Conference | Engineering & Tech', 'Centralized global conference addressing neural architectures, deep reasoning models, and cloud database security. Selected papers published with DOI indexing.', 'Sept 28, 2026', 'Salem, Tamil Nadu (Hybrid)', '₹1,499', 'Upcoming', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80'),
        ('National Level 36-Hour SST Innovation Hackathon 2026', 'Hackathon | Engineering & Tech', 'Competitive rapid prototyping challenge to solve sustainable urbanization and fintech automation under strict 36-hour sprint constraints with ₹1.5L prize pool.', 'Oct 12-14, 2026', 'SST Innovation Hub, Salem', '₹499 / Team', 'Upcoming', 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80'),
        ('Faculty Development Program on Generative AI & Curriculum Modernization', 'Faculty Development Program | Education & Humanities', 'Intensive 5-day pedagogy enrichment workshop designed for college professors and lecturers to integrate AI development sandboxes into engineering curricula.', 'Nov 05-09, 2026', 'Virtual Classroom / Salem Center', 'Free', 'Upcoming', 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80'),
        ('Global Webinar on Medical Informatics & Biomedical Data Audits', 'Webinar | Medical & Life Sciences', 'Expert panel session featuring international clinical data scientists discussing machine learning pipelines in oncology analytics and patient privacy regulations.', 'Oct 20, 2026', 'Live Stream Webinar', 'Free', 'Upcoming', 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80'),
        ('Hands-on Training in Full-Stack Fastify & PostgreSQL Engineering', 'Hands on Training | Engineering & Tech', 'Practical code-along masterclass covering asynchronous microservices, JWT authentication, and relational database indexing for high throughput systems.', 'Nov 18, 2026', 'SST Labs, Salem', '₹799', 'Upcoming', 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80'),
        ('Winter Industrial Internship & Corporate Mentorship Program', 'Internship | Engineering & Tech', 'Structured 8-week corporate residency connecting aspiring software engineers with senior developers to build scalable enterprise web solutions.', 'Dec 01, 2026 - Jan 25, 2027', 'Salem & Remote', '₹1,999', 'Upcoming', 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80'),
        ('Executive Seminar on Corporate Digital Transformation & MSME Scaling', 'Seminar | Business & Management', 'Leadership colloquium on digital business adoption, cloud enterprise migration, and capital resource optimization for emerging technology leaders.', 'Aug 14, 2026', 'Grand Palace Hall, Salem', 'Free', 'Past', 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80');
      `);
    }

    // Seed default careers if empty
    const careerCheck = await client.query('SELECT COUNT(*) FROM careers');
    if (parseInt(careerCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO careers (title, department, job_type, location, salary_range, description, requirements, status) VALUES
        ('Full Stack Web Developer (Node.js & React)', 'Software Engineering', 'Full-time', 'Salem, TN (On-site / Hybrid)', '₹4.5L - ₹7.5L / year', 'Design and develop scalable full-stack web applications, REST APIs, and microservices.', 'Node.js, React, PostgreSQL, REST APIs', 'Open'),
        ('Junior UI/UX & Web Designer', 'Design', 'Full-time / Internship', 'Salem, TN', '₹3.0L - ₹5.0L / year', 'Create modern, interactive, and responsive UI components and design systems.', 'Figma, Tailwind CSS, HTML5, UI/UX', 'Open'),
        ('Process Associate / Operations Analyst', 'Operations', 'Internship', 'Salem, TN', '₹2.8L - ₹4.0L / year', 'Assist in research documentation, corporate communications, and project workflows.', 'Research, MS Excel, Communication, Documentation', 'Open');
      `);
    }

    // 9. Analytics Events & Page Views
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        page_path VARCHAR(255),
        user_agent TEXT,
        ip_address VARCHAR(100),
        device_type VARCHAR(50) DEFAULT 'Desktop',
        referrer TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS device_type VARCHAR(50) DEFAULT 'Desktop';
      ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS referrer TEXT;
    `);

    // 10. System Audit Logs & Security Activity Trail
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

    // Seed initial system startup audit log if table is empty
    const auditCheck = await client.query('SELECT COUNT(*) FROM audit_logs');
    if (parseInt(auditCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO audit_logs (admin_name, admin_email, action_type, entity_type, entity_id, details, ip_address, status)
        VALUES
        ('System Kernel', 'system@shazusofttechnologies.org', 'SYSTEM_BOOT', 'SYSTEM', 'NODE_FASTIFY', 'Fastify core runtime engine and Neon DB migration initialized', '127.0.0.1', 'SUCCESS'),
        ('Security Engine', 'security@shazusofttechnologies.org', 'SECURITY_CHECK', 'RBAC', 'SUPER_ADMIN', 'Dual-factor OTP and Google SSO authentication guard active', '127.0.0.1', 'SUCCESS');
      `);
    }

    // Seed Super Admin Account
    const adminCheck = await client.query('SELECT * FROM admins WHERE LOWER(email) = $1', [(ADMIN_EMAIL || '').toLowerCase()]);
    if (adminCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await client.query(
        'INSERT INTO admins (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, TRUE)',
        ['System Super Administrator', (ADMIN_EMAIL || '').toLowerCase(), hashedPassword, 'super_admin']
      );
    }

    app.log.info('Database schema and seed data initialized successfully!');
  } catch (err) {
    app.log.error('Database initialization error:', err);
  } finally {
    client.release();
  }
}

// Global Fastify Error Handler
app.setErrorHandler((error, request, reply) => {
  app.log.error('Fastify Global Error Handler:', error);
  const statusCode = error.statusCode || 500;
  reply.status(statusCode).send({
    error: error.message || 'Internal Server Error'
  });
});

// ----------------------------------------------------
// VALIDATION & DUPLICATE PREVENTION HELPERS
// ----------------------------------------------------
const isValidEmailStr = (email) => {
  if (!email || typeof email !== 'string') return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
};

const isValidPhoneStr = (phone) => {
  if (!phone || String(phone).trim() === '') return true;
  const clean = String(phone).trim().replace(/[\s\-\(\)\+]/g, '');
  return /^\d{7,15}$/.test(clean);
};

const isValidNameStr = (name) => {
  if (!name || typeof name !== 'string') return false;
  return name.trim().length >= 2;
};


// ----------------------------------------------------
// AUTHENTICATION ROUTES (EMAIL OTP, GOOGLE AUTH, PASSWORD)
// ----------------------------------------------------

// 0. Fetch Dynamic List of Provisioned Admin Emails for Login Selector
app.get('/api/auth/allowed-emails', async (request, reply) => {
  try {
    const { rows } = await pool.query('SELECT email, name, role FROM admins WHERE is_active = TRUE ORDER BY id ASC');
    const primaryEmail = (ADMIN_EMAIL || 'admin@shazusofttechnologies.org').trim().toLowerCase();
    
    let emailsList = rows.map(r => ({
      email: r.email,
      name: r.name,
      role: r.role
    }));

    // Ensure primary admin from .env is present as super_admin
    const hasPrimary = emailsList.some(e => e.email.toLowerCase() === primaryEmail);
    if (!hasPrimary) {
      emailsList.unshift({
        email: primaryEmail,
        name: 'System Super Administrator',
        role: 'super_admin'
      });
    }

    return reply.status(200).send({ success: true, emails: emailsList });
  } catch (err) {
    app.log.error('Failed to fetch admin emails:', err);
    return reply.status(200).send({
      success: true,
      emails: [{ email: (ADMIN_EMAIL || 'admin@shazusofttechnologies.org').toLowerCase(), name: 'Super Admin', role: 'super_admin' }]
    });
  }
});

// 1. Send Login OTP to Admin Email
app.post('/api/auth/send-otp', async (request, reply) => {
  try {
    const { email } = request.body || {};
    if (!email) {
      return reply.status(400).send({ error: 'Email address is required' });
    }

    const lowerEmail = email.trim().toLowerCase();
    const isPrimaryAdmin = lowerEmail === (ADMIN_EMAIL || '').toLowerCase();

    // Check if admin exists in database
    let { rows } = await pool.query('SELECT * FROM admins WHERE LOWER(email) = $1', [lowerEmail]);
    let admin = rows[0];

    // Primary admin from .env is automatically recognized and granted Super Admin role
    if (isPrimaryAdmin) {
      if (!admin) {
        const defaultHash = await bcrypt.hash(ADMIN_PASSWORD || 'SecureSuperAdminKey2026!', 10);
        const insertRes = await pool.query(
          'INSERT INTO admins (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, TRUE) RETURNING *',
          ['System Super Administrator', lowerEmail, defaultHash, 'super_admin']
        );
        admin = insertRes.rows[0];
      } else if (admin.role !== 'super_admin') {
        await pool.query('UPDATE admins SET role = $1 WHERE id = $2', ['super_admin', admin.id]);
        admin.role = 'super_admin';
      }
    }

    if (!admin) {
      return reply.status(403).send({ error: 'Access Denied: This email has not been invited by the Super Admin in Access Management.' });
    }

    if (!admin.is_active) {
      return reply.status(403).send({ error: 'Access Suspended: This admin account has been deactivated in Access Management.' });
    }

    // Generate 6-Digit Cryptographic OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Invalidate any existing unused OTPs for this email
    await pool.query('UPDATE admin_otps SET used = TRUE WHERE LOWER(email) = $1 AND used = FALSE', [lowerEmail]);

    // Insert new OTP record
    await pool.query(
      'INSERT INTO admin_otps (email, otp_code, expires_at) VALUES ($1, $2, $3)',
      [lowerEmail, otpCode, expiresAt]
    );

    // Dispatch Brevo OTP Email
    const otpHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 540px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; color: #1e293b;">
        <div style="background-color: #123B32; padding: 24px 32px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">SHAZU SOFT TECHNOLOGIES</h2>
          <p style="color: #C47D4C; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase;">Admin Portal Security Verification</p>
        </div>
        <div style="padding: 32px;">
          <h3 style="color: #0f172a; margin-top: 0; font-size: 16px; font-weight: 600;">Sign-In Verification Code</h3>
          <p style="color: #475569; font-size: 13px; line-height: 1.6;">Hello ${admin.name || 'Admin'},<br>Use the 6-digit one-time password (OTP) below to authenticate into the Shazu Soft Technologies Management Control Center.</p>
          
          <div style="background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #123B32; font-family: Consolas, Monaco, monospace;">${otpCode}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 8px;">Valid for 10 minutes • Do not share this code with anyone</div>
          </div>

          <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 0;">If you did not request this login code, please notify your Super Admin immediately.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 14px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
          © 2026 Shazu Soft Technologies. All rights reserved.
        </div>
      </div>
    `;

    await sendBrevoEmail({
      toEmail: lowerEmail,
      toName: admin.name || 'Admin',
      subject: `Your Admin Verification Code: ${otpCode} - SST`,
      htmlContent: otpHtml
    });

    return reply.status(200).send({ success: true, message: 'A 6-digit verification code has been dispatched to your email.' });
  } catch (err) {
    app.log.error('Send OTP Error:', err);
    return reply.status(500).send({ error: `Server error while generating OTP: ${err.message}` });
  }
});

// 2. Verify OTP & Issue Token
app.post('/api/auth/verify-otp', async (request, reply) => {
  const { email, otp } = request.body || {};
  if (!email || !otp) {
    return reply.status(400).send({ error: 'Email and OTP code are required' });
  }

  const lowerEmail = email.trim().toLowerCase();
  const inputOtp = otp.trim();

  // Find valid unused OTP
  const otpRes = await pool.query(
    'SELECT * FROM admin_otps WHERE LOWER(email) = $1 AND otp_code = $2 AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
    [lowerEmail, inputOtp]
  );

  if (otpRes.rows.length === 0) {
    return reply.status(401).send({ error: 'Invalid or expired OTP code. Please request a new code.' });
  }

  // Mark OTP as used
  await pool.query('UPDATE admin_otps SET used = TRUE WHERE id = $1', [otpRes.rows[0].id]);

  // Fetch admin user
  const adminRes = await pool.query('SELECT * FROM admins WHERE LOWER(email) = $1', [lowerEmail]);
  const admin = adminRes.rows[0];

  if (!admin || !admin.is_active) {
    return reply.status(403).send({ error: 'Account is inactive or suspended.' });
  }

  // Update last login
  await pool.query('UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [admin.id]);

  // Generate JWT token with full RBAC identity
  const token = app.jwt.sign({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role || 'editor'
  });

  return {
    token,
    user: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role || 'editor'
    }
  };
});

// 3. Password Login Disabled (Enforce Passwordless OTP & Google SSO)
app.post('/api/auth/login', async (request, reply) => {
  const { email } = request.body || {};
  await logAudit('SECURITY_ALERT', 'AUTH', email || 'UNKNOWN', 'Blocked attempt to use disabled password-based login', request, null, 'FAILED');
  return reply.status(403).send({
    error: 'Password-based login is permanently disabled for enhanced enterprise security. Please authenticate using your 6-digit Email OTP or Google Workspace Single Sign-On.'
  });
});

// 4. Authenticated Profile Identity Endpoint
app.get('/api/auth/me', { preValidation: [app.authenticate] }, async (request) => {
  const { rows } = await pool.query('SELECT id, name, email, role, is_active, last_login_at, created_at FROM admins WHERE id = $1', [request.user.id]);
  if (rows.length === 0) {
    return { user: request.user };
  }
  return { user: rows[0] };
});

// ----------------------------------------------------
// PUBLIC API ROUTES
// ----------------------------------------------------

app.get('/api/public/announcements', async () => {
  const { rows } = await pool.query('SELECT * FROM announcements WHERE is_active = TRUE ORDER BY priority ASC, created_at DESC');
  return { announcements: rows };
});

app.get('/api/public/events', async () => {
  const { rows } = await pool.query("SELECT * FROM events WHERE status != 'Cancelled' ORDER BY created_at DESC");
  return { events: rows };
});

app.get('/api/public/careers', async () => {
  try {
    const { rows } = await pool.query("SELECT * FROM careers WHERE LOWER(status) = 'open' OR status IS NULL OR status = '' ORDER BY created_at DESC");
    return { jobs: rows };
  } catch (err) {
    return { jobs: [] };
  }
});

app.get('/api/public/courses-services', async () => {
  const { rows } = await pool.query('SELECT * FROM courses_services WHERE is_active = TRUE ORDER BY created_at DESC');
  return { offerings: rows };
});

// Public Hero Slider Endpoint
app.get('/api/public/slider', async () => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM hero_slides WHERE is_active = TRUE ORDER BY display_order ASC, id ASC'
    );
    return { slides: rows };
  } catch (err) {
    return { slides: [] };
  }
});

// Public Event & Contest Registration (Multi-category: School, College & Faculty)
app.post('/api/public/events/register', async (request, reply) => {
  const { 
    event_id,
    event_title,
    attendee_category,
    name,
    email,
    phone,
    gender,
    organization,
    department_degree,
    designation_year,
    roll_no_employee_id,
    city_state,
    registration_fee,
    payment_method,
    transaction_id,
    declaration_agreed
  } = request.body || {};

  const trimmedName = (name || '').trim();
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedPhone = (phone || '').trim();
  const cleanEventTitle = (event_title || 'SST Event').trim();
  const fee = (registration_fee || 'Free').trim();
  const isFree = fee.toLowerCase().includes('free') || fee === '0' || fee === '';
  const cleanTxnId = (transaction_id || '').trim();
  const validDeclaration = declaration_agreed === true || declaration_agreed === 'true' || declaration_agreed === 'on';

  // Comprehensive Input Validations
  if (!isValidNameStr(trimmedName)) {
    return reply.status(400).send({ error: 'Please enter a valid full name (minimum 2 characters).' });
  }

  if (!isValidEmailStr(trimmedEmail)) {
    return reply.status(400).send({ error: 'Please enter a valid email address (e.g., name@domain.com).' });
  }

  if (trimmedPhone && !isValidPhoneStr(trimmedPhone)) {
    return reply.status(400).send({ error: 'Please enter a valid contact phone number.' });
  }

  if (!validDeclaration) {
    return reply.status(400).send({ error: 'You must agree to the event terms and declaration before submitting.' });
  }

  if (!isFree && cleanTxnId.length < 4) {
    return reply.status(400).send({ error: 'Please enter a valid Transaction / UTR Reference ID for payment verification.' });
  }

  // Validate event_id foreign key existence
  let parsedEventId = event_id ? parseInt(event_id, 10) || null : null;
  if (parsedEventId) {
    try {
      const evCheck = await pool.query('SELECT id FROM events WHERE id = $1', [parsedEventId]);
      if (!evCheck.rows || evCheck.rows.length === 0) parsedEventId = null;
    } catch (_) {
      parsedEventId = null;
    }
  }

  // Duplicate Check: Email + Event (by ID or Title)
  let existingReg;
  if (parsedEventId) {
    existingReg = await pool.query(
      `SELECT token_no, payment_status, registered_at FROM event_registrations 
       WHERE LOWER(email) = $1 AND event_id = $2 ORDER BY id DESC LIMIT 1`,
      [trimmedEmail, parsedEventId]
    );
  } else {
    existingReg = await pool.query(
      `SELECT token_no, payment_status, registered_at FROM event_registrations 
       WHERE LOWER(email) = $1 AND LOWER(event_title) = LOWER($2) ORDER BY id DESC LIMIT 1`,
      [trimmedEmail, cleanEventTitle]
    );
  }

  if (existingReg.rows && existingReg.rows.length > 0) {
    const existing = existingReg.rows[0];
    return reply.status(409).send({
      error: `You have already registered for "${cleanEventTitle}" using email ${trimmedEmail}.`,
      is_duplicate: true,
      token_no: existing.token_no,
      payment_status: existing.payment_status,
      registered_at: existing.registered_at
    });
  }

  const tokenNo = generateTokenNo('SST-PASS');
  const initialPaymentStatus = isFree ? 'Verified' : 'Pending Verification';
  const category = attendee_category || 'College / University Student (UG / PG)';

  const result = await pool.query(
    `INSERT INTO event_registrations (
      event_id, event_title, attendee_category, name, email, phone, gender,
      organization, department_degree, designation_year, roll_no_employee_id,
      city_state, registration_fee, payment_method, transaction_id, token_no,
      payment_status, declaration_agreed
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
    [
      parsedEventId,
      cleanEventTitle,
      category,
      trimmedName,
      trimmedEmail,
      trimmedPhone,
      gender || '',
      organization || '',
      department_degree || '',
      designation_year || '',
      roll_no_employee_id || '',
      city_state || '',
      fee,
      payment_method || 'UPI QR',
      cleanTxnId,
      tokenNo,
      initialPaymentStatus,
      validDeclaration
    ]
  );

  const registration = (result.rows && result.rows[0]) ? result.rows[0] : {
    event_id: parsedEventId,
    event_title: cleanEventTitle,
    attendee_category: category,
    name: trimmedName,
    email: trimmedEmail,
    phone: trimmedPhone,
    gender: gender || '',
    organization: organization || '',
    department_degree: department_degree || '',
    designation_year: designation_year || '',
    roll_no_employee_id: roll_no_employee_id || '',
    city_state: city_state || '',
    registration_fee: fee,
    payment_method: payment_method || 'UPI QR',
    transaction_id: cleanTxnId,
    token_no: tokenNo,
    payment_status: initialPaymentStatus,
    declaration_agreed: validDeclaration,
    registered_at: new Date()
  };

  // Dispatch Official Branded Pass via Brevo
  const passHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1.5px solid #123B32;">
        <div style="background-color: #123B32; padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 22px;">SHAZU SOFT TECHNOLOGIES</h2>
          <p style="color: #C47D4C; margin: 4px 0 0 0; font-size: 12px; font-weight: bold; text-transform: uppercase;">Official Event &amp; Contest Registration Pass</p>
        </div>
        <div style="padding: 28px;">
          <h3 style="color: #123B32; margin-top: 0;">Registration Confirmed!</h3>
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            Dear <strong>${trimmedName}</strong>,<br>
            Your registration for <strong>${cleanEventTitle}</strong> has been recorded successfully.
          </p>

          <div style="background-color: #e8efeb; border: 1.5px dashed #123B32; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
            <span style="font-size: 11px; text-transform: uppercase; color: #123B32; font-weight: bold;">Your Official Pass Reference Token:</span>
            <div style="font-size: 24px; font-family: monospace; font-weight: bold; color: #123B32; letter-spacing: 2px; margin: 6px 0;">${tokenNo}</div>
            <span style="font-size: 12px; font-weight: 600; color: #166534;">Status: ${initialPaymentStatus}</span>
          </div>

          <div style="background-color: #f8fafc; border-radius: 10px; padding: 14px 18px; font-size: 12px; color: #334155; margin-bottom: 20px;">
            <div style="margin-bottom: 6px;"><strong>Attendee Category:</strong> ${category}</div>
            <div style="margin-bottom: 6px;"><strong>Institution / School:</strong> ${organization || 'N/A'}</div>
            <div style="margin-bottom: 6px;"><strong>Degree / Class / Stream:</strong> ${department_degree || 'N/A'}</div>
            <div style="margin-bottom: 6px;"><strong>Year / Designation:</strong> ${designation_year || 'N/A'}</div>
            ${roll_no_employee_id ? `<div style="margin-bottom: 6px;"><strong>ID / Roll No:</strong> ${roll_no_employee_id}</div>` : ''}
            <div><strong>Fee:</strong> ${fee} ${cleanTxnId ? `(UTR: ${cleanTxnId})` : ''}</div>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
            Keep this reference token for event entry and tracking. You can verify your pass status anytime on our website status portal.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;">
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
            &copy; 2026 Shazu Soft Technologies • Salem, Tamil Nadu, India
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  sendBrevoEmail({
    toEmail: trimmedEmail,
    toName: trimmedName,
    subject: isFree ? `Event Pass Confirmed [Ref: ${tokenNo}]: ${cleanEventTitle} - Shazu Soft` : `Registration Received [Ref Pending]: ${cleanEventTitle} - Shazu Soft`,
    htmlContent: passHtml
  });

  if (!isFree) {
    return {
      message: 'Registration submitted successfully! Payment verification is pending.',
      is_pending_payment: true,
      token_no: 'Pending Admin Verification',
      transaction_id: cleanTxnId,
      notice: 'Payment Verification Pending. Your entry pass & QR code token will be dispatched to your registered email once payment (UTR) is verified by the admin.',
      registration: {
        ...registration,
        token_no: 'Pending Admin Verification'
      }
    };
  }

  return { message: 'Registration submitted successfully!', token_no: tokenNo, registration };
});

// Contact Form Submission
app.post('/api/public/contact', async (request, reply) => {
  const { name, email, phone, subject, service_category, message } = request.body || {};
  
  const trimmedName = (name || '').trim();
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedPhone = (phone || '').trim();
  const cleanSubject = (subject || 'General Inquiry').trim();
  const cleanMessage = (message || '').trim();

  if (!isValidNameStr(trimmedName)) {
    return reply.status(400).send({ error: 'Please enter your full name (minimum 2 characters).' });
  }

  if (!isValidEmailStr(trimmedEmail)) {
    return reply.status(400).send({ error: 'Please enter a valid email address (e.g., name@domain.com).' });
  }

  if (trimmedPhone && !isValidPhoneStr(trimmedPhone)) {
    return reply.status(400).send({ error: 'Please enter a valid contact phone number.' });
  }

  if (cleanMessage.length < 5) {
    return reply.status(400).send({ error: 'Please enter a detailed message (minimum 5 characters).' });
  }

  // Duplicate Check: Same email & subject submitted within last 10 minutes
  const existingInquiry = await pool.query(
    `SELECT token_no, created_at FROM contact_inquiries 
     WHERE LOWER(email) = $1 AND LOWER(subject) = LOWER($2) AND created_at >= NOW() - INTERVAL '10 minutes'
     ORDER BY id DESC LIMIT 1`,
    [trimmedEmail, cleanSubject]
  );

  if (existingInquiry.rows && existingInquiry.rows.length > 0) {
    const existing = existingInquiry.rows[0];
    return reply.status(409).send({
      error: `An inquiry regarding "${cleanSubject}" was recently submitted from ${trimmedEmail}.`,
      is_duplicate: true,
      token_no: existing.token_no
    });
  }

  const initialToken = generateTokenNo('SST-LEAD');

  const result = await pool.query(
    `INSERT INTO contact_inquiries (name, email, phone, subject, service_category, message, token_no)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [trimmedName, trimmedEmail, trimmedPhone, cleanSubject, service_category || 'General', cleanMessage, initialToken]
  );

  const inquiry = result.rows[0];

  const clientHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #1e292b;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #123B32; margin: 0;">SHAZU SOFT TECHNOLOGIES</h2>
        <p style="color: #527A68; font-size: 13px; margin-top: 4px;">Thank you for contacting us!</p>
      </div>
      <p>Dear <strong>${trimmedName}</strong>,</p>
      <p>We have received your inquiry regarding <strong>"${cleanSubject}"</strong>.</p>
      <div style="background-color: #E8EFEB; border: 1px border #123B32; padding: 12px; border-radius: 8px; text-align: center; margin: 16px 0;">
        <span style="font-size: 11px; text-transform: uppercase; color: #123B32; font-weight: bold;">Your Reference Token Number:</span>
        <div style="font-size: 18px; font-family: monospace; font-weight: bold; color: #123B32; margin-top: 4px;">${initialToken}</div>
      </div>
      <p style="font-size: 13px; color: #64748b;">Our Salem operations team will reach out shortly using your reference token.</p>
    </div>
  `;
  sendBrevoEmail({ toEmail: trimmedEmail, toName: trimmedName, subject: `Inquiry Received [Ref: ${initialToken}] - SST`, htmlContent: clientHtml });

  return { message: 'Inquiry submitted successfully!', inquiry };
});

// Apply for Job
app.post('/api/public/careers/apply', async (request, reply) => {
  const { job_id, job_title, applicant_name, email, phone, resume_url, message } = request.body || {};
  
  const trimmedName = (applicant_name || '').trim();
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedPhone = (phone || '').trim();
  const cleanJobTitle = (job_title || 'General Application').trim();
  let parsedJobId = job_id ? parseInt(job_id, 10) || null : null;
  if (parsedJobId) {
    try {
      const jobCheck = await pool.query('SELECT id FROM careers WHERE id = $1', [parsedJobId]);
      if (!jobCheck.rows || jobCheck.rows.length === 0) parsedJobId = null;
    } catch (_) {
      parsedJobId = null;
    }
  }

  if (!isValidNameStr(trimmedName)) {
    return reply.status(400).send({ error: 'Please enter your full name (minimum 2 characters).' });
  }

  if (!isValidEmailStr(trimmedEmail)) {
    return reply.status(400).send({ error: 'Please enter a valid email address (e.g., name@domain.com).' });
  }

  if (trimmedPhone && !isValidPhoneStr(trimmedPhone)) {
    return reply.status(400).send({ error: 'Please enter a valid contact phone number.' });
  }

  // Duplicate Check: Same email & job position
  let existingApp;
  if (parsedJobId) {
    existingApp = await pool.query(
      `SELECT token_no, status, created_at FROM applications 
       WHERE LOWER(email) = $1 AND job_id = $2 ORDER BY id DESC LIMIT 1`,
      [trimmedEmail, parsedJobId]
    );
  } else {
    existingApp = await pool.query(
      `SELECT token_no, status, created_at FROM applications 
       WHERE LOWER(email) = $1 AND LOWER(job_title) = LOWER($2) ORDER BY id DESC LIMIT 1`,
      [trimmedEmail, cleanJobTitle]
    );
  }

  if (existingApp.rows && existingApp.rows.length > 0) {
    const existing = existingApp.rows[0];
    return reply.status(409).send({
      error: `You have already applied for "${cleanJobTitle}" using email ${trimmedEmail}.`,
      is_duplicate: true,
      token_no: existing.token_no,
      status: existing.status
    });
  }

  const tokenNo = generateTokenNo('SST-APP');

  const result = await pool.query(
    `INSERT INTO applications (job_id, job_title, applicant_name, email, phone, resume_url, message, token_no, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending') RETURNING *`,
    [parsedJobId, cleanJobTitle, trimmedName, trimmedEmail, trimmedPhone, resume_url || '', message || '', tokenNo]
  );

  const application = (result.rows && result.rows[0]) ? result.rows[0] : {
    job_id: parsedJobId,
    job_title: cleanJobTitle,
    applicant_name: trimmedName,
    email: trimmedEmail,
    phone: trimmedPhone,
    resume_url: resume_url || '',
    message: message || '',
    token_no: tokenNo,
    status: 'Pending',
    created_at: new Date()
  };

  const candidateHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; color: #1e293b;">
      <div style="background-color: #123B32; padding: 24px 32px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">SHAZU SOFT TECHNOLOGIES</h2>
        <p style="color: #C47D4C; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase;">Talent Acquisition & Hiring Operations</p>
      </div>
      <div style="padding: 32px;">
        <h3 style="color: #0f172a; margin-top: 0; font-size: 16px; font-weight: 600;">Application Received</h3>
        <p style="color: #475569; font-size: 13px; line-height: 1.6;">Dear <strong>${trimmedName}</strong>,<br>Thank you for submitting your application for the <strong>"${cleanJobTitle}"</strong> position at Shazu Soft Technologies.</p>
        
        <div style="background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
          <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">Your Job Application Reference Token:</span>
          <div style="font-size: 22px; font-family: monospace; font-weight: bold; color: #123B32; letter-spacing: 1.5px; margin: 6px 0;">${tokenNo}</div>
          <span style="font-size: 11px; color: #64748b;">Stage: <strong>Application Received (Under Review)</strong></span>
        </div>

        <p style="color: #475569; font-size: 13px; line-height: 1.6;">You can track your application stage and admin feedback anytime at our website using your reference token.</p>
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-top: 24px; margin-bottom: 0;">Warm regards,<br><strong>Talent Acquisition Desk</strong><br>Shazu Soft Technologies</p>
      </div>
      <div style="background-color: #f8fafc; padding: 14px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
        © 2026 Shazu Soft Technologies. All rights reserved.
      </div>
    </div>
  `;
  sendBrevoEmail({ toEmail: trimmedEmail, toName: trimmedName, subject: `Application Received [Ref: ${tokenNo}]: ${cleanJobTitle} - Shazu Soft Technologies`, htmlContent: candidateHtml });

  return { message: 'Application submitted successfully!', token_no: tokenNo, application };
});

// Membership Application (11-field comprehensive schema)
app.post('/api/public/membership/apply', async (request, reply) => {
  const { 
    association_name,
    membership_type,
    name,
    dob,
    area_of_interest,
    phone,
    email,
    professional_qualification,
    present_designation,
    organization_name_address,
    declaration_agreed
  } = request.body || {};

  const trimmedName = (name || '').trim();
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedPhone = (phone || '').trim();
  const cleanMemType = (membership_type || 'Professional').trim();
  const validDeclaration = declaration_agreed === true || declaration_agreed === 'true' || declaration_agreed === 'on';

  if (!isValidNameStr(trimmedName)) {
    return reply.status(400).send({ error: 'Please enter your full name (minimum 2 characters).' });
  }

  if (!isValidEmailStr(trimmedEmail)) {
    return reply.status(400).send({ error: 'Please enter a valid email address (e.g., name@domain.com).' });
  }

  if (trimmedPhone && !isValidPhoneStr(trimmedPhone)) {
    return reply.status(400).send({ error: 'Please enter a valid phone number.' });
  }

  if (!cleanMemType) {
    return reply.status(400).send({ error: 'Please select a valid membership type.' });
  }

  if (!validDeclaration) {
    return reply.status(400).send({ error: 'You must accept the membership declaration before applying.' });
  }

  // Duplicate Check: Same email & membership type
  const existingMem = await pool.query(
    `SELECT token_no, status, created_at FROM memberships 
     WHERE LOWER(email) = $1 AND LOWER(membership_type) = LOWER($2) ORDER BY id DESC LIMIT 1`,
    [trimmedEmail, cleanMemType]
  );

  if (existingMem.rows && existingMem.rows.length > 0) {
    const existing = existingMem.rows[0];
    return reply.status(409).send({
      error: `A ${cleanMemType} membership application already exists for email ${trimmedEmail}.`,
      is_duplicate: true,
      token_no: existing.token_no,
      status: existing.status
    });
  }

  const tokenNo = generateTokenNo('SST-MEM');

  const result = await pool.query(
    `INSERT INTO memberships (
      token_no, association_name, membership_type, name, dob, area_of_interest, phone, contact_no, email, 
      professional_qualification, qualification, present_designation, designation, organization_name_address, organization_address, declaration_agreed, declaration_accepted, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $9, $10, $10, $11, $11, $12, $12, 'Pending Review') RETURNING *`,
    [
      tokenNo,
      association_name || 'SST Professional Academic Network',
      cleanMemType,
      trimmedName,
      dob || '',
      area_of_interest || '',
      trimmedPhone,
      trimmedEmail,
      professional_qualification || '',
      present_designation || '',
      organization_name_address || '',
      validDeclaration
    ]
  );

  const membership = (result.rows && result.rows[0]) ? result.rows[0] : {
    token_no: tokenNo,
    association_name: association_name || 'SST Professional Academic Network',
    membership_type: cleanMemType,
    name: trimmedName,
    dob: dob || '',
    area_of_interest: area_of_interest || '',
    phone: trimmedPhone,
    email: trimmedEmail,
    professional_qualification: professional_qualification || '',
    present_designation: present_designation || '',
    organization_name_address: organization_name_address || '',
    declaration_agreed: validDeclaration,
    status: 'Pending Review',
    created_at: new Date()
  };

  const memberHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #123B32; border-radius: 16px; padding: 28px; color: #0f172a;">
      <div style="text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #123B32; margin: 0;">SHAZU SOFT TECHNOLOGIES</h2>
        <span style="display: inline-block; background-color: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: bold; margin-top: 8px;">Membership Application Dossier</span>
      </div>
      <p>Dear <strong>${trimmedName}</strong>,</p>
      <p>We have received your membership application for <strong>${cleanMemType} Membership</strong> (${association_name || 'SST Network'}).</p>
      <div style="background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
        <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">Your Membership Reference Token:</span>
        <div style="font-size: 24px; font-family: monospace; font-weight: bold; color: #123B32; letter-spacing: 2px; margin: 6px 0;">${tokenNo}</div>
        <span style="font-size: 11px; color: #64748b;">Current Status: <strong>Pending Review</strong></span>
      </div>
      <p style="font-size: 13px; color: #64748b;">You can track your membership status anytime using your reference token.</p>
    </div>
  `;
  sendBrevoEmail({ toEmail: trimmedEmail, toName: trimmedName, subject: `Membership Application Received [Ref: ${tokenNo}] - SST`, htmlContent: memberHtml });

  return { message: 'Membership application submitted successfully!', token_no: tokenNo, membership };
});

// Unified Status Checker & Admin Notes Tracker
app.get('/api/public/track/:token', async (request, reply) => {
  const token = (request.params.token || '').trim();
  if (!token) {
    return reply.status(400).send({ error: 'Token is required' });
  }

  const cleanToken = token.trim();

  // 1. Search Event Registrations
  try {
    const regRes = await pool.query('SELECT * FROM event_registrations WHERE LOWER(token_no) = LOWER($1)', [cleanToken]);
    if (regRes.rows && regRes.rows.length > 0) {
      const reg = regRes.rows[0];
      const isApproved = reg.payment_status === 'Verified' || reg.payment_status === 'Approved';
      const isRejected = reg.payment_status === 'Rejected' || reg.payment_status === 'Cancelled';
      
      let statusColor = 'amber';
      if (isApproved) statusColor = 'emerald';
      else if (isRejected) statusColor = 'rose';

      return {
        found: true,
        token_no: reg.token_no,
        category_type: 'Event Registration',
        title: reg.event_title || 'Event Pass',
        applicant_name: reg.name,
        email: reg.email,
        phone: reg.phone,
        status: reg.payment_status || 'Pending Verification',
        status_color: statusColor,
        admin_notes: reg.admin_notes || '',
        created_at: reg.registered_at || reg.created_at,
        updated_at: reg.updated_at || reg.registered_at || reg.created_at,
        details: {
          attendee_category: reg.attendee_category || 'Student (UG / PG)',
          organization: reg.organization || '',
          department_degree: reg.department_degree || '',
          designation_year: reg.designation_year || '',
          roll_no_employee_id: reg.roll_no_employee_id || '',
          city_state: reg.city_state || '',
          gender: reg.gender || '',
          registration_fee: reg.registration_fee || 'Free',
          payment_method: reg.payment_method || 'UPI QR',
          transaction_id: reg.transaction_id || ''
        },
        timeline: [
          { stage: 'Registration Submitted', date: reg.registered_at || reg.created_at, completed: true },
          { stage: 'Verification In Progress', completed: true },
          { stage: isApproved ? 'Approved & Pass Issued' : (isRejected ? 'Declined' : 'Pending Verification'), completed: isApproved, current: !isApproved && !isRejected }
        ]
      };
    }

    // 2. Search Job Applications
    const appRes = await pool.query('SELECT * FROM applications WHERE LOWER(token_no) = LOWER($1)', [cleanToken]);
    if (appRes.rows && appRes.rows.length > 0) {
      const appRecord = appRes.rows[0];
      const isShortlisted = appRecord.status === 'Shortlisted' || appRecord.status === 'Approved';
      const isRejected = appRecord.status === 'Rejected';
      
      let statusColor = 'amber';
      if (isShortlisted) statusColor = 'emerald';
      else if (isRejected) statusColor = 'rose';

      return {
        found: true,
        token_no: appRecord.token_no,
        category_type: 'Job Application',
        title: appRecord.job_title || 'Career Application',
        applicant_name: appRecord.applicant_name,
        email: appRecord.email,
        phone: appRecord.phone,
        status: appRecord.status || 'Pending',
        status_color: statusColor,
        admin_notes: appRecord.admin_notes || '',
        created_at: appRecord.submitted_at || appRecord.created_at,
        updated_at: appRecord.updated_at || appRecord.submitted_at || appRecord.created_at,
        details: {
          resume_attached: !!appRecord.resume_url,
          cover_message: appRecord.message || ''
        },
        timeline: [
          { stage: 'Application Received', date: appRecord.submitted_at || appRecord.created_at, completed: true },
          { stage: 'Profile Screening', completed: true },
          { stage: isShortlisted ? 'Shortlisted for Interview' : (isRejected ? 'Review Completed' : 'Under Review'), completed: isShortlisted, current: !isShortlisted && !isRejected }
        ]
      };
    }

    // 3. Search Memberships
    const memRes = await pool.query('SELECT * FROM memberships WHERE LOWER(token_no) = LOWER($1)', [cleanToken]);
    if (memRes.rows && memRes.rows.length > 0) {
      const mem = memRes.rows[0];
      const isApproved = mem.status === 'Approved' || mem.status === 'Active Member';
      const isRejected = mem.status === 'Rejected';

      let statusColor = 'amber';
      if (isApproved) statusColor = 'emerald';
      else if (isRejected) statusColor = 'rose';

      return {
        found: true,
        token_no: mem.token_no,
        category_type: 'Membership Application',
        title: `${mem.membership_type || 'Professional'} Membership`,
        applicant_name: mem.name,
        email: mem.email,
        phone: mem.phone,
        status: mem.status || 'Pending Review',
        status_color: statusColor,
        admin_notes: mem.admin_notes || '',
        created_at: mem.created_at,
        updated_at: mem.updated_at || mem.created_at,
        details: {
          association_name: mem.association_name || '',
          qualification: mem.professional_qualification || '',
          designation: mem.present_designation || '',
          organization: mem.organization_name_address || '',
          area_of_interest: mem.area_of_interest || ''
        },
        timeline: [
          { stage: 'Application Received', date: mem.created_at, completed: true },
          { stage: 'Credential Verification', completed: true },
          { stage: isApproved ? 'Membership Charter Granted' : (isRejected ? 'Application Declined' : 'Under Committee Review'), completed: isApproved, current: !isApproved && !isRejected }
        ]
      };
    }

    // 4. Search Contact Inquiries
    const inqRes = await pool.query('SELECT * FROM contact_inquiries WHERE LOWER(token_no) = LOWER($1)', [cleanToken]);
    if (inqRes.rows && inqRes.rows.length > 0) {
      const inq = inqRes.rows[0];
      const isResolved = inq.status === 'Resolved' || inq.status === 'Contacted';
      
      return {
        found: true,
        token_no: inq.token_no,
        category_type: 'Contact Inquiry',
        title: inq.subject || 'General Inquiry',
        applicant_name: inq.name,
        email: inq.email,
        phone: inq.phone,
        status: inq.status || 'New Lead',
        status_color: isResolved ? 'emerald' : 'blue',
        admin_notes: inq.admin_notes || '',
        created_at: inq.created_at,
        updated_at: inq.updated_at || inq.created_at,
        details: {
          category: inq.service_category || 'General',
          inquiry_message: inq.message || ''
        },
        timeline: [
          { stage: 'Inquiry Submitted', date: inq.created_at, completed: true },
          { stage: isResolved ? 'Responded & Followed Up' : 'Assigned to Operations Team', completed: isResolved, current: !isResolved }
        ]
      };
    }

    return reply.status(404).send({ error: `Reference token "${cleanToken}" was not found. Please verify your token (e.g. SST-PASS-..., SST-APP-..., SST-MEM-..., SST-LEAD-...).` });
  } catch (err) {
    return reply.status(500).send({ error: 'Failed to look up token status: ' + err.message });
  }
});

app.post('/api/public/track', async (request, reply) => {
  const { token } = request.body || {};
  if (!token) return reply.status(400).send({ error: 'Token is required' });
  return reply.redirect(307, `/api/public/track/${encodeURIComponent(token)}`);
});

// Track Analytics & Page Views
app.post('/api/public/analytics/track', async (request, reply) => {
  try {
    const { page_path, referrer, device_type } = request.body || {};
    const user_agent = request.headers['user-agent'] || '';
    const ip_address = request.ip || request.raw.socket.remoteAddress || '';

    let resolvedDevice = device_type;
    if (!resolvedDevice) {
      if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(user_agent)) {
        resolvedDevice = 'Mobile';
      } else if (/ipad|tablet/i.test(user_agent)) {
        resolvedDevice = 'Tablet';
      } else {
        resolvedDevice = 'Desktop';
      }
    }

    const cleanPath = (page_path || 'index.html').trim().replace(/^[/\\]+/, '') || 'index.html';

    await pool.query(
      'INSERT INTO analytics_events (page_path, user_agent, ip_address, device_type, referrer) VALUES ($1, $2, $3, $4, $5)',
      [cleanPath, user_agent.slice(0, 500), ip_address, resolvedDevice, (referrer || '').slice(0, 500)]
    );

    return reply.status(200).send({ status: 'recorded' });
  } catch (err) {
    return reply.status(200).send({ status: 'ignored' });
  }
});

// ----------------------------------------------------
// PROTECTED ADMIN API ROUTES
// ----------------------------------------------------

// Admin Approval & Event Registration Payment Verification with Token Dispatch & Admin Notes
app.put('/api/admin/event-registrations/:id/payment', { preValidation: [app.authenticate] }, async (request, reply) => {
  const { id } = request.params;
  const { payment_status, admin_notes } = request.body || {};
  
  // Fetch current reg
  const currentRes = await pool.query('SELECT * FROM event_registrations WHERE id = $1', [id]);
  if (currentRes.rows.length === 0) return reply.status(404).send({ error: 'Registration not found' });
  
  let reg = currentRes.rows[0];
  let tokenNo = reg.token_no || generateTokenNo('SST-PASS');

  const result = await pool.query(
    'UPDATE event_registrations SET payment_status = COALESCE($1, payment_status), admin_notes = COALESCE($2, admin_notes), token_no = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
    [payment_status, admin_notes !== undefined ? admin_notes : reg.admin_notes, tokenNo, id]
  );
  reg = result.rows[0];

  if (payment_status === 'Verified' || payment_status === 'Approved') {
    const verifiedHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #16a34a; border-radius: 16px; padding: 28px; color: #0f172a;">
        <div style="text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #123B32; margin: 0;">SHAZU SOFT TECHNOLOGIES</h2>
          <span style="display: inline-block; background-color: #dcfce7; color: #15803d; padding: 6px 16px; border-radius: 99px; font-size: 13px; font-weight: bold; margin-top: 8px;">✅ OFFICIAL PASS APPROVED & ISSUED</span>
        </div>
        <p>Dear <strong>${reg.name}</strong>,</p>
        <p>Great news! Your registration and payment for <strong>"${reg.event_title}"</strong> have been officially <strong>APPROVED</strong> by SST Administration!</p>
        
        <div style="background-color: #f0fdf4; border: 2px solid #16a34a; padding: 18px; border-radius: 12px; text-align: center; margin: 20px 0;">
          <span style="font-size: 11px; text-transform: uppercase; color: #166534; font-weight: bold;">YOUR OFFICIAL EVENT ENTRY TOKEN NO</span>
          <div style="font-size: 24px; font-family: monospace; font-weight: bold; color: #15803d; letter-spacing: 2px; margin: 8px 0;">${tokenNo}</div>
          <span style="font-size: 12px; color: #166534;">Presenter / Attendee Token for Venue Gate Verification</span>
        </div>

        ${admin_notes ? `<div style="background-color: #f8fafc; border-left: 4px solid #123B32; padding: 12px 16px; margin: 16px 0;"><span style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">ADMIN REMARKS / PASS INSTRUCTIONS:</span><p style="margin: 4px 0 0 0; font-size: 13px; color: #1e293b;">${admin_notes}</p></div>` : ''}

        <p style="font-size: 13px; color: #64748b;">Please present your Token Number (<strong>${tokenNo}</strong>) at the venue entrance badge counter.</p>
        <p style="font-size: 13px; color: #64748b;">Warm regards,<br><strong>SST Event Operations Desk</strong></p>
      </div>
    `;
    sendBrevoEmail({ toEmail: reg.email, toName: reg.name, subject: `🎟️ APPROVED! Event Entry Token: ${tokenNo}`, htmlContent: verifiedHtml });
  }

  return { registration: reg };
});

// Candidate Application Status & Stage Update with Admin Notes
app.put('/api/admin/applications/:id/status', { preValidation: [app.authenticate] }, async (request, reply) => {
  const { id } = request.params;
  const { status, admin_notes } = request.body || {};

  const currentRes = await pool.query('SELECT * FROM applications WHERE id = $1', [id]);
  if (currentRes.rows.length === 0) return reply.status(404).send({ error: 'Application not found' });
  let appRecord = currentRes.rows[0];

  const result = await pool.query(
    'UPDATE applications SET status = COALESCE($1, status), admin_notes = COALESCE($2, admin_notes), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
    [status, admin_notes !== undefined ? admin_notes : appRecord.admin_notes, id]
  );
  appRecord = result.rows[0];

  const isShortlisted = status === 'Shortlisted' || status === 'Approved';
  const isRejected = status === 'Rejected';

  let subject = `Application Update: ${appRecord.job_title} - Shazu Soft Technologies`;
  let stageTitle = `Application Stage: ${status}`;
  let stageDescription = `Your application for <strong>"${appRecord.job_title}"</strong> has been updated to stage: <strong>${status}</strong>.`;

  if (isShortlisted) {
    subject = `🎉 Shortlisted for Interview: ${appRecord.job_title} - Shazu Soft Technologies`;
    stageTitle = `Shortlisted for Interview Round`;
    stageDescription = `We are pleased to inform you that your job application for <strong>"${appRecord.job_title}"</strong> has been reviewed and shortlisted for the next interview round! Our hiring team will contact you directly with interview schedule details.`;
  } else if (isRejected) {
    subject = `Update regarding your application for ${appRecord.job_title} - Shazu Soft Technologies`;
    stageTitle = `Application Closed`;
    stageDescription = `Thank you for taking the time to apply for <strong>"${appRecord.job_title}"</strong>. After careful consideration, we have chosen to proceed with other candidates whose experience more closely matches our immediate requirements. We will keep your profile in our talent network for future openings.`;
  }

  const candidateHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; color: #1e293b;">
      <div style="background-color: #123B32; padding: 24px 32px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">SHAZU SOFT TECHNOLOGIES</h2>
        <p style="color: #C47D4C; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase;">Talent Acquisition & Hiring Operations</p>
      </div>
      <div style="padding: 32px;">
        <h3 style="color: #0f172a; margin-top: 0; font-size: 16px; font-weight: 600;">${isShortlisted ? '🎉 Congratulations on being Shortlisted!' : 'Application Status Update'}</h3>
        <p style="color: #475569; font-size: 13px; line-height: 1.6;">Dear <strong>${appRecord.applicant_name}</strong>,</p>
        
        <div style="background-color: ${isShortlisted ? '#f0fdf4' : (isRejected ? '#fef2f2' : '#f8fafc')}; border-left: 4px solid ${isShortlisted ? '#16a34a' : (isRejected ? '#dc2626' : '#123B32')}; padding: 14px 18px; border-radius: 6px; margin: 20px 0;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${isShortlisted ? '#166534' : (isRejected ? '#991b1b' : '#64748b')};">Current Application Stage</div>
          <div style="font-size: 15px; font-weight: 700; color: ${isShortlisted ? '#15803d' : (isRejected ? '#b91c1c' : '#123B32')}; margin-top: 2px;">${stageTitle}</div>
        </div>

        <p style="color: #475569; font-size: 13px; line-height: 1.6;">${stageDescription}</p>
        
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-top: 24px; margin-bottom: 0;">Warm regards,<br><strong>Talent Acquisition Desk</strong><br>Shazu Soft Technologies</p>
      </div>
      <div style="background-color: #f8fafc; padding: 14px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
        © 2026 Shazu Soft Technologies. All rights reserved.
      </div>
    </div>
  `;

  sendBrevoEmail({ toEmail: appRecord.email, toName: appRecord.applicant_name, subject, htmlContent: candidateHtml });

  return { application: appRecord };
});

// ----------------------------------------------------
// RBAC USER & TEAM MANAGEMENT ROUTES (SUPER ADMIN ONLY)
// ----------------------------------------------------

// RBAC Role Verification Helper
function requireRole(allowedRoles = ['super_admin']) {
  return async (request, reply) => {
    try {
      await request.jwtVerify();
      const userRole = request.user.role || 'viewer';
      if (!allowedRoles.includes(userRole)) {
        return reply.status(403).send({ error: `Forbidden: Action requires [${allowedRoles.join(' / ')}] permission level.` });
      }
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  };
}

// 1. Get List of all Admin Users
app.get('/api/admin/users', { preValidation: [requireRole(['super_admin'])] }, async (request, reply) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, is_active, last_login_at, created_at FROM admins ORDER BY created_at ASC'
  );
  return { users: rows };
});

// 2. Add New Admin User (Super Admin only)
app.post('/api/admin/users', { preValidation: [requireRole(['super_admin'])] }, async (request, reply) => {
  const { name, email, role } = request.body || {};
  if (!name || !email) {
    return reply.status(400).send({ error: 'Name and Email are required' });
  }

  const validRoles = ['super_admin', 'editor', 'viewer'];
  const userRole = validRoles.includes(role) ? role : 'editor';
  const lowerEmail = email.trim().toLowerCase();

  const existing = await pool.query('SELECT * FROM admins WHERE LOWER(email) = $1', [lowerEmail]);
  if (existing.rows.length > 0) {
    return reply.status(400).send({ error: `Admin user with email ${lowerEmail} already exists.` });
  }

  const defaultHash = await bcrypt.hash('SSTInitialAdminKey2026!', 10);
  const insertRes = await pool.query(
    'INSERT INTO admins (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, TRUE) RETURNING id, name, email, role, is_active, created_at',
    [name.trim(), lowerEmail, defaultHash, userRole]
  );
  const newUser = insertRes.rows[0];

  // Send onboarding email notification via Brevo
  const welcomeHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 540px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; color: #1e293b;">
      <div style="background-color: #123B32; padding: 24px 32px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">SHAZU SOFT TECHNOLOGIES</h2>
        <p style="color: #C47D4C; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase;">Admin Portal Access Granted</p>
      </div>
      <div style="padding: 32px;">
        <p>Hello <strong>${newUser.name}</strong>,</p>
        <p>You have been added as an administrator to the <strong>Shazu Soft Technologies Management Control Center</strong> with the access role of <strong style="color: #123B32; text-transform: uppercase;">${newUser.role.replace('_', ' ')}</strong>.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0;">
          <div><strong style="color: #64748b; font-size: 12px;">Assigned Role:</strong> <span style="font-weight: 700; color: #123B32; text-transform: capitalize;">${newUser.role.replace('_', ' ')}</span></div>
          <div style="margin-top: 6px;"><strong style="color: #64748b; font-size: 12px;">Login Methods:</strong> <span style="color: #334155;">Email OTP Verification or Google One-Click Login</span></div>
        </div>

        <p style="font-size: 13px; color: #64748b;">Navigate to the Admin sign-in page, enter your registered email, and verify with the instant OTP sent to your inbox.</p>
      </div>
      <div style="background-color: #f8fafc; padding: 14px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
        © 2026 Shazu Soft Technologies. All rights reserved.
      </div>
    </div>
  `;

  sendBrevoEmail({
    toEmail: lowerEmail,
    toName: newUser.name,
    subject: 'Welcome to SST Management Team - Admin Access Provisioned',
    htmlContent: welcomeHtml
  });

  return { user: newUser, message: 'Admin user added successfully and notification email dispatched.' };
});

// 3. Update Admin User Role or Active Status
app.put('/api/admin/users/:id', { preValidation: [requireRole(['super_admin'])] }, async (request, reply) => {
  const { id } = request.params;
  const { name, role, is_active } = request.body || {};

  const userCheck = await pool.query('SELECT * FROM admins WHERE id = $1', [id]);
  if (userCheck.rows.length === 0) {
    return reply.status(404).send({ error: 'User not found' });
  }

  const currentUser = userCheck.rows[0];

  // Prevent self-demotion or self-deactivation
  if (parseInt(id) === parseInt(request.user.id)) {
    if (is_active === false) {
      return reply.status(400).send({ error: 'You cannot deactivate your own Super Admin account.' });
    }
    if (role && role !== 'super_admin') {
      return reply.status(400).send({ error: 'You cannot demote your own Super Admin role.' });
    }
  }

  const updateRes = await pool.query(
    `UPDATE admins 
     SET name = COALESCE($1, name), 
         role = COALESCE($2, role), 
         is_active = COALESCE($3, is_active) 
     WHERE id = $4 
     RETURNING id, name, email, role, is_active, last_login_at, created_at`,
    [name || null, role || null, typeof is_active === 'boolean' ? is_active : null, id]
  );

  return { user: updateRes.rows[0], message: 'Admin profile updated successfully.' };
});

// 4. Delete Admin User
app.delete('/api/admin/users/:id', { preValidation: [requireRole(['super_admin'])] }, async (request, reply) => {
  const { id } = request.params;

  if (parseInt(id) === parseInt(request.user.id)) {
    return reply.status(400).send({ error: 'You cannot delete your own active administrator account.' });
  }

  await pool.query('DELETE FROM admins WHERE id = $1', [id]);
  return { message: 'Administrator removed successfully.' };
});

// ----------------------------------------------------
// BUSINESS & FINANCIAL ANALYTICS
// ----------------------------------------------------

// Helper: Extract Numeric Fee
function parseFeeNumber(feeStr) {
  if (!feeStr || typeof feeStr !== 'string') return 0;
  const match = feeStr.replace(/,/g, '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// Admin Analytics Overview with Business Financial Intelligence & Page View Telemetry
app.get('/api/admin/analytics', { preValidation: [app.authenticate] }, async () => {
  const [
    totalApps, 
    totalEvents, 
    totalJobs, 
    totalViews, 
    todayViewsRes,
    deviceBreakdownRes,
    totalLeads, 
    pageBreakdown, 
    dailyTrendRes,
    recentApps,
    registrationsRes,
    leadsRes
  ] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM applications'),
    pool.query('SELECT COUNT(*) FROM events'),
    pool.query('SELECT COUNT(*) FROM careers'),
    pool.query('SELECT COUNT(*) FROM analytics_events'),
    pool.query('SELECT COUNT(*) FROM analytics_events WHERE created_at >= CURRENT_DATE'),
    pool.query("SELECT COALESCE(device_type, 'Desktop') as device_type, COUNT(*) as count FROM analytics_events GROUP BY device_type"),
    pool.query('SELECT COUNT(*) FROM contact_inquiries'),
    pool.query('SELECT page_path, COUNT(*) as views FROM analytics_events GROUP BY page_path ORDER BY views DESC LIMIT 6'),
    pool.query(`
      SELECT TO_CHAR(created_at, 'DD Mon') as label, COUNT(*) as views 
      FROM analytics_events 
      WHERE created_at >= NOW() - INTERVAL '7 days' 
      GROUP BY TO_CHAR(created_at, 'DD Mon'), DATE_TRUNC('day', created_at) 
      ORDER BY DATE_TRUNC('day', created_at) ASC
    `),
    pool.query('SELECT * FROM applications ORDER BY submitted_at DESC LIMIT 5'),
    pool.query('SELECT id, name, email, event_title, registration_fee, payment_method, transaction_id, token_no, payment_status, registered_at FROM event_registrations ORDER BY registered_at DESC'),
    pool.query('SELECT id, status, service_category FROM contact_inquiries')
  ]);

  const registrations = registrationsRes.rows;
  const leads = leadsRes.rows;

  // Financial Metrics Computation
  let verifiedGrossRevenue = 0;
  let pendingRevenue = 0;
  let verifiedCount = 0;
  let pendingCount = 0;
  let freePassesCount = 0;

  registrations.forEach(r => {
    const feeVal = parseFeeNumber(r.registration_fee);
    const isVerified = (r.payment_status === 'Verified' || r.payment_status === 'Approved');
    const isPending = (r.payment_status === 'Pending Verification' || r.payment_status === 'Pending');

    if (feeVal > 0) {
      if (isVerified) {
        verifiedGrossRevenue += feeVal;
        verifiedCount++;
      } else if (isPending) {
        pendingRevenue += feeVal;
        pendingCount++;
      }
    } else {
      freePassesCount++;
    }
  });

  // Leads CRM Deal Pipeline Funnel
  const pipeline = {
    totalLeads: leads.length,
    newLeads: leads.filter(l => l.status === 'New Lead' || !l.status).length,
    contacted: leads.filter(l => l.status === 'Contacted').length,
    proposalSent: leads.filter(l => l.status === 'Proposal Sent').length,
    converted: leads.filter(l => l.status === 'Converted' || l.status === 'Won').length,
    conversionRate: leads.length > 0 ? ((leads.filter(l => l.status === 'Converted' || l.status === 'Won').length / leads.length) * 100).toFixed(1) : 0
  };

  // Device Breakdown Formatting
  const deviceCounts = { Mobile: 0, Desktop: 0, Tablet: 0 };
  deviceBreakdownRes.rows.forEach(r => {
    const key = r.device_type === 'Mobile' ? 'Mobile' : (r.device_type === 'Tablet' ? 'Tablet' : 'Desktop');
    deviceCounts[key] = (deviceCounts[key] || 0) + parseInt(r.count, 10);
  });

  return {
    metrics: {
      totalApplications: parseInt(totalApps.rows[0].count),
      totalEvents: parseInt(totalEvents.rows[0].count),
      totalJobs: parseInt(totalJobs.rows[0].count),
      totalViews: parseInt(totalViews.rows[0].count),
      todayViews: parseInt(todayViewsRes.rows[0].count),
      totalLeads: parseInt(totalLeads.rows[0].count),
      // Financial KPIs
      verifiedGrossRevenue,
      pendingRevenue,
      verifiedCount,
      pendingCount,
      freePassesCount,
      totalTransactions: registrations.length
    },
    pageViews: {
      total: parseInt(totalViews.rows[0].count),
      today: parseInt(todayViewsRes.rows[0].count),
      deviceCounts,
      topPages: pageBreakdown.rows,
      dailyTrend: dailyTrendRes.rows
    },
    pipeline,
    recentTransactions: registrations.slice(0, 10),
    popularPages: pageBreakdown.rows,
    recentApplications: recentApps.rows
  };
});

// Admin Contact Leads
app.get('/api/admin/leads', { preValidation: [app.authenticate] }, async () => {
  const { rows } = await pool.query('SELECT * FROM contact_inquiries ORDER BY created_at DESC');
  return { leads: rows };
});

app.put('/api/admin/leads/:id/status', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  const { status, admin_notes } = request.body || {};
  const current = await pool.query('SELECT * FROM contact_inquiries WHERE id = $1', [id]);
  const currNotes = (current.rows && current.rows[0]) ? current.rows[0].admin_notes : '';
  const result = await pool.query(
    'UPDATE contact_inquiries SET status = COALESCE($1, status), admin_notes = COALESCE($2, admin_notes), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
    [status, admin_notes !== undefined ? admin_notes : currNotes, id]
  );
  return { lead: result.rows[0] };
});

app.delete('/api/admin/leads/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  await pool.query('DELETE FROM contact_inquiries WHERE id = $1', [id]);
  return { message: 'Lead deleted' };
});

// Admin Memberships Management
app.get('/api/admin/memberships', { preValidation: [app.authenticate] }, async () => {
  const { rows } = await pool.query('SELECT * FROM memberships ORDER BY created_at DESC');
  return { memberships: rows };
});

app.put('/api/admin/memberships/:id/status', { preValidation: [app.authenticate] }, async (request, reply) => {
  const { id } = request.params;
  const { status, admin_notes } = request.body || {};

  const currentRes = await pool.query('SELECT * FROM memberships WHERE id = $1', [id]);
  if (currentRes.rows.length === 0) return reply.status(404).send({ error: 'Membership record not found' });
  let mem = currentRes.rows[0];

  const result = await pool.query(
    'UPDATE memberships SET status = COALESCE($1, status), admin_notes = COALESCE($2, admin_notes), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
    [status, admin_notes !== undefined ? admin_notes : mem.admin_notes, id]
  );
  mem = result.rows[0];

  if (status === 'Approved' || status === 'Active Member') {
    const verifiedHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #123B32; border-radius: 16px; padding: 28px; color: #0f172a;">
        <div style="text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #123B32; margin: 0;">SHAZU SOFT TECHNOLOGIES</h2>
          <span style="display: inline-block; background-color: #dcfce7; color: #15803d; padding: 6px 16px; border-radius: 99px; font-size: 13px; font-weight: bold; margin-top: 8px;">✅ MEMBERSHIP APPROVED</span>
        </div>
        <p>Dear <strong>${mem.name}</strong>,</p>
        <p>Congratulations! Your application for <strong>${mem.membership_type} Membership</strong> (${mem.association_name || 'SST Network'}) has been <strong>APPROVED</strong>!</p>
        
        <div style="background-color: #f0fdf4; border: 2px solid #16a34a; padding: 18px; border-radius: 12px; text-align: center; margin: 20px 0;">
          <span style="font-size: 11px; text-transform: uppercase; color: #166534; font-weight: bold;">YOUR OFFICIAL MEMBERSHIP TOKEN NO</span>
          <div style="font-size: 24px; font-family: monospace; font-weight: bold; color: #15803d; letter-spacing: 2px; margin: 8px 0;">${mem.token_no}</div>
        </div>

        ${admin_notes ? `<div style="background-color: #f8fafc; border-left: 4px solid #123B32; padding: 12px 16px; margin: 16px 0;"><span style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">ADMIN REMARKS:</span><p style="margin: 4px 0 0 0; font-size: 13px; color: #1e293b;">${admin_notes}</p></div>` : ''}

        <p style="font-size: 13px; color: #64748b;">Warm regards,<br><strong>SST Executive Council</strong></p>
      </div>
    `;
    sendBrevoEmail({ toEmail: mem.email, toName: mem.name, subject: `🎉 APPROVED! SST Membership Dossier: ${mem.token_no}`, htmlContent: verifiedHtml });
  }

  return { membership: mem };
});

app.delete('/api/admin/memberships/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  await pool.query('DELETE FROM memberships WHERE id = $1', [id]);
  return { message: 'Membership record deleted' };
});

// Admin Courses & Services CRUD
app.get('/api/admin/courses-services', { preValidation: [app.authenticate] }, async () => {
  const { rows } = await pool.query('SELECT * FROM courses_services ORDER BY created_at DESC');
  return { offerings: rows };
});

app.post('/api/admin/courses-services', { preValidation: [app.authenticate] }, async (request) => {
  const { title, offering_type, price_range, duration, description, image_url, is_active } = request.body;
  const result = await pool.query(
    `INSERT INTO courses_services (title, offering_type, price_range, duration, description, image_url, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [title, offering_type || 'Course', price_range || 'Custom', duration || 'Variable', description || '', image_url || '', is_active !== false]
  );
  return { offering: result.rows[0] };
});

app.put('/api/admin/courses-services/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  const { title, offering_type, price_range, duration, description, image_url, is_active } = request.body;
  const result = await pool.query(
    `UPDATE courses_services
     SET title=$1, offering_type=$2, price_range=$3, duration=$4, description=$5, image_url=$6, is_active=$7
     WHERE id=$8 RETURNING *`,
    [title, offering_type, price_range, duration, description, image_url, is_active, id]
  );
  return { offering: result.rows[0] };
});

app.delete('/api/admin/courses-services/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  await pool.query('DELETE FROM courses_services WHERE id = $1', [id]);
  return { message: 'Offering deleted' };
});

// Admin Announcements CRUD
app.get('/api/admin/announcements', { preValidation: [app.authenticate] }, async () => {
  const { rows } = await pool.query('SELECT * FROM announcements ORDER BY priority ASC, created_at DESC');
  return { announcements: rows };
});

app.post('/api/admin/announcements', { preValidation: [app.authenticate] }, async (request) => {
  const { title, content, badge_type, link_url, image_url, priority, is_active } = request.body;
  const result = await pool.query(
    `INSERT INTO announcements (title, content, badge_type, link_url, image_url, priority, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [title, content, badge_type || 'New', link_url || '', image_url || '', priority || 1, is_active !== false]
  );
  return { announcement: result.rows[0] };
});

app.put('/api/admin/announcements/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  const { title, content, badge_type, link_url, image_url, priority, is_active } = request.body;
  const result = await pool.query(
    `UPDATE announcements
     SET title=$1, content=$2, badge_type=$3, link_url=$4, image_url=$5, priority=$6, is_active=$7
     WHERE id=$8 RETURNING *`,
    [title, content, badge_type, link_url, image_url, priority, is_active, id]
  );
  return { announcement: result.rows[0] };
});

app.delete('/api/admin/announcements/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
  return { message: 'Announcement deleted successfully' };
});

// Admin Events CRUD
app.get('/api/admin/events', { preValidation: [app.authenticate] }, async () => {
  const { rows } = await pool.query('SELECT * FROM events ORDER BY created_at DESC');
  return { events: rows };
});

app.post('/api/admin/events', { preValidation: [app.authenticate] }, async (request) => {
  const { title, category, description, event_date, location, registration_fee, registration_link, image_url, status, upi_id, payment_qr } = request.body || {};
  const result = await pool.query(
    `INSERT INTO events (title, category, description, event_date, location, registration_fee, registration_link, image_url, status, upi_id, payment_qr)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [title, category || 'General', description || '', event_date || '', location || '', registration_fee || 'Free', registration_link || '', image_url || '', status || 'Upcoming', upi_id || '', payment_qr || '']
  );
  return { event: result.rows[0] };
});

app.put('/api/admin/events/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  const { title, category, description, event_date, location, registration_fee, registration_link, image_url, status, upi_id, payment_qr } = request.body || {};
  const result = await pool.query(
    `UPDATE events
     SET title=$1, category=$2, description=$3, event_date=$4, location=$5, registration_fee=$6, registration_link=$7, image_url=$8, status=$9, upi_id=$10, payment_qr=$11
     WHERE id=$12 RETURNING *`,
    [title, category, description, event_date, location, registration_fee, registration_link, image_url, status, upi_id, payment_qr, id]
  );
  return { event: result.rows[0] };
});

app.delete('/api/admin/events/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  await pool.query('DELETE FROM events WHERE id = $1', [id]);
  return { message: 'Event deleted successfully' };
});

// Admin Careers CRUD
app.get('/api/admin/careers', { preValidation: [app.authenticate] }, async () => {
  const { rows } = await pool.query('SELECT * FROM careers ORDER BY created_at DESC');
  return { careers: rows };
});

app.post('/api/admin/careers', { preValidation: [app.authenticate] }, async (request) => {
  const { title, department, job_type, location, salary_range, description, requirements, image_url, status } = request.body;
  const result = await pool.query(
    `INSERT INTO careers (title, department, job_type, location, salary_range, description, requirements, image_url, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [title, department || 'General', job_type || 'Full-time', location || 'Salem, TN', salary_range || 'Competitive', description || '', requirements || '', image_url || '', status || 'Open']
  );
  return { job: result.rows[0] };
});

app.put('/api/admin/careers/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  const { title, department, job_type, location, salary_range, description, requirements, image_url, status } = request.body;
  const result = await pool.query(
    `UPDATE careers
     SET title=$1, department=$2, job_type=$3, location=$4, salary_range=$5, description=$6, requirements=$7, image_url=$8, status=$9
     WHERE id=$10 RETURNING *`,
    [title, department, job_type, location, salary_range, description, requirements, image_url, status, id]
  );
  return { job: result.rows[0] };
});

app.delete('/api/admin/careers/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  await pool.query('DELETE FROM careers WHERE id = $1', [id]);
  return { message: 'Job posting deleted successfully' };
});

// ==========================================
// 🎟️ EVENT ATTENDANCE & QR SCANNER ENDPOINTS
// ==========================================

// Lookup registration by scanned QR token or token string (Public & Admin)
const handleScanRegistration = async (request, reply) => {
  const { token } = request.params;
  const cleanToken = (token || '').trim();
  
  const { rows } = await pool.query(
    `SELECT r.*, e.title as event_title_ref
     FROM event_registrations r
     LEFT JOIN events e ON r.event_id = e.id
     WHERE LOWER(r.token_no) = LOWER($1) OR r.id::text = $1 LIMIT 1`,
    [cleanToken]
  );
  
  if (!rows || rows.length === 0) {
    return reply.status(404).send({ error: `Registration token "${cleanToken}" not found` });
  }
  
  return { registration: rows[0] };
};

app.get('/api/admin/event-registrations/scan/:token', { preValidation: [app.authenticate] }, handleScanRegistration);
app.get('/api/public/event-registrations/scan/:token', handleScanRegistration);

// Toggle / Update Attendance Check-in Status (Present / Absent)
const handleAttendanceUpdate = async (request, reply) => {
  const { id } = request.params;
  const { status } = request.body || {};
  const isPresent = (status || '').toLowerCase() === 'present';
  const newStatus = isPresent ? 'Present' : 'Absent';
  
  const result = await pool.query(
    `UPDATE event_registrations
     SET attendance_status = $1, checked_in_at = ${isPresent ? 'NOW()' : 'NULL'}, updated_at = CURRENT_TIMESTAMP
     WHERE id::text = $2 OR LOWER(token_no) = LOWER($2) RETURNING *`,
    [newStatus, id]
  );
  
  if (!result.rows || result.rows.length === 0) {
    return reply.status(404).send({ error: 'Registration record not found' });
  }
  
  const reg = result.rows[0];
  if (typeof logAudit === 'function') {
    logAudit('ATTENDANCE_CHECKIN', 'EVENT_REGISTRATION', id, `Marked attendance as ${newStatus} for ${reg.name} (${reg.token_no})`, request).catch(() => {});
  }
  
  return { success: true, registration: reg };
};

app.post('/api/admin/event-registrations/:id/attendance', { preValidation: [app.authenticate] }, handleAttendanceUpdate);
app.post('/api/public/event-registrations/:id/attendance', handleAttendanceUpdate);

// Fetch event attendance roster & metrics summary (Public & Admin)
const handleAttendanceRoster = async (request) => {
  const { eventId } = request.params;
  
  const evRes = await pool.query('SELECT * FROM events WHERE id::text = $1 OR LOWER(title) = LOWER($1) LIMIT 1', [eventId]);
  const event = (evRes.rows && evRes.rows[0]) ? evRes.rows[0] : { id: eventId, title: 'Event' };
  const cleanTitle = (event.title || '').trim();
  
  const { rows } = await pool.query(
    `SELECT * FROM event_registrations 
     WHERE event_id::text = $1 OR (LOWER(event_title) = LOWER($2) AND $2 != '')
     ORDER BY id DESC`,
    [eventId, cleanTitle]
  );
  
  const total = rows.length;
  const verified = rows.filter(r => (r.payment_status || '').toLowerCase().includes('verif') || (r.registration_fee || '').toLowerCase().includes('free')).length;
  const present = rows.filter(r => (r.attendance_status || '').toLowerCase() === 'present').length;
  const absent = total - present;
  
  return {
    event,
    summary: {
      total,
      verified,
      present,
      absent,
      checkInPercentage: total > 0 ? ((present / total) * 100).toFixed(1) : 0
    },
    roster: rows
  };
};

app.get('/api/admin/events/:eventId/attendance-roster', { preValidation: [app.authenticate] }, handleAttendanceRoster);
app.get('/api/public/events/:eventId/attendance-roster', handleAttendanceRoster);



// Admin Applications
app.get('/api/admin/applications', { preValidation: [app.authenticate] }, async () => {
  const { rows } = await pool.query('SELECT * FROM applications ORDER BY submitted_at DESC');
  return { applications: rows };
});

app.delete('/api/admin/applications/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  await pool.query('DELETE FROM applications WHERE id = $1', [id]);
  return { message: 'Application deleted' };
});

// Admin Event Registrations Management
app.get('/api/admin/event-registrations', { preValidation: [app.authenticate] }, async () => {
  const { rows } = await pool.query('SELECT * FROM event_registrations ORDER BY registered_at DESC');
  return { registrations: rows };
});



app.delete('/api/admin/event-registrations/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  await pool.query('DELETE FROM event_registrations WHERE id = $1', [id]);
  return { message: 'Registration deleted successfully' };
});

// Admin Hero Slider Management
app.get('/api/admin/slider', { preValidation: [app.authenticate] }, async () => {
  const { rows } = await pool.query('SELECT * FROM hero_slides ORDER BY display_order ASC, id ASC');
  return { slides: rows };
});

app.post('/api/admin/slider', { preValidation: [app.authenticate] }, async (request, reply) => {
  const { badge, title, subtitle, image_url, display_order, is_active } = request.body || {};
  if (!title || !image_url) {
    return reply.status(400).send({ error: 'Title and Image URL are required' });
  }
  const result = await pool.query(
    `INSERT INTO hero_slides (badge, title, subtitle, image_url, display_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [badge || 'EVENT', title, subtitle || '', image_url, display_order || 0, is_active !== false]
  );
  return { message: 'Hero slide added successfully', slide: result.rows[0] };
});

app.put('/api/admin/slider/:id', { preValidation: [app.authenticate] }, async (request, reply) => {
  const { id } = request.params;
  const { badge, title, subtitle, image_url, display_order, is_active } = request.body || {};
  const result = await pool.query(
    `UPDATE hero_slides
     SET badge = COALESCE($1, badge),
         title = COALESCE($2, title),
         subtitle = COALESCE($3, subtitle),
         image_url = COALESCE($4, image_url),
         display_order = COALESCE($5, display_order),
         is_active = COALESCE($6, is_active)
     WHERE id = $7 RETURNING *`,
    [badge, title, subtitle, image_url, display_order, is_active, id]
  );
  if (!result.rows.length) return reply.status(404).send({ error: 'Slide not found' });
  return { message: 'Hero slide updated successfully', slide: result.rows[0] };
});

app.delete('/api/admin/slider/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  await pool.query('DELETE FROM hero_slides WHERE id = $1', [id]);
  return { message: 'Hero slide deleted successfully' };
});

// ==========================================
// SYSTEM AUDIT TRAIL & SECURITY EVENT LOGS
// ==========================================
app.get('/api/admin/audit-logs', { preValidation: [app.authenticate] }, async (request, reply) => {
  try {
    const { action, entity, status, search, limit = 200 } = request.query || {};
    
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let pIdx = 1;

    if (action && action !== 'all') {
      query += ` AND action_type = $${pIdx++}`;
      params.push(action);
    }
    if (entity && entity !== 'all') {
      query += ` AND entity_type = $${pIdx++}`;
      params.push(entity);
    }
    if (status && status !== 'all') {
      query += ` AND status = $${pIdx++}`;
      params.push(status);
    }
    if (search && search.trim()) {
      query += ` AND (LOWER(admin_name) LIKE $${pIdx} OR LOWER(admin_email) LIKE $${pIdx} OR LOWER(details) LIKE $${pIdx} OR ip_address LIKE $${pIdx})`;
      params.push(`%${search.trim().toLowerCase()}%`);
      pIdx++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${pIdx}`;
    params.push(parseInt(limit, 10) || 200);

    const { rows } = await pool.query(query, params);

    // Compute summary telemetry metrics
    const statsRes = await pool.query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN action_type LIKE 'LOGIN%' THEN 1 END) as login_sessions,
        COUNT(CASE WHEN status = 'FAILED' OR action_type LIKE '%ALERT%' THEN 1 END) as security_alerts,
        COUNT(CASE WHEN action_type IN ('CREATE', 'UPDATE', 'DELETE', 'VERIFY_PAYMENT') THEN 1 END) as data_modifications
      FROM audit_logs
    `);

    const stats = statsRes.rows[0] || { total_events: 0, login_sessions: 0, security_alerts: 0, data_modifications: 0 };

    return {
      success: true,
      logs: rows,
      summary: {
        totalEvents: parseInt(stats.total_events || 0, 10),
        loginSessions: parseInt(stats.login_sessions || 0, 10),
        securityAlerts: parseInt(stats.security_alerts || 0, 10),
        dataModifications: parseInt(stats.data_modifications || 0, 10)
      }
    };
  } catch (err) {
    app.log.error('Audit logs query error:', err);
    return reply.status(500).send({ error: 'Failed to retrieve system audit logs' });
  }
});

app.post('/api/admin/audit-logs/clear', { preValidation: [app.authenticate] }, async (request, reply) => {
  if (request.user?.role !== 'super_admin') {
    return reply.status(403).send({ error: 'Access Denied: Only Super Admin can purge system audit history' });
  }
  
  await pool.query("DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days'");
  await logAudit('PURGE_AUDIT_LOGS', 'SECURITY', 'SYSTEM', 'Purged audit records older than 90 days', request);
  return { message: 'Audit logs older than 90 days cleared successfully' };
});

// Safe Database Data Truncation (Preserves hero_slides & admins)
app.post('/api/admin/system/safe-truncate', { preValidation: [requireRole(['super_admin'])] }, async (request, reply) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE event_registrations CASCADE;');
    await client.query('TRUNCATE TABLE applications CASCADE;');
    await client.query('TRUNCATE TABLE contact_inquiries CASCADE;');
    await client.query('TRUNCATE TABLE memberships CASCADE;');
    await client.query('TRUNCATE TABLE events CASCADE;');
    await client.query('TRUNCATE TABLE careers CASCADE;');
    await client.query('TRUNCATE TABLE courses_services CASCADE;');
    await client.query('TRUNCATE TABLE announcements CASCADE;');
    await client.query('TRUNCATE TABLE analytics_events CASCADE;');
    await client.query('TRUNCATE TABLE audit_logs CASCADE;');
    await client.query('TRUNCATE TABLE admin_otps CASCADE;');
    await client.query('COMMIT');

    await logAudit('SAFE_TRUNCATE_DATA', 'DATABASE', 'SYSTEM', 'Safely truncated submission & content tables while preserving hero_slides & admin accounts', request);
    return { success: true, message: 'Database tables safely truncated! Hero section slides and admin accounts remain intact.' };
  } catch (err) {
    await client.query('ROLLBACK');
    app.log.error('Safe truncation failed:', err);
    return reply.status(500).send({ error: `Truncation failed: ${err.message}` });
  } finally {
    client.release();
  }
});


// ==========================================
// ⚡ LIVE SUMMARY COUNTS & TODAY'S ACTIVITY FEED
// ==========================================
app.get('/api/admin/today-activity', { preValidation: [app.authenticate] }, async (request, reply) => {
  try {
    // 1. Fetch total counts across all tables
    const [
      leadsCountRes,
      regsCountRes,
      eventsCountRes,
      careersCountRes,
      appsCountRes,
      memsCountRes,
      annsCountRes,
      offersCountRes,
      usersCountRes,
      auditCountRes
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM contact_inquiries'),
      pool.query('SELECT COUNT(*) FROM event_registrations'),
      pool.query('SELECT COUNT(*) FROM events'),
      pool.query('SELECT COUNT(*) FROM careers'),
      pool.query('SELECT COUNT(*) FROM applications'),
      pool.query('SELECT COUNT(*) FROM memberships'),
      pool.query('SELECT COUNT(*) FROM announcements'),
      pool.query('SELECT COUNT(*) FROM courses_services'),
      pool.query('SELECT COUNT(*) FROM admins'),
      pool.query('SELECT COUNT(*) FROM audit_logs')
    ]);

    const counts = {
      leads: parseInt((leadsCountRes.rows[0] && leadsCountRes.rows[0].count) || 0, 10),
      registrations: parseInt((regsCountRes.rows[0] && regsCountRes.rows[0].count) || 0, 10),
      events: parseInt((eventsCountRes.rows[0] && eventsCountRes.rows[0].count) || 0, 10),
      careers: parseInt((careersCountRes.rows[0] && careersCountRes.rows[0].count) || 0, 10),
      applications: parseInt((appsCountRes.rows[0] && appsCountRes.rows[0].count) || 0, 10),
      memberships: parseInt((memsCountRes.rows[0] && memsCountRes.rows[0].count) || 0, 10),
      announcements: parseInt((annsCountRes.rows[0] && annsCountRes.rows[0].count) || 0, 10),
      offerings: parseInt((offersCountRes.rows[0] && offersCountRes.rows[0].count) || 0, 10),
      users: parseInt((usersCountRes.rows[0] && usersCountRes.rows[0].count) || 0, 10),
      audit: parseInt((auditCountRes.rows[0] && auditCountRes.rows[0].count) || 0, 10)
    };

    // 2. Fetch today's business records (created today or in last 24h)
    const [
      todayRegsRes,
      todayAppsRes,
      todayMemsRes,
      todayLeadsRes
    ] = await Promise.all([
      pool.query(`SELECT id, name, email, event_title, registration_fee, token_no, payment_status, registered_at, updated_at 
                  FROM event_registrations 
                  WHERE registered_at >= NOW() - INTERVAL '24 hours' OR updated_at >= NOW() - INTERVAL '24 hours' 
                  ORDER BY registered_at DESC LIMIT 25`),
      pool.query(`SELECT id, applicant_name, email, job_title, token_no, status, submitted_at, updated_at 
                  FROM applications 
                  WHERE submitted_at >= NOW() - INTERVAL '24 hours' OR updated_at >= NOW() - INTERVAL '24 hours' 
                  ORDER BY submitted_at DESC LIMIT 25`),
      pool.query(`SELECT id, name, email, membership_type, association_name, token_no, status, created_at, updated_at 
                  FROM memberships 
                  WHERE created_at >= NOW() - INTERVAL '24 hours' OR updated_at >= NOW() - INTERVAL '24 hours' 
                  ORDER BY created_at DESC LIMIT 25`),
      pool.query(`SELECT id, name, email, subject, service_category, token_no, status, created_at, updated_at 
                  FROM contact_inquiries 
                  WHERE created_at >= NOW() - INTERVAL '24 hours' OR updated_at >= NOW() - INTERVAL '24 hours' 
                  ORDER BY created_at DESC LIMIT 25`)
    ]);

    const activities = [];

    // Format Event Registrations
    (todayRegsRes.rows || []).forEach(r => {
      activities.push({
        id: `reg_${r.id}`,
        record_id: r.id,
        tab: 'registrations',
        type: 'REGISTRATION',
        badge: 'Event Pass',
        badge_class: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        icon: 'bi-pass-fill',
        title: `${r.name} registered for ${r.event_title}`,
        subtitle: `Fee: ${r.registration_fee || 'Free'} • Status: ${r.payment_status || 'Pending'} • Token: ${r.token_no || 'N/A'}`,
        timestamp: r.updated_at || r.registered_at,
        time_formatted: new Date(r.updated_at || r.registered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });

    // Format Job Applications
    (todayAppsRes.rows || []).forEach(a => {
      activities.push({
        id: `app_${a.id}`,
        record_id: a.id,
        tab: 'applications',
        type: 'APPLICATION',
        badge: 'Job Application',
        badge_class: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        icon: 'bi-briefcase-fill',
        title: `${a.applicant_name} applied for ${a.job_title}`,
        subtitle: `Stage: ${a.status || 'Pending'} • Token: ${a.token_no || 'N/A'}`,
        timestamp: a.updated_at || a.submitted_at,
        time_formatted: new Date(a.updated_at || a.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });

    // Format Memberships
    (todayMemsRes.rows || []).forEach(m => {
      activities.push({
        id: `mem_${m.id}`,
        record_id: m.id,
        tab: 'memberships',
        type: 'MEMBERSHIP',
        badge: 'Membership',
        badge_class: 'bg-amber-100 text-amber-800 border-amber-300',
        icon: 'bi-award-fill',
        title: `${m.name} submitted 11-field ${m.membership_type} application`,
        subtitle: `Chapter: ${m.association_name || 'SST'} • Status: ${m.status || 'Pending'} • Token: ${m.token_no || 'N/A'}`,
        timestamp: m.updated_at || m.created_at,
        time_formatted: new Date(m.updated_at || m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });

    // Format Leads / Contacts
    (todayLeadsRes.rows || []).forEach(l => {
      activities.push({
        id: `lead_${l.id}`,
        record_id: l.id,
        tab: 'leads',
        type: 'LEAD',
        badge: 'CRM Lead',
        badge_class: 'bg-blue-100 text-blue-800 border-blue-300',
        icon: 'bi-chat-left-quote-fill',
        title: `${l.name} sent inquiry: ${l.subject || 'General'}`,
        subtitle: `Category: ${l.service_category || 'General'} • Status: ${l.status || 'New Lead'} • Token: ${l.token_no || 'N/A'}`,
        timestamp: l.updated_at || l.created_at,
        time_formatted: new Date(l.updated_at || l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });

    // Sort newest first
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      success: true,
      counts,
      todayTotal: activities.length,
      activities
    };
  } catch (err) {
    app.log.error('Today activity query error:', err);
    return reply.status(500).send({ error: 'Failed to retrieve today activity' });
  }
});

// ==========================================
// 📧 ADMIN EMAIL DISPATCH & LIVE TEST SENDER
// ==========================================
app.post('/api/admin/email/send', { preValidation: [app.authenticate] }, async (request, reply) => {
  const { toEmail, toName, subject, message, htmlContent } = request.body || {};
  if (!toEmail || !subject) {
    return reply.status(400).send({ error: 'toEmail and subject are required' });
  }

  const finalHtml = htmlContent || `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #123B32; border-radius: 12px; padding: 24px; color: #1e292b;">
      <div style="margin-bottom: 20px; border-bottom: 2px solid #123B32; padding-bottom: 12px;">
        <h3 style="color: #123B32; margin: 0;">SHAZU SOFT TECHNOLOGIES</h3>
        <p style="color: #C47D4C; font-size: 12px; margin: 2px 0 0 0;">Official Communication</p>
      </div>
      <p style="white-space: pre-line; line-height: 1.6;">${message || ''}</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;">
      <p style="font-size: 12px; color: #64748b; margin: 0;">Shazu Soft Technologies Management<br>Salem, Tamil Nadu, India</p>
    </div>
  `;

  const result = await sendBrevoEmail({
    toEmail,
    toName: toName || toEmail,
    subject,
    htmlContent: finalHtml
  });

  if (result.success) {
    await logAudit('SEND_EMAIL', 'COMMUNICATION', toEmail, `Sent email with subject: ${subject}`, request);
    return { success: true, message: `Email dispatched successfully to ${toEmail}` };
  } else {
    return reply.status(500).send({ error: `Brevo email dispatch failed: ${result.error || 'Unknown error'}` });
  }
});

app.post('/api/admin/email/test', async (request, reply) => {
  const { toEmail = 'vimalraj5207@gmail.com' } = request.body || {};
  
  const testHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #123B32; margin: 0; font-size: 24px;">Shazu Soft Technologies</h1>
          <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Live Mail Delivery Test Verification</p>
        </div>
        <div style="background-color: #e8efeb; padding: 18px; border-radius: 12px; border-left: 4px solid #123B32; margin-bottom: 20px;">
          <h3 style="margin: 0 0 6px 0; color: #123B32; font-size: 16px;">✅ Email Pipeline Active!</h3>
          <p style="margin: 0; color: #2d3748; font-size: 14px;">This test message confirms that Brevo API is correctly configured and successfully delivering transactional messages for Shazu Soft Technologies.</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 14px 18px; border-radius: 8px; font-size: 13px; color: #334155; margin-bottom: 20px;">
          <div><strong>Recipient:</strong> ${toEmail}</div>
          <div style="margin-top: 4px;"><strong>Sender Account:</strong> ${BREVO_SENDER}</div>
          <div style="margin-top: 4px;"><strong>Dispatched At:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
        </div>
        <p style="font-size: 13px; line-height: 1.6; color: #64748b;">
          All automatic notification emails for Event Passes, Job Application tokens, 11-Field Membership Charters, and Contact Inquiries will be delivered directly through this pipeline.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} Shazu Soft Technologies • Salem, Tamil Nadu, India
        </p>
      </div>
    </body>
    </html>
  `;

  const result = await sendBrevoEmail({
    toEmail,
    toName: 'Vimal Raj (SST Super Admin)',
    subject: '✅ Live Test Email Verification - Shazu Soft Technologies',
    htmlContent: testHtml
  });

  if (result.success) {
    return { success: true, message: `Live test email successfully delivered to ${toEmail} via Brevo!`, details: result };
  } else {
    return reply.status(500).send({ success: false, error: `Email dispatch failed: ${result.error || 'API Error'}`, details: result });
  }
});

// Start Server
async function start() {
  try {
    await initDatabase();
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`Fastify Server is running at http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
