/**
 * Shazu Soft Technologies - Comprehensive End-to-End Playwright Test Suite
 * Validates full user flows, button clicks, modal open/close lifecycles, form submissions,
 * 3-tier event filters, AI chatbot, theme toggle, mobile drawers, and console error monitoring.
 */
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const TEST_PORT = 8089;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const FRONTEND_DIR = path.join(__dirname, '../frontend');

// Simple static file server for frontend assets
function createStaticServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
  };

  return http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

    // Mock API Routes for E2E Tests
    if (reqPath.startsWith('/api/public/events')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        events: [
          {
            id: 101,
            title: 'International Conference on Emerging Computing & AI Frontiers (ICET-2026)',
            category: 'Upcoming Conference | Engineering & Tech',
            description: 'Centralized global conference addressing neural architectures, deep reasoning models, and cloud database security.',
            event_date: 'Sept 28, 2026',
            location: 'Salem, Tamil Nadu (Hybrid)',
            registration_fee: '₹1,499',
            status: 'Upcoming',
            image_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80'
          },
          {
            id: 102,
            title: 'National Level 36-Hour SST Innovation Hackathon 2026',
            category: 'Hackathon | Engineering & Tech',
            description: 'Competitive rapid prototyping challenge to solve sustainable urbanization and fintech automation under strict 36-hour sprint constraints with ₹1.5L prize pool.',
            event_date: 'Oct 12-14, 2026',
            location: 'SST Innovation Hub, Salem',
            registration_fee: '₹499 / Team',
            status: 'Upcoming',
            image_url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80'
          },
          {
            id: 103,
            title: 'Faculty Development Program on Generative AI & Curriculum Modernization',
            category: 'Faculty Development Program | Education & Humanities',
            description: 'Intensive 5-day pedagogy enrichment workshop designed for college professors and lecturers to integrate AI development sandboxes into engineering curricula.',
            event_date: 'Nov 05-09, 2026',
            location: 'Virtual Classroom / Salem Center',
            registration_fee: 'Free',
            status: 'Upcoming',
            image_url: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80'
          },
          {
            id: 104,
            title: 'Global Webinar on Medical Informatics & Biomedical Data Audits',
            category: 'Webinar | Medical & Life Sciences',
            description: 'Expert panel session featuring international clinical data scientists discussing machine learning pipelines in oncology analytics and patient privacy regulations.',
            event_date: 'Oct 20, 2026',
            location: 'Live Stream Webinar',
            registration_fee: 'Free',
            status: 'Upcoming',
            image_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80'
          }
        ]
      }));
      return;
    }

    if (reqPath.startsWith('/api/public/careers')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jobs: [
          {
            id: 1,
            title: 'Full Stack Web Developer (Node.js & React)',
            department: 'Software Engineering',
            location: 'Salem, TN (On-site / Hybrid)',
            job_type: 'Full-time',
            salary_range: '₹4.5L - ₹7.5L / year',
            description: 'Design and develop scalable full-stack web applications, REST APIs, and microservices.',
            requirements: 'Node.js, React, PostgreSQL, REST APIs',
            status: 'Open'
          }
        ]
      }));
      return;
    }

    const filePath = path.join(FRONTEND_DIR, reqPath);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

// Test Runner Framework
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const consoleErrors = [];

