const path = require('path');
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

const {
  getAdminOtpEmail,
  getContactInquiryEmail,
  getMembershipAckEmail,
  getCareerApplicationReceivedEmail,
  getCareerApplicationStatusEmail,
  getEventRegistrationAckEmail,
  getEventPassVerifiedEmail,
  getAdminWelcomeEmail,
  getAdminDirectEmail
} = require('./email_templates');

// Environment configuration (loaded from .env)
const PORT = process.env.PORT || 5000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'vimalraj5207@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ShazuAdmin2026!';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER = process.env.BREVO_SENDER;

// Google OAuth 2.0 Credentials & Authorized Administrator Emails
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'https://shazusoft.pages.dev/api/auth/google/callback';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://shazusoft.pages.dev').replace(/\/$/, '');
const ALLOWED_ADMIN_EMAILS = (process.env.ALLOWED_ADMIN_EMAILS || 'vimalraj5207@gmail.com').split(',').map(e => e.trim().toLowerCase());

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
  const client = await pool.connect();
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

    // Add target_audience, is_paid, fee_amount, and upi_id columns to events
    await client.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS target_audience VARCHAR(50) DEFAULT 'College';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS fee_amount VARCHAR(100) DEFAULT '0';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100) DEFAULT '8807099288@upi';
    `);

    // Add token_no and audience & payment proof columns to event_registrations
    await client.query(`
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS token_no VARCHAR(100);
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS token_no VARCHAR(100);
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
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS attendance_status VARCHAR(50) DEFAULT 'Not Marked';
      ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS attendance_marked_at TIMESTAMP;
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

    // 11. Memberships Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS memberships (
        id SERIAL PRIMARY KEY,
        association_name VARCHAR(255) NOT NULL,
        membership_type VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        dob VARCHAR(50),
        area_of_interest VARCHAR(255),
        contact_no VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL,
        qualification VARCHAR(255),
        designation VARCHAR(255),
        organization_address TEXT,
        declaration_accepted BOOLEAN DEFAULT TRUE,
        token_no VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Pending',
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

    // Dispatch Brevo OTP Email using modular template
    const { subject: otpSubject, htmlContent: otpHtml } = getAdminOtpEmail({
      name: admin.name || 'Admin',
      email: lowerEmail,
      otpCode
    });

    await sendBrevoEmail({
      toEmail: lowerEmail,
      toName: admin.name || 'Admin',
      subject: otpSubject,
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
  const { rows } = await pool.query("SELECT * FROM careers WHERE status = 'Open' ORDER BY created_at DESC");
  return { jobs: rows };
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

// Contact Form Submission
app.post('/api/public/contact', async (request, reply) => {
  const { name, email, phone, subject, service_category, message } = request.body || {};
  if (!name || !email || !message) {
    return reply.status(400).send({ error: 'Name, Email, and Message are required' });
  }

  const lowerEmail = email.trim().toLowerCase();
  const cleanMsg = message.trim();

  // Duplicate Check: Check if an active inquiry with the same email and message already exists
  const existingCheck = await pool.query(
    `SELECT id, token_no, status FROM contact_inquiries 
     WHERE LOWER(email) = $1 AND LOWER(TRIM(message)) = LOWER($2) AND status IN ('New Lead', 'Pending', 'Contacted')
     ORDER BY created_at DESC LIMIT 1`,
    [lowerEmail, cleanMsg]
  );

  if (existingCheck.rows.length > 0) {
    return reply.status(400).send({
      error: `A matching inquiry with email ${lowerEmail} has already been submitted (Reference Token: ${existingCheck.rows[0].token_no || 'SST-LEAD'}). Our team will get back to you shortly.`
    });
  }

  const initialToken = generateTokenNo('SST-LEAD');

  const result = await pool.query(
    `INSERT INTO contact_inquiries (name, email, phone, subject, service_category, message, token_no)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name.trim(), lowerEmail, phone || '', subject || 'General Inquiry', service_category || 'General', cleanMsg, initialToken]
  );

  const inquiry = result.rows[0];

  // Dispatch acknowledgment email using modular template
  const { subject: clientSubject, htmlContent: clientHtml } = getContactInquiryEmail({
    name,
    email: lowerEmail,
    subject,
    service_category,
    tokenNo: initialToken,
    message: cleanMsg
  });
  sendBrevoEmail({ toEmail: lowerEmail, toName: name, subject: clientSubject, htmlContent: clientHtml });

  return { message: 'Inquiry submitted successfully!', inquiry };
});

// Membership Application Submission
app.post('/api/public/membership/apply', async (request, reply) => {
  try {
    const { 
      association_name, 
      membership_type, 
      name, 
      dob, 
      area_of_interest, 
      contact_no, 
      email, 
      qualification, 
      designation, 
      organization_address, 
      declaration_accepted 
    } = request.body || {};

    if (!name || !email || !contact_no || !membership_type || !association_name) {
      return reply.status(400).send({ error: 'Please fill in all mandatory fields (Name, Email, Phone, Membership Type, Association).' });
    }

    if (!declaration_accepted) {
      return reply.status(400).send({ error: 'Please accept the declaration to proceed with your membership application.' });
    }

    const lowerEmail = email.trim().toLowerCase();
    const cleanAssoc = association_name.trim();

    // Duplicate Check: Check if membership for this association with this email already exists
    const existingCheck = await pool.query(
      `SELECT id, token_no, status FROM memberships 
       WHERE LOWER(email) = $1 AND LOWER(TRIM(association_name)) = LOWER($2)
       LIMIT 1`,
      [lowerEmail, cleanAssoc]
    );

    if (existingCheck.rows.length > 0) {
      return reply.status(400).send({
        error: `A membership application for "${cleanAssoc}" with email ${lowerEmail} has already been registered (Token: ${existingCheck.rows[0].token_no || 'SST-MEM'}, Status: ${existingCheck.rows[0].status || 'Pending'}).`
      });
    }

    const tokenNo = generateTokenNo('SST-MEM');

    const result = await pool.query(
      `INSERT INTO memberships 
       (association_name, membership_type, name, dob, area_of_interest, contact_no, email, qualification, designation, organization_address, declaration_accepted, token_no, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Pending') 
       RETURNING *`,
      [
        cleanAssoc,
        membership_type,
        name.trim(),
        dob || null,
        area_of_interest || '',
        contact_no.trim(),
        lowerEmail,
        qualification || '',
        designation || '',
        organization_address || '',
        Boolean(declaration_accepted),
        tokenNo
      ]
    );

    const membership = result.rows[0];

    // Log to system audit trail
    await logAudit('CREATE', 'MEMBERSHIP', membership.id, `New ${membership_type} application submitted by ${name} (${lowerEmail})`, request);

    // Send confirmation email via Brevo modular template
    const { subject: memSubject, htmlContent: memberEmailHtml } = getMembershipAckEmail({
      name,
      email: lowerEmail,
      membership_type,
      association_name: cleanAssoc,
      designation,
      qualification,
      tokenNo
    });

    sendBrevoEmail({
      toEmail: lowerEmail,
      toName: name,
      subject: memSubject,
      htmlContent: memberEmailHtml
    });

    return { 
      success: true, 
      message: 'Your membership application has been submitted successfully!', 
      token: tokenNo, 
      membership 
    };
  } catch (err) {
    app.log.error('Membership apply error:', err);
    return reply.status(500).send({ error: 'Failed to submit membership application. Please try again.' });
  }
});

// Apply for Job
app.post('/api/public/careers/apply', async (request, reply) => {
  const { job_id, job_title, applicant_name, email, phone, resume_url, message } = request.body || {};
  if (!applicant_name || !email) {
    return reply.status(400).send({ error: 'Name and Email are required' });
  }

  const lowerEmail = email.trim().toLowerCase();
  const cleanTitle = (job_title || 'General Application').trim();

  // Duplicate Check: Check if candidate already applied for this job
  let existingCheck;
  if (job_id) {
    existingCheck = await pool.query(
      'SELECT id, token_no, status FROM applications WHERE job_id = $1 AND LOWER(email) = $2 LIMIT 1',
      [job_id, lowerEmail]
    );
  } else {
    existingCheck = await pool.query(
      'SELECT id, token_no, status FROM applications WHERE LOWER(TRIM(job_title)) = LOWER($1) AND LOWER(email) = $2 LIMIT 1',
      [cleanTitle, lowerEmail]
    );
  }

  if (existingCheck.rows.length > 0) {
    return reply.status(400).send({
      error: `An application with email ${lowerEmail} has already been submitted for "${cleanTitle}" (Current Status: ${existingCheck.rows[0].status || 'Under Review'}).`
    });
  }

  const tokenNo = generateTokenNo('SST-APP');

  const result = await pool.query(
    `INSERT INTO applications (job_id, job_title, applicant_name, email, phone, resume_url, message, token_no, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending') RETURNING *`,
    [job_id || null, cleanTitle, applicant_name.trim(), lowerEmail, phone || '', resume_url || '', message || '', tokenNo]
  );

  const application = result.rows[0];

  // Dispatch applicant email using modular template
  const { subject: careerSubject, htmlContent: candidateHtml } = getCareerApplicationReceivedEmail({
    applicant_name,
    email: lowerEmail,
    job_title: cleanTitle
  });
  sendBrevoEmail({ toEmail: lowerEmail, toName: applicant_name, subject: careerSubject, htmlContent: candidateHtml });

  return { message: 'Application submitted successfully!', application };
});

// Register for Event
app.post('/api/public/events/register', async (request, reply) => {
  const {
    event_id, event_title, name, email, phone, organization, registration_fee, transaction_id, payment_method,
    target_audience, school_name, grade_standard, section_roll, guardian_name, guardian_phone,
    college_name, degree, department, year_of_study, register_no,
    company_name, designation, experience_years, payment_screenshot_url, fee_amount
  } = request.body || {};

  if (!name || !email) {
    return reply.status(400).send({ error: 'Name and Email are required' });
  }

  const lowerEmail = email.trim().toLowerCase();
  const cleanTitle = (event_title || 'General Event').trim();

  // Duplicate Check: Check if user already registered for this event
  let existingCheck;
  if (event_id) {
    existingCheck = await pool.query(
      'SELECT id, token_no, payment_status FROM event_registrations WHERE event_id = $1 AND LOWER(email) = $2 LIMIT 1',
      [event_id, lowerEmail]
    );
  } else {
    existingCheck = await pool.query(
      'SELECT id, token_no, payment_status FROM event_registrations WHERE LOWER(TRIM(event_title)) = LOWER($1) AND LOWER(email) = $2 LIMIT 1',
      [cleanTitle, lowerEmail]
    );
  }

  if (existingCheck.rows.length > 0) {
    const existing = existingCheck.rows[0];
    return reply.status(400).send({
      error: `You are already registered for "${cleanTitle}" with email ${lowerEmail} (Pass Token: ${existing.token_no || 'SST-PASS'}, Status: ${existing.payment_status || 'Registered'}).`
    });
  }

  const fee = registration_fee || 'Free';
  const isPaid = fee !== 'Free' && fee !== '0' && fee !== '';
  const initialStatus = isPaid ? 'Pending Verification' : 'Verified';
  const tokenNo = generateTokenNo('SST-PASS');
  const audience = target_audience || 'College';

  const result = await pool.query(
    `INSERT INTO event_registrations (
      event_id, event_title, name, email, phone, organization, registration_fee, payment_method, transaction_id, token_no, payment_status,
      target_audience, school_name, grade_standard, section_roll, guardian_name, guardian_phone,
      college_name, degree, department, year_of_study, register_no,
      company_name, designation, experience_years, payment_screenshot_url, fee_amount
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27) RETURNING *`,
    [
      event_id || null, cleanTitle, name.trim(), lowerEmail, phone || '', organization || '', fee, payment_method || 'UPI QR', transaction_id || '', tokenNo, initialStatus,
      audience, school_name || '', grade_standard || '', section_roll || '', guardian_name || '', guardian_phone || '',
      college_name || '', degree || '', department || '', year_of_study || '', register_no || '',
      company_name || '', designation || '', experience_years || '', payment_screenshot_url || '', fee_amount || fee
    ]
  );

  const registration = result.rows[0];

  // Dispatch Brevo email using modular template
  const { subject: eventSubject, htmlContent: ticketHtml } = getEventRegistrationAckEmail({
    name: name.trim(),
    email: lowerEmail,
    event_title: cleanTitle,
    tokenNo,
    isPaid,
    initialStatus,
    transaction_id,
    target_audience: audience,
    school_name,
    grade_standard,
    section_roll,
    guardian_name,
    guardian_phone,
    college_name,
    degree,
    department,
    year_of_study,
    register_no,
    company_name,
    designation,
    experience_years
  });

  sendBrevoEmail({ toEmail: lowerEmail, toName: name, subject: eventSubject, htmlContent: ticketHtml });

  return { message: 'Registration submitted successfully!', registration };
});

// In-Memory Server-Side Pageview Deduplication Cache (prevents duplicate fast hits within 2.5 seconds)
const recentTelemetryHits = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentTelemetryHits.entries()) {
    if (now - timestamp > 5000) {
      recentTelemetryHits.delete(key);
    }
  }
}, 10000);

// Track Analytics & Page Views (Strict Mobile / Desktop classification, deduplicated)
app.post('/api/public/analytics/track', async (request, reply) => {
  try {
    const { page_path, referrer, device_type } = request.body || {};
    const user_agent = request.headers['user-agent'] || '';
    const ip_address = request.ip || request.raw.socket.remoteAddress || '127.0.0.1';

    // Disallow Tablet classification - only Mobile or Desktop
    let resolvedDevice = (device_type === 'Mobile' || device_type === 'Desktop') ? device_type : null;
    if (!resolvedDevice) {
      if (/mobile|android|iphone|ipod|ipad|tablet|blackberry|opera mini|iemobile/i.test(user_agent)) {
        resolvedDevice = 'Mobile';
      } else {
        resolvedDevice = 'Desktop';
      }
    }

    const cleanPath = (page_path || 'index.html').trim().replace(/^[/\\]+/, '') || 'index.html';

    // Deduplication check: Ignore identical IP + path logged within 2.5 seconds
    const dedupKey = `${ip_address}::${cleanPath}`;
    const lastHit = recentTelemetryHits.get(dedupKey);
    const now = Date.now();
    if (lastHit && (now - lastHit < 2500)) {
      return reply.status(200).send({ status: 'deduplicated' });
    }
    recentTelemetryHits.set(dedupKey, now);

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

// Admin Approval & Event Registration Payment Verification with Token Dispatch
app.put('/api/admin/event-registrations/:id/payment', { preValidation: [app.authenticate] }, async (request, reply) => {
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
    const { subject: passSubject, htmlContent: verifiedHtml } = getEventPassVerifiedEmail({
      name: reg.name,
      email: reg.email,
      event_title: reg.event_title,
      tokenNo,
      fee: reg.registration_fee
    });
    sendBrevoEmail({ toEmail: reg.email, toName: reg.name, subject: passSubject, htmlContent: verifiedHtml });
  }

  return { registration: reg };
});

// Scan & Verify Pass by Token No, QR payload, or ID
app.post('/api/admin/event-registrations/scan', { preValidation: [app.authenticate] }, async (request, reply) => {
  try {
    const { token_no, query } = request.body || {};
    let searchToken = (token_no || query || '').trim();

    // If scanned string is JSON, parse out token
    if (searchToken.startsWith('{') && searchToken.endsWith('}')) {
      try {
        const parsed = JSON.parse(searchToken);
        searchToken = parsed.token || parsed.token_no || searchToken;
      } catch (e) {}
    }

    if (!searchToken) {
      return reply.status(400).send({ error: 'Please provide a valid pass token or QR code payload to scan.' });
    }

    let regRes = await pool.query(
      `SELECT r.*, e.title as event_full_title, e.event_date, e.location 
       FROM event_registrations r
       LEFT JOIN events e ON r.event_id = e.id
       WHERE LOWER(r.token_no) = LOWER($1) OR r.token_no ILIKE $2
       LIMIT 1`,
      [searchToken, `%${searchToken}%`]
    );

    if (regRes.rows.length === 0 && !isNaN(parseInt(searchToken, 10))) {
      regRes = await pool.query(
        `SELECT r.*, e.title as event_full_title, e.event_date, e.location 
         FROM event_registrations r
         LEFT JOIN events e ON r.event_id = e.id
         WHERE r.id = $1 LIMIT 1`,
        [parseInt(searchToken, 10)]
      );
    }

    if (regRes.rows.length === 0) {
      return reply.status(404).send({ error: `No registration found matching pass token "${searchToken}".` });
    }

    const reg = regRes.rows[0];
    return { success: true, registration: reg };
  } catch (err) {
    app.log.error('Scan pass error:', err);
    return reply.status(500).send({ error: 'Failed to process QR pass verification.' });
  }
});

// Update / Toggle Attendance Check-In Status
app.put('/api/admin/event-registrations/:id/attendance', { preValidation: [app.authenticate] }, async (request, reply) => {
  try {
    const { id } = request.params;
    const { attendance_status } = request.body || {};
    const status = (attendance_status === 'Present' || attendance_status === 'Attended') ? 'Present' : 'Not Marked';
    const markedAt = status === 'Present' ? new Date() : null;

    const result = await pool.query(
      `UPDATE event_registrations 
       SET attendance_status = $1, attendance_marked_at = $2 
       WHERE id = $3 
       RETURNING *`,
      [status, markedAt, id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Registration not found' });
    }

    const reg = result.rows[0];
    await logAudit(
      'UPDATE_ATTENDANCE', 
      'EVENT_REGISTRATION', 
      reg.id, 
      `Marked attendance as [${status}] for ${reg.name} (${reg.token_no}) in "${reg.event_title}"`, 
      request
    );

    return { success: true, registration: reg, message: `Attendance marked as ${status}.` };
  } catch (err) {
    app.log.error('Update attendance error:', err);
    return reply.status(500).send({ error: 'Failed to update attendance status.' });
  }
});

// Candidate Application Status & Stage Update (Clean stage communication, no token boxes)
app.put('/api/admin/applications/:id/status', { preValidation: [app.authenticate] }, async (request, reply) => {
  const { id } = request.params;
  const { status } = request.body || {};

  const currentRes = await pool.query('SELECT * FROM applications WHERE id = $1', [id]);
  if (currentRes.rows.length === 0) return reply.status(404).send({ error: 'Application not found' });
  let appRecord = currentRes.rows[0];

  const result = await pool.query(
    'UPDATE applications SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  appRecord = result.rows[0];

  // Dispatch candidate status update email using modular template
  const { subject: statusSubject, htmlContent: candidateHtml } = getCareerApplicationStatusEmail({
    applicant_name: appRecord.applicant_name,
    email: appRecord.email,
    job_title: appRecord.job_title,
    status
  });

  sendBrevoEmail({ toEmail: appRecord.email, toName: appRecord.applicant_name, subject: statusSubject, htmlContent: candidateHtml });

  return { application: appRecord };
});

// Admin Direct Email Dispatcher
app.post('/api/admin/email/send', { preValidation: [app.authenticate] }, async (request, reply) => {
  const { toEmail, toName, subject, message } = request.body || {};
  if (!toEmail || !subject || !message) {
    return reply.status(400).send({ error: 'toEmail, subject, and message are required' });
  }

  const { htmlContent } = getAdminDirectEmail({ toName, subject, message });

  const success = await sendBrevoEmail({ toEmail, toName: toName || toEmail, subject, htmlContent });
  if (success) {
    return { message: `Email dispatched successfully to ${toEmail}` };
  } else {
    return reply.status(500).send({ error: 'Failed to send email via Brevo API' });
  }
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

  // Send onboarding email notification via Brevo modular template
  const { subject: welcomeSubject, htmlContent: welcomeHtml } = getAdminWelcomeEmail({
    name: newUser.name,
    email: lowerEmail,
    role: newUser.role
  });

  sendBrevoEmail({
    toEmail: lowerEmail,
    toName: newUser.name,
    subject: welcomeSubject,
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
      WITH date_series AS (
        SELECT (CURRENT_DATE - (i || ' day')::interval)::date AS day_date,
               TO_CHAR(CURRENT_DATE - (i || ' day')::interval, 'DD Mon') AS label,
               i AS day_order
        FROM generate_series(6, 0, -1) AS i
      ),
      event_counts AS (
        SELECT DATE(created_at) AS event_date, COUNT(*) AS views
        FROM analytics_events
        WHERE created_at >= (CURRENT_DATE - INTERVAL '6 days')
        GROUP BY DATE(created_at)
      )
      SELECT ds.label, COALESCE(ec.views, 0) AS views
      FROM date_series ds
      LEFT JOIN event_counts ec ON ds.day_date = ec.event_date
      ORDER BY ds.day_order DESC
    `),
    pool.query('SELECT * FROM applications ORDER BY submitted_at DESC LIMIT 5'),
    pool.query('SELECT id, name, email, event_title, registration_fee, payment_method, transaction_id, token_no, payment_status, attendance_status, attendance_marked_at, registered_at FROM event_registrations ORDER BY registered_at DESC'),
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

  // Device Breakdown Formatting (Mobile and Desktop only)
  const deviceCounts = { Mobile: 0, Desktop: 0 };
  deviceBreakdownRes.rows.forEach(r => {
    const key = (r.device_type === 'Mobile' || r.device_type === 'Tablet') ? 'Mobile' : 'Desktop';
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
  const {
    title, category, description, event_date, location, registration_fee, registration_link, image_url, status,
    target_audience, is_paid, fee_amount, upi_id
  } = request.body || {};

  const cleanFee = is_paid ? (fee_amount || registration_fee || '499') : (registration_fee || 'Free');
  const result = await pool.query(
    `INSERT INTO events (title, category, description, event_date, location, registration_fee, registration_link, image_url, status, target_audience, is_paid, fee_amount, upi_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [
      title, category || 'General', description || '', event_date || '', location || '', cleanFee, registration_link || '', image_url || '', status || 'Upcoming',
      target_audience || 'College', is_paid === true || is_paid === 'true' || cleanFee !== 'Free', cleanFee, upi_id || '8807099288@upi'
    ]
  );
  return { event: result.rows[0] };
});

app.put('/api/admin/events/:id', { preValidation: [app.authenticate] }, async (request) => {
  const { id } = request.params;
  const {
    title, category, description, event_date, location, registration_fee, registration_link, image_url, status,
    target_audience, is_paid, fee_amount, upi_id
  } = request.body || {};

  const cleanFee = is_paid ? (fee_amount || registration_fee || '499') : (registration_fee || 'Free');
  const result = await pool.query(
    `UPDATE events
     SET title=$1, category=$2, description=$3, event_date=$4, location=$5, registration_fee=$6, registration_link=$7, image_url=$8, status=$9,
         target_audience=$10, is_paid=$11, fee_amount=$12, upi_id=$13
     WHERE id=$14 RETURNING *`,
    [
      title, category, description, event_date, location, cleanFee, registration_link, image_url, status,
      target_audience || 'College', is_paid === true || is_paid === 'true' || cleanFee !== 'Free', cleanFee, upi_id || '8807099288@upi', id
    ]
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
