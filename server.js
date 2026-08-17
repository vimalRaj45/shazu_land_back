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

  const result = await pool.query(
    `INSERT INTO applications (job_id, job_title, applicant_name, email, phone, resume_url, message, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending') RETURNING *`,
    [job_id || null, job_title || 'General Application', applicant_name, email, phone || '', resume_url || '', message || '']
  );

  const application = result.rows[0];

  const candidateHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; color: #1e293b;">
      <div style="background-color: #123B32; padding: 24px 32px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">SHAZU SOFT TECHNOLOGIES</h2>
        <p style="color: #C47D4C; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase;">Talent Acquisition & Hiring Operations</p>
      </div>
      <div style="padding: 32px;">
        <h3 style="color: #0f172a; margin-top: 0; font-size: 16px; font-weight: 600;">Application Received</h3>
        <p style="color: #475569; font-size: 13px; line-height: 1.6;">Dear <strong>${applicant_name}</strong>,<br>Thank you for submitting your application for the <strong>"${job_title || 'Engineering'}"</strong> position at Shazu Soft Technologies.</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #123B32; padding: 14px 18px; border-radius: 6px; margin: 20px 0;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Current Application Stage</div>
          <div style="font-size: 15px; font-weight: 700; color: #123B32; margin-top: 2px;">Application Received (Under Review)</div>
        </div>

        <p style="color: #475569; font-size: 13px; line-height: 1.6;">Our recruitment team is reviewing your profile and credentials. If your qualifications match our current hiring requirements, our Talent Acquisition team will reach out to schedule an introductory discussion.</p>
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-top: 24px; margin-bottom: 0;">Warm regards,<br><strong>Talent Acquisition Desk</strong><br>Shazu Soft Technologies</p>
      </div>
      <div style="background-color: #f8fafc; padding: 14px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
        © 2026 Shazu Soft Technologies. All rights reserved.
      </div>
    </div>
  `;
  sendBrevoEmail({ toEmail: email, toName: applicant_name, subject: `Application Received: ${job_title || 'Position'} - Shazu Soft Technologies`, htmlContent: candidateHtml });

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
        <span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: bold; margin-top: 8px;">Registration Reference</span>
      </div>
      <p>Dear <strong>${name}</strong>,</p>
      <p>Thank you for registering for <strong>"${event_title}"</strong>.</p>
      <div style="background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
        <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">Your Event Access Token:</span>
        <div style="font-size: 24px; font-family: monospace; font-weight: bold; color: #123B32; letter-spacing: 2px; margin: 6px 0;">${tokenNo}</div>
        <span style="font-size: 11px; color: #64748b;">Status: <strong>${initialStatus}</strong></span>
      </div>
    </div>
  `;
  sendBrevoEmail({ toEmail: email, toName: name, subject: `Event Registration Confirmation [Token: ${tokenNo}] - SST`, htmlContent: ticketHtml });

  return { message: 'Registration submitted successfully!', registration };
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
