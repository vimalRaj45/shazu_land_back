require('dotenv').config();
const path = require('path');
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
  bodyLimit: 15728640 // 15 MB payload limit for 10 MB Base64 file uploads
});

// Environment configuration (loaded from .env)
const PORT = process.env.PORT || 5000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER = process.env.BREVO_SENDER;

// Google OAuth 2.0 Credentials & Authorized Administrator Emails
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';
const ALLOWED_ADMIN_EMAILS = (process.env.ALLOWED_ADMIN_EMAILS || 'admin@shazusofttechnologies.org,malikasaravanan774@gmail.com').split(',').map(e => e.trim().toLowerCase());

// Database Connection Pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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
app.register(jwt, { secret: JWT_SECRET });

// Serve static frontend files
app.register(fastifyStatic, {
  root: path.join(__dirname),
  prefix: '/',
  decorateReply: false
});

// JWT Authentication Decorator
app.decorate('authenticate', async (request, reply) => {
  try {
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
    return reply.redirect(`/admin.html?error=${encodeURIComponent(error || 'Google login cancelled')}`);
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
      return reply.redirect(`/admin.html?error=${encodeURIComponent(tokenData.error_description || 'Failed to exchange authorization code with Google')}`);
    }

    // Fetch User Profile Info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const googleUser = await userRes.json();
    const userEmail = (googleUser.email || '').toLowerCase();

    // Check if Email is Authorized for Admin Panel
    const isAuthorized = ALLOWED_ADMIN_EMAILS.includes(userEmail) || userEmail === (ADMIN_EMAIL || '').toLowerCase();

    if (!isAuthorized) {
      return reply.redirect(`/admin.html?error=${encodeURIComponent(`Access Denied: ${userEmail} is not an authorized administrator email.`)}`);
    }

    // Check or insert admin user record into PostgreSQL DB
    let adminRes = await pool.query('SELECT * FROM admins WHERE email = $1', [userEmail]);
    let adminUser = adminRes.rows[0];
    if (!adminUser) {
      const defaultHash = await bcrypt.hash('OAuthGoogleAdminKey2026!', 10);
      const newAdmin = await pool.query(
        'INSERT INTO admins (email, password_hash) VALUES ($1, $2) RETURNING *',
        [userEmail, defaultHash]
      );
      adminUser = newAdmin.rows[0];
    }

    // Issue SST Signed JWT Token
    const jwtToken = app.jwt.sign({ id: adminUser.id, email: userEmail, provider: 'google', name: googleUser.name, picture: googleUser.picture });

    return reply.redirect(`/admin.html?token=${encodeURIComponent(jwtToken)}&email=${encodeURIComponent(userEmail)}&name=${encodeURIComponent(googleUser.name || 'Admin')}`);
  } catch (err) {
    app.log.error('Google OAuth Exception:', err);
    return reply.redirect(`/admin.html?error=${encodeURIComponent('Internal server error during Google OAuth authentication')}`);
  }
});