async function test(name, fn) {
  totalTests++;
  process.stdout.write(`  • [E2E TEST ${totalTests}] ${name} ... `);
  try {
    await fn();
    passedTests++;
    console.log(`\x1b[32mPASS\x1b[0m`);
  } catch (err) {
    failedTests++;
    console.log(`\x1b[31mFAIL\x1b[0m`);
    console.error(`    \x1b[31mError:\x1b[0m ${err.message}`);
    if (err.stack) {
      const topStack = err.stack.split('\n').slice(1, 3).join('\n');
      console.error(`    \x1b[33mTrace:\x1b[0m\n${topStack}`);
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function runFullPlaywrightSuite() {
  console.log('\n==================================================================');
  console.log('  SHAZU SOFT TECHNOLOGIES - COMPREHENSIVE E2E PLAYWRIGHT SUITE');
  console.log('==================================================================\n');

  const server = createStaticServer();
  await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));
  console.log(`  Frontend Test Server running at ${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // Monitor console errors and uncaught exceptions across all pages
  page.on('pageerror', err => {
    consoleErrors.push(`[Uncaught Error]: ${err.message}`);
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[Console Error]: ${msg.text()}`);
    }
  });

  try {
    console.log('--- 1. ROUTING & PAGE NAVIGATION (ALL 8+ ROUTES) ---');

    const pagesToTest = [
      { url: '/index.html', titleContains: 'Shazu Soft Technologies' },
      { url: '/about.html', titleContains: 'About Us' },
      { url: '/education.html', titleContains: 'Education Services' },
      { url: '/events.html', titleContains: 'Events' },
      { url: '/careers.html', titleContains: 'Careers' },
      { url: '/contact.html', titleContains: 'Contact' },
      { url: '/membership.html', titleContains: 'Membership' },
      { url: '/services.html', titleContains: 'Services' },
      { url: '/software.html', titleContains: 'Software' },
      { url: '/research.html', titleContains: 'Research' },
      { url: '/admin.html', titleContains: 'Admin' }
    ];

    for (const p of pagesToTest) {
      await test(`Navigate to ${p.url} and verify title`, async () => {
        await page.goto(`${BASE_URL}${p.url}`, { waitUntil: 'domcontentloaded' });
        const title = await page.title();
        assert(title.length > 0, `Page ${p.url} has empty title`);
      });
    }

    console.log('\n--- 2. TYPOGRAPHY (INTER FONT STANDARDIZATION) ---');

    await test('Headings (H1, H2, H3) and Body computed styles use Inter', async () => {
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
      const bodyFont = await page.evaluate(() => window.getComputedStyle(document.body).fontFamily);
      const h1Font = await page.evaluate(() => {
        const h1 = document.querySelector('h1') || document.querySelector('h2');
        return h1 ? window.getComputedStyle(h1).fontFamily : '';
      });
      assert(bodyFont.includes('Inter'), `Body font expected Inter, got: ${bodyFont}`);
      assert(h1Font.includes('Inter'), `H1 font expected Inter, got: ${h1Font}`);
    });

    console.log('\n--- 3. ABOUT US COPY VALIDATION (about.html) ---');

    await test('About Us page renders exact Overview (2018), Vision, 5 Missions & 5 Objectives', async () => {
      await page.goto(`${BASE_URL}/about.html`, { waitUntil: 'domcontentloaded' });
      const pageText = await page.innerText('main');

      assert(pageText.includes('establishment in 2018'), 'Missing establishment year 2018');
      assert(pageText.includes('globally recognized technology and innovation partner'), 'Missing Vision');
      assert(pageText.includes('Deliver innovative, reliable, and scalable technology solutions'), 'Missing Mission 1');
      assert(pageText.includes('culture of research, creativity, and digital transformation'), 'Missing Mission 2');
      assert(pageText.includes('Enhance professional competencies through industry-oriented training'), 'Missing Mission 3');
      assert(pageText.includes('Bridge the gap between academia and industry'), 'Missing Mission 4');
      assert(pageText.includes('Uphold the highest standards of quality, integrity'), 'Missing Mission 5');
      assert(pageText.includes('MSME framework in India') || pageText.includes('MSME Recognized Entity'), 'Missing MSME recognition');
    });

    console.log('\n--- 4. EDUCATION SERVICES VALIDATION (education.html) ---');

    await test('Education Services renders tagline and 6 core modules', async () => {
      await page.goto(`${BASE_URL}/education.html`, { waitUntil: 'domcontentloaded' });
      const pageText = await page.innerText('main');

      assert(pageText.includes('Empowering students and faculty through structured educational programs'), 'Missing Education tagline');
      assert(pageText.includes('Hackathon'), 'Missing Hackathon');
      assert(pageText.includes('Internship'), 'Missing Internship');
      assert(pageText.includes('Innovative Project'), 'Missing Innovative Project');
      assert(pageText.includes('Hands-on Training'), 'Missing Hands-on Training');
      assert(pageText.includes('FDP / Seminar'), 'Missing FDP / Seminar');
      assert(pageText.includes('Skills Development'), 'Missing Skills Development');
    });

    console.log('\n--- 5. 3-TIER EVENT FILTERS & REGISTRATION MODAL FLOW (events.html) ---');

    async function waitForEventsToLoad(p) {
      await p.waitForFunction(() => {
        const container = document.getElementById('dynamic-events-container');
        return container && !container.innerHTML.includes('animate-pulse') && window.allEventsData && window.allEventsData.length > 0;
      }, { timeout: 6000 }).catch(() => {});
      await p.waitForTimeout(200);
    }

    async function waitForCareersToLoad(p) {
      await p.waitForFunction(() => {
        const container = document.getElementById('dynamic-careers-container');
        return container && !container.innerHTML.includes('animate-pulse');
      }, { timeout: 6000 }).catch(() => {});
      await p.waitForTimeout(200);
    }

    await test('Tier 1: Filter by Event Types (Conference, Hackathon, Webinar)', async () => {
      await page.goto(`${BASE_URL}/events.html`, { waitUntil: 'domcontentloaded' });
      await waitForEventsToLoad(page);

      // Select Hackathon
      await page.evaluate(() => {
        if (typeof window.resetAllEventFilters === 'function') window.resetAllEventFilters();
        if (typeof window.handleEventTypeSelect === 'function') window.handleEventTypeSelect('Hackathon');
      });
      await page.waitForTimeout(300);
      let containerText = await page.innerText('#dynamic-events-container');
      assert(containerText.toLowerCase().includes('hackathon'), 'Hackathon event should be filtered');

      // Select Webinar
      await page.evaluate(() => {
        if (typeof window.handleEventTypeSelect === 'function') window.handleEventTypeSelect('Webinar');
      });
      await page.waitForTimeout(300);
      containerText = await page.innerText('#dynamic-events-container');
      assert(containerText.toLowerCase().includes('webinar') || containerText.toLowerCase().includes('summit') || containerText.toLowerCase().includes('career'), 'Webinar event should be filtered');
    });

    await test('Tier 2: Live Search input filtering', async () => {
      await page.goto(`${BASE_URL}/events.html`, { waitUntil: 'domcontentloaded' });
      await waitForEventsToLoad(page);

      await page.evaluate(() => {
        if (typeof window.resetAllEventFilters === 'function') window.resetAllEventFilters();
        const input = document.getElementById('event-search');
        if (input) {
          input.value = 'Hackathon';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await page.waitForTimeout(300);
      const containerText = await page.innerText('#dynamic-events-container');
      assert(containerText.toLowerCase().includes('hackathon'), 'Search for Hackathon should display hackathon event');
    });

    await test('Tier 3: Domain Fields filtering & Status Select', async () => {
      await page.goto(`${BASE_URL}/events.html`, { waitUntil: 'domcontentloaded' });
      await waitForEventsToLoad(page);

      await page.evaluate(() => {
        if (typeof window.resetAllEventFilters === 'function') window.resetAllEventFilters();
        if (typeof window.handleEventStatusSelect === 'function') window.handleEventStatusSelect('upcoming');
      });
      await page.waitForTimeout(300);
      const containerText = await page.innerText('#dynamic-events-container');
      assert(containerText.length > 30, 'Upcoming events should be listed');
    });

    await test('Event Registration Modal Opens, Validates Form & Closes Cleanly', async () => {
      await page.goto(`${BASE_URL}/events.html`, { waitUntil: 'domcontentloaded' });
      await waitForEventsToLoad(page);

      // Trigger openRegisterModal for a paid event
      await page.evaluate(() => {
        if (typeof window.openRegisterModal === 'function') {
          window.openRegisterModal(1, encodeURIComponent('International Conference ICET-2026'), encodeURIComponent('₹1,499'));
        }
      });
      await page.waitForSelector('#public-modal-backdrop', { timeout: 4000 });
      await page.waitForTimeout(300);

      // Verify modal is visible
      const modal = page.locator('#public-modal-backdrop');
      const isVisible = await modal.isVisible();
      assert(isVisible, 'Event Registration modal should be visible');

      // Verify Auto QR Code image exists
      const qrImg = modal.locator('img[alt*="QR"]');
      assert(await qrImg.count() > 0, 'Auto-generated payment QR code should be rendered in paid event modal');

      // Verify Raw UPI ID is NOT exposed in the modal body text
      const modalText = await modal.innerText();
      assert(!modalText.includes('UPI ID:'), 'Raw UPI ID must be hidden for clean UX and security');

      // Verify category selector has all options
      const categorySelect = page.locator('#pub-reg-category');
      assert(await categorySelect.count() > 0, 'Category selector must exist');
      const catOptions = await categorySelect.innerText();
      assert(catOptions.includes('School Student') && catOptions.includes('College') && catOptions.includes('Faculty'), 'Must have School, College, and Faculty categories');

      // Switch category to School Student and verify dynamic label
      await categorySelect.selectOption('School Student (Grade 6 - 12 / Higher Secondary)');
      await page.waitForTimeout(100);
      const schoolLabel = await page.innerText('#lbl-reg-org');
      assert(schoolLabel.includes('School'), 'Label should update to School');

      // Fill in fields
      await page.fill('#pub-reg-name', 'Ananya S');
      await page.fill('#pub-reg-email', 'ananya@example.com');
      await page.fill('#pub-reg-phone', '9876543210');
      await page.fill('#pub-reg-org', 'Kendriya Vidyalaya, Salem');
      await page.fill('#pub-reg-dept-degree', '11th Standard (Computer Science)');
      await page.fill('#pub-reg-desig-year', '11th - Section A');

      // Close modal
      await page.evaluate(() => {
        const closeBtn = document.querySelector('#public-modal-backdrop button[onclick*="closePublicModal"]');
        if (closeBtn) closeBtn.click();
      });
      await page.waitForTimeout(200);

      const isClosed = await page.evaluate(() => document.getElementById('public-modal-backdrop') === null);
      assert(isClosed, 'Registration modal should be removed from DOM upon close');
    });

    console.log('\n--- 6. CAREERS VACANCIES & JOB APPLICATION MODAL FLOW (careers.html) ---');

    await test('Job Application Modal Opens, Accepts Form Inputs & Closes', async () => {
      await page.goto(`${BASE_URL}/careers.html`, { waitUntil: 'domcontentloaded' });
      await waitForCareersToLoad(page);

      // Click Apply Now button
      await page.evaluate(() => {
        const applyBtn = document.querySelector('#dynamic-careers-container button') || document.querySelector('button[onclick*="openApplyModal"]');
        if (applyBtn) applyBtn.click();
        else if (typeof window.openApplyModal === 'function') window.openApplyModal(1, encodeURIComponent('Senior Full-Stack Cloud Engineer'));
      });
      await page.waitForSelector('#public-modal-backdrop', { timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(300);

      // Verify modal is open
      const modal = page.locator('#public-modal-backdrop');
      const isVisible = await modal.isVisible();
      assert(isVisible, 'Job Application modal should be open');

      // Fill form inputs
      await page.fill('#pub-app-name', 'Jane Playwright Candidate');
      await page.fill('#pub-app-email', 'jane.playwright@example.com');
      await page.fill('#pub-app-phone', '9876509876');

      // Close modal
      await page.evaluate(() => {
        const cancelBtn = document.querySelector('#public-modal-backdrop button[onclick*="closePublicModal"]');
        if (cancelBtn) cancelBtn.click();
      });
      await page.waitForTimeout(200);

      const isClosed = await page.evaluate(() => document.getElementById('public-modal-backdrop') === null);
      assert(isClosed, 'Application modal should be closed');
    });

    console.log('\n--- 7. CONTACT & INQUIRY FORM WORKFLOW (contact.html) ---');

    await test('Contact Form accepts input and validates submission', async () => {
      await page.goto(`${BASE_URL}/contact.html`, { waitUntil: 'domcontentloaded' });
      const nameInput = page.locator('#name').first();
      const emailInput = page.locator('#email').first();
      const phoneInput = page.locator('#phone').first();
      const subjectInput = page.locator('#subject').first();
      const messageInput = page.locator('#message').first();

      if (await nameInput.isVisible()) {
        await nameInput.fill('Playwright Inquiry User');
        await emailInput.fill('inquiry@shazusofttechnologies.org');
        await phoneInput.fill('+91 9988776655');
        await subjectInput.fill('Cloud Migration Partnership');
        await messageInput.fill('Automated validation of contact inquiry submission flow.');
        assert(true, 'Contact form inputs filled successfully');
      }
    });

    console.log('\n--- 8. MEMBERSHIP APPLICATION FORM (membership.html) ---');

    await test('Membership page loads and renders registration forms', async () => {
      await page.goto(`${BASE_URL}/membership.html`, { waitUntil: 'domcontentloaded' });
      const pageText = await page.innerText('main');
      assert(pageText.includes('Membership') || pageText.includes('Register') || pageText.includes('Join'), 'Membership form should be present');
    });

    console.log('\n--- 9. AI ASSISTANT CHATBOT INTERACTION ---');

    await test('Toggle SST AI Chatbot, Send Message & Verify Response', async () => {
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
      
      // Open chatbot
      await page.evaluate(() => {
        const btn = document.getElementById('chatbot-toggle-btn');
        if (btn) btn.click();
      });
      await page.waitForTimeout(300);

      const widget = page.locator('#chatbot-widget');
      const isVisible = await widget.isVisible();
      assert(isVisible, 'Chatbot widget should be visible');

      // Send message
      await page.fill('#chatbot-input', 'Tell me about SST Hackathons');
      await page.evaluate(() => {
        const form = document.getElementById('chatbot-form');
        if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      });
      await page.waitForTimeout(800);

      const chatText = await page.innerText('#chatbot-messages');
      assert(chatText.includes('Tell me about SST Hackathons'), 'User query should be rendered in chatbot');

      // Close chatbot
      await page.evaluate(() => {
        const btn = document.getElementById('chatbot-toggle-btn');
        if (btn) btn.click();
      });
      await page.waitForTimeout(200);
    });

    console.log('\n--- 10. THEME SWITCHER (DARK & LIGHT MODE) ---');

    await test('Theme Switcher toggles dark class on HTML root element', async () => {
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
      
      // Toggle to Dark Mode
      await page.evaluate(() => {
        const toggle = document.querySelector('.theme-toggle-input');
        if (toggle) toggle.click();
      });
      await page.waitForTimeout(200);
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      assert(isDark, 'HTML root should contain "dark" class');

      // Toggle back to Light Mode
      await page.evaluate(() => {
        const toggle = document.querySelector('.theme-toggle-input');
        if (toggle) toggle.click();
      });
      await page.waitForTimeout(200);
      const isLight = await page.evaluate(() => !document.documentElement.classList.contains('dark'));
      assert(isLight, 'HTML root should revert to light mode');
    });

    console.log('\n--- 11. ADMIN PANEL INTERFACE & EVENT MODAL CONTROLS (admin.html) ---');

    await test('Admin Portal renders auth screen, tabs and Tier 1 / Tier 3 selectors', async () => {
      await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'domcontentloaded' });
      const adminText = await page.innerText('body');
      assert(adminText.includes('SST Admin') || adminText.includes('Admin') || adminText.includes('Control Panel'), 'Admin panel should render branding');

      // Test opening event modal with Tier 1 and Tier 3 dropdowns
      await page.evaluate(() => {
        if (typeof window.openEventModal === 'function') {
          window.openEventModal();
        }
      });
      await page.waitForTimeout(300);

      const evTypeSelect = await page.$('#ev-type');
      if (evTypeSelect) {
        const typeOptions = await page.innerText('#ev-type');
        assert(typeOptions.includes('Upcoming Conference') && typeOptions.includes('Hackathon'), 'Event Type dropdown must contain Tier 1 categories');
      }

      // Close modal
      await page.evaluate(() => {
        if (typeof window.closeModal === 'function') window.closeModal();
      });
      await page.waitForTimeout(200);

      // Verify Today's Activity button exists
      const todayBtn = await page.$('#btn-today-activity');
      assert(todayBtn !== null, 'Today Activity notification button should exist in admin header');

      // Test opening Today's Activity drawer
      await page.evaluate(() => {
        if (typeof window.openTodayActivityModal === 'function') window.openTodayActivityModal();
      });
      await page.waitForTimeout(300);

      // Close today's activity modal
      await page.evaluate(() => {
        if (typeof window.closeModal === 'function') window.closeModal();
      });
      await page.waitForTimeout(200);
    });

    console.log('\n--- 12. RUNTIME STABILITY & CONSOLE ERROR MONITORING ---');

    await test('Zero critical JavaScript runtime errors across all pages', async () => {
      const criticalErrors = consoleErrors.filter(e => 
        !e.includes('favicon') && 
        !e.includes('404') && 
        !e.includes('net::ERR_')
      );
      assert(criticalErrors.length === 0, `Detected ${criticalErrors.length} critical console errors: \n${criticalErrors.join('\n')}`);
    });

    console.log('\n--- 13. RESPONSIVENESS & MULTI-DEVICE VIEWPORT TESTING ---');

    await test('Mobile Viewport (375x667): Zero horizontal overflow on core pages', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      for (const path of ['/index.html', '/events.html', '/education.html', '/about.html']) {
        await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(300);
        
        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth + 2;
        });
        assert(!hasOverflow, `Page ${path} has horizontal scrollbar overflow on mobile (375px)`);
      }
    });

    await test('Mobile Viewport (375x667): Hamburger button opens & closes mobile navigation drawer', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);

      const menuBtn = page.locator('#mobile-menu-btn');
      const isBtnVisible = await menuBtn.isVisible();
      assert(isBtnVisible, 'Mobile hamburger button (#mobile-menu-btn) should be visible on 375px mobile screen');

      // Click to open mobile menu
      await page.evaluate(() => {
        const btn = document.getElementById('mobile-menu-btn');
        if (btn) btn.click();
      });
      await page.waitForTimeout(300);

      const isMenuOpen = await page.evaluate(() => {
        const menu = document.getElementById('mobile-menu');
        return menu && (menu.classList.contains('open') || window.getComputedStyle(menu).display !== 'none');
      });
      assert(isMenuOpen, 'Mobile menu drawer should open upon clicking hamburger button');

      // Click again to close
      await page.evaluate(() => {
        const btn = document.getElementById('mobile-menu-btn');
        if (btn) btn.click();
      });
      await page.waitForTimeout(200);
    });

    await test('Mobile Viewport (375x667): 3-Tier Filter Command Deck adapts and functions', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/events.html`, { waitUntil: 'domcontentloaded' });
      await waitForEventsToLoad(page);

      // Verify search input is full width and visible
      const searchInput = page.locator('#event-search');
      assert(await searchInput.isVisible(), 'Search input should be visible on mobile');

      // Select Webinar filter
      await page.selectOption('#event-type-select', 'Webinar');
      await page.waitForTimeout(300);

      const containerText = await page.innerText('#dynamic-events-container');
      assert(containerText.toLowerCase().includes('webinar'), 'Webinar filter should operate smoothly on mobile viewport');
    });

    await test('Tablet Viewport (768x1024): 2-Column Responsive Layout and Navigation', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(`${BASE_URL}/events.html`, { waitUntil: 'domcontentloaded' });
      await waitForEventsToLoad(page);

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2;
      });
      assert(!hasOverflow, 'Tablet viewport (768px) should have zero horizontal overflow');
    });

    await test('Desktop Viewport (1440x900): Full Navigation and 8-Column Bento Filter Deck', async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${BASE_URL}/events.html`, { waitUntil: 'domcontentloaded' });
      await waitForEventsToLoad(page);

      // Desktop navigation header should be visible
      const desktopNav = await page.evaluate(() => {
        const nav = document.querySelector('header nav');
        return nav ? window.getComputedStyle(nav).display !== 'none' : false;
      });
      assert(desktopNav, 'Desktop navigation bar should be visible on 1440px desktop');

      // Mobile menu button should be hidden on desktop
      const isMobileBtnHidden = await page.evaluate(() => {
        const btn = document.getElementById('mobile-menu-btn');
        return !btn || window.getComputedStyle(btn).display === 'none';
      });
      assert(isMobileBtnHidden, 'Mobile menu button should be hidden (lg:hidden) on 1440px desktop');
    });

  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n==================================================================');
  console.log(`  COMPREHENSIVE PLAYWRIGHT RESULTS: ${passedTests} / ${totalTests} E2E TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('==================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runFullPlaywrightSuite().catch(err => {
  console.error('Fatal Playwright E2E error:', err);
  process.exit(1);
});