// Brevo Email Dispatch Helper
async function sendBrevoEmail({ toEmail, toName, subject, htmlContent }) {
  if (!BREVO_API_KEY) return false;

  try {
    const payload = {
      sender: { name: 'Shazu Soft Technologies', email: BREVO_SENDER },
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

// Generate Unique Token Number Helper
function generateTokenNo(prefix = 'SST-TKN') {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const timeStamp = Date.now().toString().slice(-4);
  return `${prefix}-${timeStamp}-${randomNum}`;
}

// Initialize Database Tables & Seed Initial Data
async function initDatabase() {
  const client = await pool.connect();
  try {
    app.log.info('Initializing Neon PostgreSQL database schema...');

    // 1. Admins Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
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

    // 5. Job Applications Table (with token_no)
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
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Event Registrations Table (with token_no & payment columns)
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_registrations (
        id SERIAL PRIMARY KEY,
        event_id INT REFERENCES events(id) ON DELETE SET NULL,
        event_title VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        organization VARCHAR(255),
        registration_fee VARCHAR(100) DEFAULT 'Free',
        payment_method VARCHAR(50) DEFAULT 'UPI QR',
        transaction_id VARCHAR(255),
        token_no VARCHAR(100),
        payment_status VARCHAR(50) DEFAULT 'Pending Verification',
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure image_url column exists on all relevant tables
    await client.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_url TEXT;`);
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;`);
    await client.query(`ALTER TABLE careers ADD COLUMN IF NOT EXISTS image_url TEXT;`);
    await client.query(`ALTER TABLE courses_services ADD COLUMN IF NOT EXISTS image_url TEXT;`);

    // Add token_no columns if missing
    await client.query(`
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS token_no VARCHAR(100);
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS token_no VARCHAR(100);
    `);

    // 7. Contact Lead Inquiries Table (CRM)
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS token_no VARCHAR(100);
    `);

    // 8. Courses & Services Catalog
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

    // 9. Analytics Events
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        page_path VARCHAR(255),
        user_agent TEXT,
        ip_address VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed Admin Account
    const adminCheck = await client.query('SELECT * FROM admins WHERE email = $1', [ADMIN_EMAIL]);
    if (adminCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await client.query('INSERT INTO admins (email, password_hash) VALUES ($1, $2)', [ADMIN_EMAIL, hashedPassword]);
    }

    app.log.info('Database schema and seed data initialized successfully!');
  } catch (err) {
    app.log.error('Database initialization error:', err);
  } finally {
    client.release();
  }
}

// ----------------------------------------------------
// AUTH ROUTES
// ----------------------------------------------------
app.post('/api/auth/login', async (request, reply) => {
  const { email, password } = request.body || {};
  if (!email || !password) {
    return reply.status(400).send({ error: 'Email and password are required' });
  }

  const { rows } = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
  if (rows.length === 0) {
    return reply.status(401).send({ error: 'Invalid email or password' });
  }

  const admin = rows[0];
  const isValidPassword = await bcrypt.compare(password, admin.password_hash);
  if (!isValidPassword) {
    return reply.status(401).send({ error: 'Invalid email or password' });
  }

  const token = app.jwt.sign({ id: admin.id, email: admin.email });
  return { token, admin: { id: admin.id, email: admin.email } };
});

app.get('/api/auth/me', { preValidation: [app.authenticate] }, async (request) => {
  return { user: request.user };
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
  const { rows } = await pool.query("SELECT * FROM careers WHERE status = 'Open' ORDER BY created_at DESC");
  return { jobs: rows };
});

app.get('/api/public/courses-services', async () => {
  const { rows } = await pool.query('SELECT * FROM courses_services WHERE is_active = TRUE ORDER BY created_at DESC');
  return { offerings: rows };
});

// Contact Form Submission
app.post('/api/public/contact', async (request, reply) => {
  const { name, email, phone, subject, service_category, message } = request.body || {};
  if (!name || !email || !message) {
    return reply.status(400).send({ error: 'Name, Email, and Message are required' });
  }

  const initialToken = generateTokenNo('SST-LEAD');

  const result = await pool.query(
    `INSERT INTO contact_inquiries (name, email, phone, subject, service_category, message, token_no)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, email, phone || '', subject || 'General Inquiry', service_category || 'General', message, initialToken]
  );

  const inquiry = result.rows[0];

  const clientHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #1e292b;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #123B32; margin: 0;">SHAZU SOFT TECHNOLOGIES</h2>
        <p style="color: #527A68; font-size: 13px; margin-top: 4px;">Thank you for contacting us!</p>
      </div>
      <p>Dear <strong>${name}</strong>,</p>
      <p>We have received your inquiry regarding <strong>"${subject || 'General Inquiry'}"</strong>.</p>
      <div style="background-color: #E8EFEB; border: 1px border #123B32; padding: 12px; border-radius: 8px; text-align: center; margin: 16px 0;">
        <span style="font-size: 11px; text-transform: uppercase; color: #123B32; font-weight: bold;">Your Reference Token Number:</span>
        <div style="font-size: 18px; font-family: monospace; font-weight: bold; color: #123B32; margin-top: 4px;">${initialToken}</div>
      </div>
      <p style="font-size: 13px; color: #64748b;">Our Salem operations team will reach out shortly using your reference token.</p>
    </div>
  `;
  sendBrevoEmail({ toEmail: email, toName: name, subject: `Inquiry Received [Ref: ${initialToken}] - SST`, htmlContent: clientHtml });

  return { message: 'Inquiry submitted successfully!', inquiry };
});

// Apply for Job
app.post('/api/public/careers/apply', async (request, reply) => {
  const { job_id, job_title, applicant_name, email, phone, resume_url, message } = request.body || {};
  if (!applicant_name || !email) {
    return reply.status(400).send({ error: 'Name and Email are required' });
  }

  const initialToken = generateTokenNo('SST-APP');

  const result = await pool.query(
    `INSERT INTO applications (job_id, job_title, applicant_name, email, phone, resume_url, message, token_no)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [job_id || null, job_title || 'General Application', applicant_name, email, phone || '', resume_url || '', message || '', initialToken]
  );

  const application = result.rows[0];

  const candidateHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #1e292b;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #123B32; margin: 0;">SHAZU SOFT TECHNOLOGIES</h2>
        <p style="color: #C47D4C; font-size: 13px; margin-top: 4px; font-weight: bold;">Hiring Operations</p>
      </div>
      <p>Dear <strong>${applicant_name}</strong>,</p>
      <p>Thank you for applying for <strong>"${job_title || 'Position'}"</strong> at Shazu Soft Technologies!</p>
      <div style="background-color: #f8fafc; border: 1px border #cbd5e1; padding: 12px; border-radius: 8px; text-center; margin: 16px 0;">
        <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">Candidate Application Reference Token:</span>
        <div style="font-size: 18px; font-family: monospace; font-weight: bold; color: #123B32; margin-top: 4px;">${initialToken}</div>
      </div>
      <p style="font-size: 13px; color: #64748b;">Please keep this Token Number for your application status queries.</p>
    </div>
  `;
  sendBrevoEmail({ toEmail: email, toName: applicant_name, subject: `Application Received [Token: ${initialToken}] - SST`, htmlContent: candidateHtml });

  return { message: 'Application submitted successfully!', application };
});

// Register for Event
app.post('/api/public/events/register', async (request, reply) => {
  const { event_id, event_title, name, email, phone, organization, registration_fee, transaction_id, payment_method } = request.body || {};
  if (!name || !email) {
    return reply.status(400).send({ error: 'Name and Email are required' });
  }

  const fee = registration_fee || 'Free';
  const isPaid = fee !== 'Free' && fee !== '0';
  const initialStatus = isPaid ? 'Pending Verification' : 'Verified';
  const tokenNo = generateTokenNo('SST-PASS');

  const result = await pool.query(
    `INSERT INTO event_registrations (event_id, event_title, name, email, phone, organization, registration_fee, payment_method, transaction_id, token_no, payment_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [event_id || null, event_title || 'General Event', name, email, phone || '', organization || '', fee, payment_method || 'UPI QR', transaction_id || '', tokenNo, initialStatus]
  );

  const registration = result.rows[0];

  const ticketHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #123B32; border-radius: 16px; padding: 28px; color: #0f172a;">
      <div style="text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #123B32; margin: 0;">SHAZU SOFT TECHNOLOGIES</h2>
        <span style="display: inline-block; background-color: #E8EFEB; color: #123B32; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: bold; margin-top: 8px;">EVENT TICKET PASS</span>
      </div>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your registration for <strong>"${event_title}"</strong> has been recorded.</p>
      
      <div style="background-color: #f8fafc; border: 2px dashed #123B32; padding: 16px; border-radius: 12px; text-align: center; margin: 20px 0;">
        <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">OFFICIAL ENTRY TOKEN NUMBER</span>
        <div style="font-size: 22px; font-family: monospace; font-weight: bold; color: #123B32; letter-spacing: 1px; margin: 6px 0;">${tokenNo}</div>
        <span style="display: inline-block; background-color: ${initialStatus === 'Verified' ? '#dcfce7' : '#fef3c7'}; color: ${initialStatus === 'Verified' ? '#15803d' : '#b45309'}; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: bold;">Status: ${initialStatus}</span>
      </div>

      <p style="font-size: 13px; color: #64748b;">Show this Token Number at the event desk for quick entry validation.</p>
    </div>
  `;
  sendBrevoEmail({ toEmail: email, toName: name, subject: `Event Pass Token [${tokenNo}]: ${event_title}`, htmlContent: ticketHtml });

  return { message: 'Registration submitted successfully!', registration };
});

// Track Analytics
app.post('/api/public/analytics/track', async (request) => {
  const { page_path } = request.body || {};
  const user_agent = request.headers['user-agent'] || '';
  const ip_address = request.ip || request.raw.socket.remoteAddress || '';

  if (page_path) {
    await pool.query(
      'INSERT INTO analytics_events (page_path, user_agent, ip_address) VALUES ($1, $2, $3)',
      [page_path, user_agent, ip_address]
    );
  }
  return { status: 'recorded' };
});

// ----------------------------------------------------
// PROTECTED ADMIN API ROUTES
// ----------------------------------------------------

// Admin Approval & Event Registration Payment Verification with Token Dispatch
app.put('/api/admin/event-registrations/:id/payment', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  const { payment_status } = request.body;
  
  // Fetch current reg
  const currentRes = await pool.query('SELECT * FROM event_registrations WHERE id = $1', [id]);
  if (currentRes.rows.length === 0) return reply.status(404).send({ error: 'Registration not found' });
  
  let reg = currentRes.rows[0];
  let tokenNo = reg.token_no || generateTokenNo('SST-PASS');

  const result = await pool.query(
    'UPDATE event_registrations SET payment_status = $1, token_no = $2 WHERE id = $3 RETURNING *',
    [payment_status, tokenNo, id]
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

        <p style="font-size: 13px; color: #64748b;">Please present your Token Number (<strong>${tokenNo}</strong>) at the venue entrance badge counter.</p>
        <p style="font-size: 13px; color: #64748b;">Warm regards,<br><strong>SST Event Operations Desk</strong></p>
      </div>
    `;
    sendBrevoEmail({ toEmail: reg.email, toName: reg.name, subject: `🎟️ APPROVED! Event Entry Token: ${tokenNo}`, htmlContent: verifiedHtml });
  }

  return { registration: reg };
});

// Candidate Application Approval with Candidate Token
app.put('/api/admin/applications/:id/status', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  const { status } = request.body;

  const currentRes = await pool.query('SELECT * FROM applications WHERE id = $1', [id]);
  let appRecord = currentRes.rows[0];
  let tokenNo = appRecord.token_no || generateTokenNo('SST-CAND');

  const result = await pool.query(
    'UPDATE applications SET status = $1, token_no = $2 WHERE id = $3 RETURNING *',
    [status, tokenNo, id]
  );
  appRecord = result.rows[0];

  if (status === 'Shortlisted' || status === 'Approved') {
    const candidateHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #123B32; border-radius: 16px; padding: 24px; color: #1e292b;">
        <h3 style="color: #123B32; margin-top: 0;">🎉 Congratulations! You have been Shortlisted</h3>
        <p>Dear <strong>${appRecord.applicant_name}</strong>,</p>
        <p>Your job application for <strong>"${appRecord.job_title}"</strong> has been approved for the next interview round at Shazu Soft Technologies!</p>
        
        <div style="background-color: #E8EFEB; border: 1px border #123B32; padding: 14px; border-radius: 8px; text-align: center; margin: 16px 0;">
          <span style="font-size: 11px; text-transform: uppercase; color: #123B32; font-weight: bold;">CANDIDATE INTERVIEW TOKEN NO</span>
          <div style="font-size: 20px; font-family: monospace; font-weight: bold; color: #123B32; margin-top: 4px;">${tokenNo}</div>
        </div>

        <p style="font-size: 13px; color: #64748b;">Our hiring manager will contact you with interview schedule details. Quote Token No <strong>${tokenNo}</strong> in all correspondence.</p>
      </div>
    `;
    sendBrevoEmail({ toEmail: appRecord.email, toName: appRecord.applicant_name, subject: `🎉 Application Approved [Interview Token: ${tokenNo}] - SST`, htmlContent: candidateHtml });
  }

  return { application: appRecord };
});

// Admin Direct Email Dispatcher
app.post('/api/admin/email/send', { preValidation: [app.authenticate] }, async (request, reply) => {
  const { toEmail, toName, subject, message } = request.body || {};
  if (!toEmail || !subject || !message) {
    return reply.status(400).send({ error: 'toEmail, subject, and message are required' });
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #123B32; border-radius: 12px; padding: 24px; color: #1e292b;">
      <div style="margin-bottom: 20px; border-bottom: 2px solid #123B32; padding-bottom: 12px;">
        <h3 style="color: #123B32; margin: 0;">SHAZU SOFT TECHNOLOGIES</h3>
        <p style="color: #C47D4C; font-size: 12px; margin: 2px 0 0 0;">Official Communication</p>
      </div>
      <p style="white-space: pre-line; line-height: 1.6;">${message}</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;">
      <p style="font-size: 12px; color: #64748b; margin: 0;">Shazu Soft Technologies Management<br>Salem, Tamil Nadu, India</p>
    </div>
  `;

  const success = await sendBrevoEmail({ toEmail, toName: toName || toEmail, subject, htmlContent });
  if (success) {
    return { message: `Email dispatched successfully to ${toEmail}` };
  } else {
    return reply.status(500).send({ error: 'Failed to send email via Brevo API' });
  }
});

// Admin Analytics Overview
app.get('/api/admin/analytics', { preValidation: [app.authenticate] }, async () => {
  const [totalApps, totalEvents, totalJobs, totalViews, totalLeads, pageBreakdown, recentApps] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM applications'),
    pool.query('SELECT COUNT(*) FROM events'),
    pool.query('SELECT COUNT(*) FROM careers'),
    pool.query('SELECT COUNT(*) FROM analytics_events'),
    pool.query('SELECT COUNT(*) FROM contact_inquiries'),
    pool.query('SELECT page_path, COUNT(*) as views FROM analytics_events GROUP BY page_path ORDER BY views DESC LIMIT 5'),
    pool.query('SELECT * FROM applications ORDER BY submitted_at DESC LIMIT 5')
  ]);

  return {
    metrics: {
      totalApplications: parseInt(totalApps.rows[0].count),
      totalEvents: parseInt(totalEvents.rows[0].count),
      totalJobs: parseInt(totalJobs.rows[0].count),
      totalViews: parseInt(totalViews.rows[0].count),
      totalLeads: parseInt(totalLeads.rows[0].count)
    },
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
  const { status } = request.body;
  const result = await pool.query('UPDATE contact_inquiries SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
  return { lead: result.rows[0] };
});

app.delete('/api/admin/leads/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  await pool.query('DELETE FROM contact_inquiries WHERE id = $1', [id]);
  return { message: 'Lead deleted' };
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
  const { title, category, description, event_date, location, registration_fee, registration_link, image_url, status } = request.body;
  const result = await pool.query(
    `INSERT INTO events (title, category, description, event_date, location, registration_fee, registration_link, image_url, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [title, category || 'General', description || '', event_date || '', location || '', registration_fee || 'Free', registration_link || '', image_url || '', status || 'Upcoming']
  );
  return { event: result.rows[0] };
});

app.put('/api/admin/events/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  const { title, category, description, event_date, location, registration_fee, registration_link, image_url, status } = request.body;
  const result = await pool.query(
    `UPDATE events
     SET title=$1, category=$2, description=$3, event_date=$4, location=$5, registration_fee=$6, registration_link=$7, image_url=$8, status=$9
     WHERE id=$10 RETURNING *`,
    [title, category, description, event_date, location, registration_fee, registration_link, image_url, status, id]
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
  return { message: 'Event registration deleted' };
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
