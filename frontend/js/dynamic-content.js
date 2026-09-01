/**
 * Shazu Soft Technologies - Dynamic Content Engine & Telemetry Integration
 */

(function () {
  const API_BASE = (window.ENV && window.ENV.API_BASE) || '';

  // Client-side Input Validation Helpers
  window.isValidEmail = function (email) {
    if (!email || typeof email !== 'string') return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
  };

  window.isValidPhone = function (phone) {
    if (!phone || String(phone).trim() === '') return true;
    const clean = String(phone).trim().replace(/[\s\-\(\)\+]/g, '');
    return /^\d{7,15}$/.test(clean);
  };

  window.quickFillToken = function (prefix) {
    const input = document.getElementById('track-token-input') || document.getElementById('quick-track-input');
    if (input) {
      input.value = prefix;
      input.focus();
    }
  };



  // 1. Telemetry / Analytics Tracker (Mobile, Tablet, Desktop)
  function trackPageView() {
    try {
      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
      const device = isMobile ? 'Mobile' : (isTablet ? 'Tablet' : 'Desktop');
      const pagePath = window.location.pathname ? window.location.pathname.replace(/^\/+/, '') : 'index.html';

      fetch(`${API_BASE}/api/public/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_path: pagePath || 'index.html',
          device_type: device,
          referrer: document.referrer || 'Direct'
        })
      }).catch(() => {});
    } catch (e) {}
  }

  // Helper for standardized announcement badge colors
  function getAnnouncementBadgeClass(badgeType) {
    const type = (badgeType || 'ANNOUNCEMENT').toUpperCase().trim();
    switch (type) {
      case 'NEW':
      case 'FEATURE':
        return 'bg-[#C47D4C] text-white'; // Orange accent
      case 'ANNOUNCEMENT':
      case 'NOTICE':
        return 'bg-[#2F5B4E] text-white'; // Deep green
      case 'UPDATE':
      case 'EVENT':
        return 'bg-teal-600 text-white'; // Teal
      case 'IMPORTANT':
      case 'URGENT':
        return 'bg-rose-600 text-white'; // Crimson
      default:
        return 'bg-[#2F5B4E] text-white';
    }
  }

  // 2. Load Dynamic Announcements Top Bar (Continuous Smooth Moving Ticker / Marquee)
  window.allAnnouncementsList = [];
  async function loadAnnouncements() {
    const container = document.getElementById('dynamic-announcement-bar');
    if (!container) return;

    // Clean up any old floating trigger if present
    const oldPill = document.getElementById('announcement-floating-trigger');
    if (oldPill) oldPill.remove();

    let announcements = [];

    try {
      const res = await fetch(`${API_BASE}/api/public/announcements`);
      if (res.ok) {
        const data = await res.json();
        if (data.announcements && data.announcements.length > 0) {
          announcements = data.announcements;
        }
      }
    } catch (err) {
      console.warn('Could not fetch dynamic announcements:', err);
    }

    if (!announcements || announcements.length === 0) {
      window.allAnnouncementsList = [];
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    window.allAnnouncementsList = announcements;

    container.className = 'w-full relative z-30 bg-[#123B32] text-white border-b border-[#527A68]/40 py-1.5 sm:py-2 px-2 sm:px-6 shadow-xs transition-all overflow-hidden';
    container.style.display = 'block';

    const buildItemsHtml = (list) => list.map(ann => {
      const badgeLabel = (ann.badge_type || 'ANNOUNCEMENT').toUpperCase().trim();
      const badgeClass = getAnnouncementBadgeClass(badgeLabel);
      return `
        <div class="inline-flex items-center gap-2 text-xs font-medium text-white shrink-0">
          <span class="px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${badgeClass} shrink-0 flex items-center gap-1 shadow-xs">
            <i class="bi bi-megaphone-fill text-[8px]"></i> ${badgeLabel}
          </span>
          <span class="font-bold text-white whitespace-nowrap text-xs">${ann.title}:</span>
          <span class="text-emerald-100 text-xs whitespace-nowrap">${ann.content}</span>
          ${ann.link_url ? `
            <a href="${ann.link_url}" class="text-[11px] font-bold text-amber-300 hover:text-white underline transition-colors flex items-center gap-0.5 ml-1">
              <span>Learn More</span>
              <i class="bi bi-arrow-right text-[10px]"></i>
            </a>
          ` : ''}
          <span class="text-emerald-400/50 select-none px-3">•</span>
        </div>
      `;
    }).join('');

    const trackContent = buildItemsHtml(announcements);

    container.innerHTML = `
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3 text-xs">
        <!-- Live Indicator Badge (Pinned Left) -->
        <div class="flex items-center gap-1.5 sm:gap-2 shrink-0 bg-[#0d2a24] py-1 px-2 sm:px-2.5 rounded-lg border border-[#527A68]/50 shadow-xs z-10">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span class="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1 select-none whitespace-nowrap">
            <span>Live</span><span class="hidden xs:inline">Updates</span>
          </span>
        </div>

        <!-- Continuous Moving Marquee Scroller -->
        <div class="flex-1 min-w-0 overflow-hidden relative cursor-pointer py-0.5 marquee-mask" title="Hover / tap to pause ticker">
          <div class="animate-marquee-track flex items-center whitespace-nowrap">
            <div class="flex items-center shrink-0">
              ${trackContent}
            </div>
            <div class="flex items-center shrink-0" aria-hidden="true">
              ${trackContent}
            </div>
          </div>
        </div>

        <!-- All Announcements Link (Pinned Right - Visible on Mobile & Desktop) -->
        <div class="flex items-center gap-1 sm:gap-2 shrink-0 z-10 pl-1 sm:pl-2">
          <a href="announcements.html" class="text-[10px] sm:text-[11px] font-semibold text-emerald-200 hover:text-white transition-colors bg-[#0d2a24]/90 hover:bg-[#0d2a24] px-2 sm:px-2.5 py-1 rounded-lg border border-[#527A68]/40 flex items-center gap-1 shadow-xs whitespace-nowrap" title="View all announcements">
            <span class="hidden sm:inline">All Notices (${announcements.length})</span>
            <span class="sm:hidden flex items-center gap-0.5 font-bold">View All <i class="bi bi-arrow-right text-[9px]"></i></span>
            <i class="hidden sm:inline-block bi bi-arrow-right text-[10px]"></i>
          </a>
        </div>
      </div>
    `;
  }

  function renderAnnouncementsPageSkeleton(container) {
    if (!container) return;
    container.innerHTML = Array.from({ length: 3 }).map(() => `
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs animate-pulse space-y-3">
        <div class="flex items-center justify-between">
          <div class="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
          <div class="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded"></div>
        </div>
        <div class="h-5 w-2/3 bg-slate-200 dark:bg-slate-800 rounded"></div>
        <div class="h-3.5 w-full bg-slate-200 dark:bg-slate-800 rounded"></div>
      </div>
    `).join('');
  }

  // 2b. Dedicated Announcements Inside Page Loader
  async function loadAnnouncementsPage() {
    const container = document.getElementById('dynamic-all-announcements-container');
    if (!container) return;

    renderAnnouncementsPageSkeleton(container);

    try {
      const res = await fetch(`${API_BASE}/api/public/announcements`);
      const data = await res.json();
      window.allAnnouncementsPageList = data.announcements || [];
      renderAnnouncementsPageList(window.allAnnouncementsPageList);
    } catch (err) {
      console.warn('Could not load announcements page list:', err);
      container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-400 text-xs">Could not load announcements at this moment.</div>`;
    }
  }

  function renderAnnouncementsPageList(list) {
    const container = document.getElementById('dynamic-all-announcements-container');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
          <i class="bi bi-inbox text-3xl mb-2 block"></i>
          <p class="text-xs font-semibold">No announcements found in this category.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(a => `
      <article data-aos="fade-up" class="bg-white dark:bg-slate-900 border border-[#D3DDD7] dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group">
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <span class="px-3 py-0.5 rounded-full bg-[#123B32] text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
              ${a.badge_type || 'Notice'}
            </span>
            <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              ${a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Official'}
            </span>
          </div>

          ${a.image_url ? `
            <div class="w-full h-44 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 my-2">
              <img loading="lazy" decoding="async" src="${a.image_url}" alt="${a.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
            </div>
          ` : ''}

          <h3 class="text-base font-extrabold text-[#0F172A] dark:text-white font-heading leading-snug">
            ${a.title}
          </h3>

          <p class="text-xs text-[#334E43] dark:text-slate-300 leading-relaxed">
            ${a.content}
          </p>
        </div>

        <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span class="text-[11px] font-mono text-slate-400">#Notice-${a.id || 1}</span>
          ${a.link_url ? `
            <a href="${a.link_url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs font-bold text-[#123B32] dark:text-emerald-400 hover:text-[#C47D4C] transition-colors">
              <span>View Details</span>
              <i class="bi bi-box-arrow-up-right text-[11px]"></i>
            </a>
          ` : `
            <a href="contact.html" class="inline-flex items-center gap-1 text-xs font-bold text-[#123B32] dark:text-emerald-400 hover:underline">
              <span>Inquire</span>
              <i class="bi bi-arrow-right"></i>
            </a>
          `}
        </div>
      </article>
    `).join('');
  }

  window.filterAnnouncements = function (badgeType, btnElement) {
    const list = window.allAnnouncementsPageList || [];
    const buttons = document.querySelectorAll('#announcement-filter-buttons button');
    buttons.forEach(b => b.classList.remove('active'));
    if (btnElement) {
      btnElement.classList.add('active');
    }

    if (badgeType === 'all') {
      renderAnnouncementsPageList(list);
    } else {
      const filtered = list.filter(a => (a.badge_type || '').toUpperCase() === badgeType.toUpperCase());
      renderAnnouncementsPageList(filtered);
    }
  };

  // 3. Load Dynamic Careers Listing
  const DEFAULT_SAMPLE_CAREERS = [];

  function renderCareers(jobs) {
    const container = document.getElementById('dynamic-careers-container') || document.getElementById('dynamic-jobs-container');
    if (!container) return;

    if (!jobs || jobs.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center p-12 bg-white dark:bg-[#1e293b] rounded-2xl border border-brand-border dark:border-[#334155] space-y-3">
          <div class="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-2xl">
            <i class="bi bi-briefcase"></i>
          </div>
          <h4 class="text-base font-bold text-brand-darkText dark:text-white">No Open Positions At The Moment</h4>
          <p class="text-xs text-brand-secText dark:text-slate-400 max-w-sm mx-auto">Please check back soon or submit your general resume for upcoming opportunities.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = jobs.map(job => {
      const skills = (job.requirements || '').split(',').map(s => s.trim()).filter(Boolean);
      const salary = job.salary_range ? job.salary_range : '';
      const jobType = job.job_type ? job.job_type : 'Full-time';
      const location = job.location || 'Salem, TN';

      return `
        <div class="bg-white dark:bg-[#1e293b] border border-brand-border dark:border-[#334155] rounded-3xl p-6 sm:p-7 shadow-sm hover-lift flex flex-col justify-between transition-all group">
          <div class="space-y-4">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="px-3 py-1 bg-[#E8EFEB] dark:bg-emerald-950/60 text-brand-green dark:text-emerald-400 font-bold text-[11px] rounded-full uppercase tracking-wider">
                ${job.department || 'Software Engineering'}
              </span>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-[11px] rounded-md">
                  ${jobType}
                </span>
              </div>
            </div>

            <div>
              <h3 onclick="openJobDetailsModal('${job.id}')" class="text-lg font-bold font-heading text-brand-darkText dark:text-white hover:text-brand-green dark:hover:text-emerald-400 cursor-pointer transition-colors leading-snug">
                ${job.title}
              </h3>
              <div class="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span class="font-medium flex items-center gap-1">
                  <i class="bi bi-geo-alt-fill text-brand-green"></i> ${location}
                </span>
                ${salary ? `
                  <span class="font-bold text-amber-700 dark:text-amber-400 font-mono flex items-center gap-1">
                    <i class="bi bi-cash-stack"></i> ${salary}
                  </span>
                ` : ''}
              </div>
              <p class="text-xs text-brand-secText dark:text-slate-400 mt-2.5 leading-relaxed line-clamp-3">
                ${job.description || ''}
              </p>
            </div>

            ${skills.length > 0 ? `
              <div class="flex flex-wrap gap-1.5 pt-1">
                ${skills.map(s => `<span class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-semibold">${s}</span>`).join('')}
              </div>
            ` : ''}
          </div>

          <div class="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
            <button type="button" onclick="openJobDetailsModal('${job.id}')" class="w-full py-2.5 bg-slate-100 hover:bg-[#E8EFEB] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#123B32] dark:text-emerald-400 font-bold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer">
              <i class="bi bi-eye text-xs"></i>
              <span>View Full Details</span>
            </button>
            <button type="button" onclick="openApplyModal('${job.id}', '${encodeURIComponent(job.title)}')" class="w-full py-2.5 bg-[#123B32] hover:bg-[#C47D4C] text-white font-bold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-xs hover:shadow-md cursor-pointer">
              <i class="bi bi-file-earmark-person text-xs"></i>
              <span>Apply For Position</span>
              <i class="bi bi-arrow-right text-xs group-hover:translate-x-0.5 transition-transform"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderCareersSkeleton(container) {
    if (!container) return;
    container.innerHTML = Array.from({ length: 3 }).map(() => `
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs animate-pulse flex flex-col justify-between space-y-4">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="h-6 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
            <div class="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
          </div>
          <div class="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          <div class="space-y-2 pt-1">
            <div class="h-3.5 w-full bg-slate-200 dark:bg-slate-800 rounded"></div>
            <div class="h-3.5 w-4/5 bg-slate-200 dark:bg-slate-800 rounded"></div>
          </div>
        </div>
        <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div class="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          <div class="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    `).join('');
  }

  async function loadCareers() {
    const container = document.getElementById('dynamic-careers-container') || document.getElementById('dynamic-jobs-container');
    if (!container) return;

    renderCareersSkeleton(container);

    try {
      const res = await fetch(`${API_BASE}/api/public/careers`);
      const data = await res.json();
      const jobs = data.jobs || [];
      window.allCareersData = jobs;
      renderCareers(jobs);
    } catch (err) {
      console.warn('Could not fetch careers from DB:', err);
      window.allCareersData = [];
      renderCareers([]);
    }
  }

  // 4. Load Dynamic Events & Courses Listing
  function renderEventsSkeleton(container) {
    if (!container) return;
    container.innerHTML = Array.from({ length: 3 }).map(() => `
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs animate-pulse flex flex-col justify-between space-y-4">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
            <div class="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
          </div>
          <div class="h-6 w-4/5 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          <div class="space-y-2">
            <div class="h-3.5 w-full bg-slate-200 dark:bg-slate-800 rounded"></div>
            <div class="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
          </div>
          <div class="flex items-center gap-3 pt-2">
            <div class="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded"></div>
            <div class="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded"></div>
          </div>
        </div>
        <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div class="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          <div class="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    `).join('');
  }

  async function loadEvents() {
    const container = document.getElementById('dynamic-events-container');
    if (!container) return;

    renderEventsSkeleton(container);

    try {
      const [evRes, courseRes] = await Promise.all([
        fetch(`${API_BASE}/api/public/events`).then(r => r.json()).catch(() => ({ events: [] })),
        fetch(`${API_BASE}/api/public/courses-services`).then(r => r.json()).catch(() => ({ offerings: [], courses: [] }))
      ]);

      const courseList = (courseRes && (courseRes.courses || courseRes.offerings)) || [];
      const coursesAsEvents = courseList.map(c => ({
        id: `course-${c.id}`,
        is_course: true,
        title: c.title,
        category: `Courses & Training | ${c.category || 'Professional Course'}`,
        description: c.description || '',
        event_date: c.duration ? `Duration: ${c.duration}` : 'Flexible Cohort Batch',
        location: c.mode || 'Online / Hybrid Hands-on',
        registration_fee: c.pricing || 'Contact for Fee',
        image_url: c.image_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
        status: c.status || 'Upcoming'
      }));

      const rawEvents = (evRes && evRes.events) || [];
      window.allEventsData = [...rawEvents, ...coursesAsEvents];
      if (typeof window.handleEventTypeUrlParam === 'function') window.handleEventTypeUrlParam();
      window.applyEventFilters();
      if (typeof window.handleSharedEventParam === 'function') window.handleSharedEventParam();
    } catch (err) {
      console.warn('Could not fetch events/courses from DB:', err);
      window.allEventsData = [];
      if (typeof window.handleEventTypeUrlParam === 'function') window.handleEventTypeUrlParam();
      window.applyEventFilters();
    }
  }

  window.eventFilterState = window.eventFilterState || { type: 'all', search: '', status: 'all', field: 'all' };

  window.handleEventTypeUrlParam = function() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const rawType = urlParams.get('type') || urlParams.get('category');
      if (!rawType) return;

      const t = rawType.toLowerCase().trim();
      let targetType = 'all';
      if (t.includes('conf') || t.includes('sympos')) targetType = 'Upcoming Conference';
      else if (t.includes('hack') || t.includes('contest')) targetType = 'Hackathon';
      else if (t.includes('fdp') || t.includes('faculty') || t.includes('seminar')) targetType = 'Faculty Development Program';
      else if (t.includes('course') || t.includes('train')) targetType = 'Courses & Training';
      else if (t.includes('intern')) targetType = 'Internship';
      else if (t.includes('webinar')) targetType = 'Webinar';
      else targetType = rawType;

      window.eventFilterState = window.eventFilterState || { type: 'all', search: '', status: 'all', field: 'all' };
      window.eventFilterState.type = targetType;

      const select = document.getElementById('event-type-select');
      if (select) select.value = targetType;

      const tabs = document.querySelectorAll('.event-quick-tab');
      tabs.forEach(b => {
        const onclickAttr = b.getAttribute('onclick') || '';
        if (
          onclickAttr.toLowerCase().includes(targetType.toLowerCase()) || 
          (targetType === 'Upcoming Conference' && onclickAttr.toLowerCase().includes('upcoming conference')) ||
          (targetType === 'Hackathon' && onclickAttr.toLowerCase().includes('hackathon')) ||
          (targetType === 'Faculty Development Program' && onclickAttr.toLowerCase().includes('faculty')) ||
          (targetType === 'Courses & Training' && onclickAttr.toLowerCase().includes('courses'))
        ) {
          b.className = 'event-quick-tab shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-[#123B32] text-white dark:bg-emerald-600 shadow-xs cursor-pointer transition-all flex items-center gap-1.5';
        } else {
          b.className = 'event-quick-tab shrink-0 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-[#123B32] hover:text-white dark:hover:bg-emerald-600 transition-all cursor-pointer flex items-center gap-1.5';
        }
      });
    } catch (e) {
      console.warn('Type parameter handler note:', e);
    }
  };

  window.selectEventCategoryQuick = function(type, btnEl) {
    window.eventFilterState = window.eventFilterState || { type: 'all', search: '', status: 'all', field: 'all' };
    window.eventFilterState.type = type;
    const select = document.getElementById('event-type-select');
    if (select) select.value = type;

    document.querySelectorAll('.event-quick-tab').forEach(b => {
      b.className = 'event-quick-tab shrink-0 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-[#123B32] hover:text-white dark:hover:bg-emerald-600 transition-all cursor-pointer flex items-center gap-1.5';
    });
    if (btnEl) {
      btnEl.className = 'event-quick-tab shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-[#123B32] text-white dark:bg-emerald-600 shadow-xs cursor-pointer transition-all flex items-center gap-1.5';
    }

    // Update URL query string without reloading page
    try {
      const url = new URL(window.location);
      if (type === 'all') {
        url.searchParams.delete('type');
        url.searchParams.delete('category');
      } else {
        let typeSlug = 'all';
        if (type.includes('Conference')) typeSlug = 'conference';
        else if (type.includes('Hackathon')) typeSlug = 'hackathon';
        else if (type.includes('Faculty')) typeSlug = 'fdp';
        else if (type.includes('Course')) typeSlug = 'courses';
        else typeSlug = type.toLowerCase();
        url.searchParams.set('type', typeSlug);
      }
      window.history.pushState({}, '', url);
    } catch (err) {}

    window.applyEventFilters();
  };

  // Listen for SPA navigation or in-page dropdown clicks
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if ((href.includes('events.html?') || href.includes('events?')) && document.getElementById('dynamic-events-container')) {
      try {
        const targetUrl = new URL(a.href, window.location.origin);
        const typeParam = targetUrl.searchParams.get('type') || targetUrl.searchParams.get('category');
        if (typeParam) {
          e.preventDefault();
          window.history.pushState({}, '', a.href);
          window.handleEventTypeUrlParam();
          window.applyEventFilters();
          const filterHeader = document.getElementById('event-type-select');
          if (filterHeader) {
            filterHeader.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      } catch (err) {}
    }
  });

  window.addEventListener('popstate', () => {
    if (document.getElementById('dynamic-events-container')) {
      window.handleEventTypeUrlParam();
      window.applyEventFilters();
    }
  });

  window.applyEventFilters = function () {
    if (!window.allEventsData) return;
    window.eventFilterState = window.eventFilterState || { type: 'all', search: '', status: 'all', field: 'all' };
    const { type, search, status, field } = window.eventFilterState;
    const q = (search || '').toLowerCase().trim();

    const filtered = window.allEventsData.filter(ev => {
      const title = (ev.title || '').toLowerCase();
      const cat = (ev.category || '').toLowerCase();
      const loc = (ev.location || '').toLowerCase();
      const desc = (ev.description || '').toLowerCase();
      const evStatus = (ev.status || 'Upcoming').toLowerCase();
      const combined = `${title} ${cat} ${loc} ${desc}`;

      // 1. Search Query
      if (q && !combined.includes(q)) {
        return false;
      }

      // 2. Event Type & Courses Filter (Tier 1)
      if (type && type !== 'all') {
        const t = type.toLowerCase();
        let matches = false;
        if ((t.includes('course') || t.includes('professional training')) && (combined.includes('course') || combined.includes('training') || ev.is_course)) matches = true;
        else if (t.includes('conference') && combined.includes('conference')) matches = true;
        else if ((t.includes('faculty') || t.includes('fdp')) && (combined.includes('faculty') || combined.includes('fdp'))) matches = true;
        else if (t.includes('webinar') && combined.includes('webinar')) matches = true;
        else if ((t.includes('training') || t.includes('hands')) && (combined.includes('hands on') || combined.includes('hands-on') || combined.includes('training') || combined.includes('workshop'))) matches = true;
        else if (t.includes('internship') && combined.includes('internship')) matches = true;
        else if ((t.includes('hackathon') || t.includes('contest')) && (combined.includes('hackathon') || combined.includes('contest'))) matches = true;
        else if (t.includes('seminar') && (combined.includes('seminar') || combined.includes('colloquium'))) matches = true;
        else if (combined.includes(t)) matches = true;
        
        if (!matches) return false;
      }

      // 3. Status Filter (Tier 2)
      if (status && status !== 'all') {
        const s = status.toLowerCase();
        if (s === 'upcoming' && !(evStatus === 'upcoming' || evStatus === 'active' || evStatus === 'open')) return false;
        if (s === 'past' && !(evStatus === 'past' || evStatus === 'completed' || evStatus === 'closed')) return false;
      }

      // 4. Field / Domain Filter (Tier 3)
      if (field && field !== 'all') {
        const f = field.toLowerCase();
        let matchesField = false;
        if (f.includes('engineering') && (combined.includes('engineer') || combined.includes('tech') || combined.includes('software') || combined.includes('computing') || combined.includes('ai') || combined.includes('data') || combined.includes('code'))) matchesField = true;
        else if (f.includes('medical') && (combined.includes('medical') || combined.includes('life science') || combined.includes('clinical') || combined.includes('health') || combined.includes('biomedical'))) matchesField = true;
        else if (f.includes('business') && (combined.includes('business') || combined.includes('management') || combined.includes('enterprise') || combined.includes('startup') || combined.includes('msme') || combined.includes('finance'))) matchesField = true;
        else if (f.includes('education') && (combined.includes('education') || combined.includes('humanities') || combined.includes('faculty') || combined.includes('pedagogy') || combined.includes('academic') || combined.includes('curriculum'))) matchesField = true;
        else if (combined.includes(f)) matchesField = true;
        
        if (!matchesField) return false;
      }

      return true;
    });

    renderEventsList(filtered);
  };

  window.toggleEventDescription = function (eventId) {
    const descEl = document.getElementById(`event-desc-${eventId}`);
    const btnEl = document.getElementById(`event-desc-btn-${eventId}`);
    if (!descEl || !btnEl) return;

    const isClamped = descEl.classList.contains('line-clamp-2');
    if (isClamped) {
      descEl.classList.remove('line-clamp-2');
      btnEl.innerHTML = `<span>Show less</span> <i class="bi bi-chevron-up text-[9px]"></i>`;
    } else {
      descEl.classList.add('line-clamp-2');
      btnEl.innerHTML = `<span>Read more</span> <i class="bi bi-chevron-down text-[9px]"></i>`;
    }
  };

  window.scrollToEventCard = function (cardId, dotIdx) {
    const card = document.getElementById(cardId);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      document.querySelectorAll('.event-pagination-dot').forEach((dot, i) => {
        if (i === dotIdx) {
          dot.className = 'event-pagination-dot w-7 bg-[#123B32] dark:bg-emerald-400 h-2 rounded-full transition-all duration-300 cursor-pointer';
        } else {
          dot.className = 'event-pagination-dot w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 h-2 rounded-full transition-all duration-300 cursor-pointer';
        }
      });
    }
  };

  window.renderEventsList = function (eventsList) {
    const container = document.getElementById('dynamic-events-container');
    if (!container) return;

    if (!eventsList || eventsList.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div class="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-2xl">
            <i class="bi bi-calendar-x"></i>
          </div>
          <h4 class="text-base font-bold text-slate-800 dark:text-white">No Matching Events Found</h4>
          <p class="text-xs text-slate-500 max-w-sm mx-auto">Try adjusting your search query or selecting a different event category filter.</p>
        </div>
      `;
      const existingPagination = document.getElementById('events-carousel-pagination');
      if (existingPagination) existingPagination.innerHTML = '';
      return;
    }

    container.innerHTML = eventsList.map(ev => {
      const fee = ev.registration_fee || 'Free';
      const isPaid = fee !== 'Free' && fee !== '0' && fee !== '' && !String(fee).toLowerCase().includes('free');
      const defaultImg = ev.category && ev.category.toLowerCase().includes('hackathon') ? 
        'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80' : 
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80';
      const eventImg = ev.image_url || defaultImg;
      const categoryLabel = ev.category ? ev.category.split('|')[0].trim().toUpperCase() : 'EVENT';
      const hasLongDesc = ev.description && ev.description.length > 110;

      return `
        <div id="event-card-${ev.id}" data-event-id="${ev.id}" class="event-carousel-card bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
          
          <!-- Event Cover Image with Top Badges & Bottom-Left Date Badge -->
          <div class="h-44 w-full relative overflow-hidden bg-slate-100 dark:bg-slate-800">
            <img src="${eventImg}" alt="${ev.title}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            
            <!-- Top Badges: Aligned Category & Price Badges (Single Share Icon kept at CTA) -->
            <div class="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
              <span class="h-7 px-3 inline-flex items-center gap-1.5 bg-black/70 backdrop-blur-md text-white font-extrabold text-[10px] rounded-full uppercase tracking-wider border border-white/20 shadow-sm shrink-0">
                <i class="bi bi-tag-fill text-[9px] text-emerald-400"></i>${categoryLabel}
              </span>
              <span class="h-7 px-3 inline-flex items-center bg-emerald-600 ${isPaid ? 'bg-amber-600' : 'bg-emerald-600'} text-white font-bold text-xs rounded-full shadow-sm font-mono border border-white/20 shrink-0">
                ${fee}
              </span>
            </div>
            
            <!-- Date Badge: Fully Positioned on Image Bottom-Left with Clean Padding -->
            <div class="absolute bottom-3 left-3 z-10">
              <span class="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg bg-black/80 backdrop-blur-md text-white font-mono text-[11px] font-bold border border-white/15 shadow-sm">
                <i class="bi bi-calendar3 text-amber-300 text-xs"></i>
                <span>${ev.event_date || 'TBA'}</span>
              </span>
            </div>
          </div>

          <!-- Card Content Body -->
          <div class="p-5 sm:p-6 space-y-4 flex-1 flex flex-col justify-between">
            <div class="space-y-2.5">
              <!-- Title -->
              <h3 class="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white group-hover:text-[#123B32] dark:group-hover:text-emerald-400 transition-colors leading-snug">
                ${ev.title}
              </h3>

              <!-- Venue Details -->
              <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <i class="bi bi-geo-alt-fill text-[#123B32] dark:text-emerald-400 text-xs shrink-0"></i>
                <span class="truncate">${ev.location || 'Salem, Tamil Nadu'}</span>
              </div>

              <!-- Description with Read More Toggle -->
              <div class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                <p id="event-desc-${ev.id}" class="line-clamp-2 transition-all">
                  ${ev.description || 'Join us for this comprehensive technical session and professional networking event.'}
                </p>
                ${hasLongDesc ? `
                  <button type="button" onclick="toggleEventDescription('${ev.id}')" id="event-desc-btn-${ev.id}" class="text-[11px] font-bold text-[#123B32] dark:text-emerald-400 hover:underline inline-flex items-center gap-1 mt-1 cursor-pointer">
                    <span>Read more</span> <i class="bi bi-chevron-down text-[9px]"></i>
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- Action Buttons: Register CTA & Accessible Share Button -->
            <div class="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <button onclick="openRegisterModal('${ev.id}', '${encodeURIComponent(ev.title)}', '${encodeURIComponent(fee)}')" class="flex-1 py-2.5 px-4 bg-[#123B32] hover:bg-[#C47D4C] text-white font-bold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer">
                <i class="bi bi-ticket-perforated text-sm"></i>
                <span>Register For Event</span>
                <i class="bi bi-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
              </button>
              <button type="button" onclick="openShareModal('${ev.id}')" class="w-10 h-10 bg-slate-100 hover:bg-[#E8EFEB] dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-[#123B32] dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/40 rounded-xl transition-all duration-200 flex items-center justify-center shadow-xs cursor-pointer shrink-0 group/share" title="Share Event" aria-label="Share Event">
                <i class="bi bi-share-fill text-xs group-hover/share:scale-110 transition-transform pointer-events-none"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Render Dot/Line Carousel Pagination Indicators
    let pagContainer = document.getElementById('events-carousel-pagination');
    if (!pagContainer && container.parentNode) {
      pagContainer = document.createElement('div');
      pagContainer.id = 'events-carousel-pagination';
      container.parentNode.appendChild(pagContainer);
    }

    if (pagContainer) {
      if (eventsList.length <= 1) {
        pagContainer.innerHTML = '';
      } else {
        pagContainer.innerHTML = `
          <div class="flex items-center justify-center gap-2 pt-6">
            ${eventsList.map((ev, idx) => `
              <button type="button" onclick="scrollToEventCard('event-card-${ev.id}', ${idx})" id="event-dot-${idx}" class="event-pagination-dot ${idx === 0 ? 'w-7 bg-[#123B32] dark:bg-emerald-400' : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'} h-2 rounded-full transition-all duration-300 cursor-pointer" aria-label="Go to event ${idx + 1}" title="Event ${idx + 1}"></button>
            `).join('')}
          </div>
        `;
      }
    }
  };

  // Base64 File Converter with 10 MB Limit Restriction
  window.convertFileToBase64 = function(file) {
    return new Promise((resolve, reject) => {
      const maxSizeBytes = 10 * 1024 * 1024; // 10 MB limit
      if (file.size > maxSizeBytes) {
        return reject(new Error('File size exceeds 10 MB limit. Please select a file smaller than 10 MB.'));
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  window.handlePublicResumeUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const base64Data = await window.convertFileToBase64(file);
      document.getElementById('pub-app-resume').value = base64Data;
      const preview = document.getElementById('pub-resume-preview');
      const filenameSpan = document.getElementById('pub-resume-filename');
      if (preview && filenameSpan) {
        filenameSpan.textContent = `Attached: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        preview.classList.remove('hidden');
      }
      if (window.toast) window.toast.success(`Attached ${file.name} successfully!`);
    } catch (err) {
      if (window.toast) window.toast.error(err.message);
      else alert(err.message);
      event.target.value = '';
    }
  };

  // ==========================================
  // 5. PUBLIC PHOTO GALLERY SHOWCASE & LIGHTBOX
  // ==========================================
  window.allGalleryData = [];
  window.activeGalleryCategory = 'all';

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function loadGalleryShowcase() {
    const container = document.getElementById('dynamic-gallery-container');
    const reel = document.getElementById('dynamic-gallery-reel');
    if (!container && !reel) return;

    try {
      const res = await fetch(`${API_BASE}/api/public/gallery`).then(r => r.json()).catch(() => ({ gallery: [] }));
      window.allGalleryData = res.gallery || [];
      renderGalleryShowcase();
    } catch (err) {
      console.warn('Could not load public gallery:', err);
    }
  }

  window.filterGalleryCategory = function(cat, btnElement) {
    window.activeGalleryCategory = cat;
    document.querySelectorAll('.gallery-category-pill').forEach(btn => {
      btn.className = 'gallery-category-pill px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#123B32] hover:text-white dark:hover:bg-emerald-600 transition-all cursor-pointer';
    });
    if (btnElement) {
      btnElement.className = 'gallery-category-pill px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#123B32] text-white dark:bg-emerald-600 shadow-sm cursor-pointer';
    }
    renderGalleryShowcase();
  };

  window.scrollGalleryReel = function(delta) {
    const reel = document.getElementById('dynamic-gallery-reel');
    if (reel) {
      reel.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  function renderGalleryShowcase() {
    const container = document.getElementById('dynamic-gallery-container');
    const reel = document.getElementById('dynamic-gallery-reel');
    if (!container && !reel) return;

    const allItems = window.allGalleryData || [];

    // 1. Populate Horizontal Highlights Reel Slider
    if (reel) {
      if (allItems.length === 0) {
        reel.innerHTML = `
          <div class="w-full py-10 text-center text-slate-400 bg-white/60 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <i class="bi bi-images text-3xl mb-2 block text-emerald-700/60 dark:text-emerald-400"></i>
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-400">No moments uploaded yet.</p>
          </div>
        `;
      } else {
        reel.innerHTML = allItems.map((item, idx) => {
          const safeTitle = escapeHtml(item.title || 'Event Highlight');
          const safeCategory = escapeHtml(item.category || 'HIGHLIGHT');
          const safeDesc = escapeHtml(item.description || '');
          const itemId = item.id != null ? item.id : idx;
          const imgSrc = item.image_blob || 'images/software.png';

          return `
            <div onclick="window.openGalleryLightboxById('${itemId}')" class="shrink-0 w-72 sm:w-80 md:w-84 bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 snap-start cursor-pointer flex flex-col justify-between group">
              <!-- Top Image Frame -->
              <div class="relative w-full aspect-[4/3] overflow-hidden bg-slate-950 flex items-center justify-center">
                <img src="${imgSrc}" alt="${safeTitle}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror="this.src='images/software.png'">
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                <div class="absolute top-3 left-3">
                  <span class="inline-flex items-center px-3 py-1 rounded-full bg-[#123B32] text-white dark:bg-emerald-600 font-extrabold text-[10px] uppercase tracking-wider shadow-md">
                    ${safeCategory}
                  </span>
                </div>
                <div class="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <i class="bi bi-arrows-fullscreen"></i>
                </div>
              </div>

              <!-- Bottom Text Details -->
              <div class="p-4 sm:p-5 flex flex-col justify-between grow space-y-3 bg-white dark:bg-slate-900">
                <div>
                  <h3 class="text-sm sm:text-base font-extrabold font-heading text-slate-900 dark:text-white group-hover:text-[#123B32] dark:group-hover:text-emerald-400 transition-colors line-clamp-1 leading-snug">
                    ${safeTitle}
                  </h3>
                  ${safeDesc ? `<p class="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed mt-1.5" title="${safeDesc}">${safeDesc}</p>` : ''}
                </div>
                <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#123B32] dark:text-emerald-400">
                  <span class="inline-flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                    <span>View Full Details & Photo</span>
                    <i class="bi bi-arrow-right"></i>
                  </span>
                  <span class="text-[10px] font-mono text-slate-400">HD Photo</span>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 2. Populate Grid
    if (!container) return;

    const cat = (window.activeGalleryCategory || 'all').toLowerCase();
    const items = allItems.filter(item => {
      if (cat === 'all') return true;
      const c = (item.category || '').toLowerCase();
      return c.includes(cat) || cat.includes(c);
    });

    if (items.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
          <i class="bi bi-images text-3xl block mb-2 text-emerald-700/60 dark:text-emerald-400"></i>
          No media found in this category.
        </div>
      `;
      return;
    }

    container.innerHTML = items.map((item, idx) => {
      const safeTitle = escapeHtml(item.title || 'Gallery Photo');
      const safeCategory = escapeHtml(item.category || 'EVENT');
      const safeDesc = escapeHtml(item.description || '');
      const itemId = item.id != null ? item.id : idx;
      const imgSrc = item.image_blob || 'images/software.png';

      return `
        <div onclick="window.openGalleryLightboxById('${itemId}')" class="group bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer flex flex-col justify-between">
          <!-- Top Image Frame -->
          <div class="relative w-full aspect-[4/3] overflow-hidden bg-slate-950 flex items-center justify-center">
            <img src="${imgSrc}" alt="${safeTitle}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror="this.src='images/software.png'">
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
            <div class="absolute top-3 left-3">
              <span class="inline-flex items-center px-3 py-1 rounded-full bg-[#123B32] text-white dark:bg-emerald-600 font-extrabold text-[10px] uppercase tracking-wider shadow-md">
                ${safeCategory}
              </span>
            </div>
            <div class="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
              <i class="bi bi-arrows-fullscreen"></i>
            </div>
          </div>

          <!-- Bottom Content Box -->
          <div class="p-4 sm:p-5 flex flex-col justify-between grow space-y-3 bg-white dark:bg-slate-900">
            <div>
              <h3 class="text-sm sm:text-base font-extrabold font-heading text-slate-900 dark:text-white group-hover:text-[#123B32] dark:group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
                ${safeTitle}
              </h3>
              ${safeDesc ? `<p class="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed mt-1.5" title="${safeDesc}">${safeDesc}</p>` : ''}
            </div>

            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#123B32] dark:text-emerald-400">
              <span class="inline-flex items-center gap-1.5 text-xs group-hover:translate-x-1 transition-transform">
                <span>View Full Details & Photo</span>
                <i class="bi bi-arrow-right"></i>
              </span>
              <span class="text-[10px] font-mono text-slate-400 uppercase">Gallery</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.openGalleryLightboxById = function(itemId) {
    const item = (window.allGalleryData || []).find((i, idx) => String(i.id) === String(itemId) || String(idx) === String(itemId));
    if (item) {
      window.renderGalleryLightboxModal(item);
    }
  };

  window.openGalleryLightbox = function(arg1, arg2, arg3, arg4) {
    if (arg2 === undefined) {
      if (typeof arg1 === 'object' && arg1 !== null) {
        window.renderGalleryLightboxModal(arg1);
      } else {
        window.openGalleryLightboxById(arg1);
      }
      return;
    }
    try {
      const img = arg1 ? (arg1.includes('%') ? decodeURIComponent(arg1) : arg1) : '';
      const title = arg2 ? (arg2.includes('%') ? decodeURIComponent(arg2) : arg2) : '';
      const cat = arg3 ? (arg3.includes('%') ? decodeURIComponent(arg3) : arg3) : '';
      const desc = arg4 ? (arg4.includes('%') ? decodeURIComponent(arg4) : arg4) : '';
      window.renderGalleryLightboxModal({ image_blob: img, title, category: cat, description: desc });
    } catch (e) {
      window.renderGalleryLightboxModal({ image_blob: arg1, title: arg2, category: arg3, description: arg4 });
    }
  };

  window.renderGalleryLightboxModal = function(item) {
    const oldModal = document.getElementById('gallery-lightbox-modal');
    if (oldModal) oldModal.remove();

    const imgSrc = item.image_blob || 'images/software.png';
    const safeTitle = escapeHtml(item.title || 'Event Photograph');
    const safeCat = escapeHtml(item.category || 'EVENT');
    const rawDesc = item.description || '';
    const safeDesc = escapeHtml(rawDesc);
    const dateFormatted = item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

    const modalHtml = `
      <div id="gallery-lightbox-modal" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in" onclick="if(event.target === this) window.closeGalleryLightbox()" role="dialog" aria-modal="true">
        <div class="relative max-w-5xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh] text-slate-900 dark:text-white">
          
          <!-- Close 'X' Button -->
          <button onclick="window.closeGalleryLightbox()" class="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-sm transition-all cursor-pointer shadow-md border border-white/20" aria-label="Close Preview" title="Close (Esc)">
            <i class="bi bi-x-lg"></i>
          </button>

          <!-- Left Column / Photo Viewer Canvas (Responsive Height on Mobile & Desktop) -->
          <div class="w-full md:w-[58%] bg-slate-950 flex items-center justify-center p-4 sm:p-6 min-h-[280px] max-h-[46vh] md:max-h-[85vh] relative select-none">
            <img src="${imgSrc}" alt="${safeTitle}" class="max-w-full max-h-[44vh] md:max-h-[78vh] w-auto h-auto object-contain rounded-xl shadow-2xl">
            <div class="absolute bottom-3 left-3">
              <span class="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-white font-mono text-[10px] font-bold">HD ORIGINAL</span>
            </div>
          </div>

          <!-- Right Column / Information & Full Description Details (Scrollable & Responsive) -->
          <div class="w-full md:w-[42%] p-5 sm:p-7 bg-[#FDFCFA] dark:bg-slate-900 flex flex-col justify-between overflow-y-auto max-h-[44vh] md:max-h-[85vh] border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 space-y-4">
            
            <div class="space-y-3">
              <!-- Category & Date Header Badges -->
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-3 py-1 rounded-full bg-[#123B32] text-white dark:bg-emerald-600 font-extrabold text-[10px] uppercase tracking-wider shadow-xs">
                  ${safeCat}
                </span>
                ${dateFormatted ? `
                  <span class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                    <i class="bi bi-calendar3 text-[#123B32] dark:text-emerald-400"></i> ${dateFormatted}
                  </span>
                ` : ''}
              </div>

              <!-- Title -->
              <h2 class="text-lg sm:text-xl md:text-2xl font-black font-heading text-slate-900 dark:text-white leading-tight">
                ${safeTitle}
              </h2>

              <!-- Full Description Content Box -->
              <div class="bg-white dark:bg-slate-950/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-1.5">
                <h4 class="text-[11px] font-bold uppercase tracking-wider text-[#123B32] dark:text-emerald-400 flex items-center gap-1.5">
                  <i class="bi bi-card-text"></i> Full Description & Details
                </h4>
                ${safeDesc ? `
                  <p class="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line max-h-52 overflow-y-auto pr-1">
                    ${safeDesc}
                  </p>
                ` : `
                  <p class="text-xs text-slate-400 italic">No extended notes available for this photograph.</p>
                `}
              </div>
            </div>

            <!-- Footer Action Buttons -->
            <div class="pt-2 flex items-center gap-2.5">
              <a href="${imgSrc}" download="${safeTitle.replace(/[^a-zA-Z0-9]/g, '_')}.jpg" target="_blank" rel="noopener noreferrer" class="flex-1 py-2.5 px-4 bg-[#123B32] hover:bg-[#2F5B4E] text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer">
                <i class="bi bi-download text-sm"></i>
                <span>Download Photo</span>
              </a>
              <button type="button" onclick="window.closeGalleryLightbox()" class="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer">
                Close
              </button>
            </div>

          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.body.style.overflow = 'hidden';

    // Handle Escape key
    const escHandler = function(e) {
      if (e.key === 'Escape') {
        window.closeGalleryLightbox();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  };

  window.closeGalleryLightbox = function() {
    const modal = document.getElementById('gallery-lightbox-modal');
    if (modal) modal.remove();
    document.body.style.overflow = '';
  };

  // 6. Global Modal Helpers for Job Details, Apply & Event Register
  window.openJobDetailsModal = async function(jobId) {
    let job = (window.allCareersData || []).find(j => String(j.id) === String(jobId));
    if (!job) {
      try {
        const res = await fetch(`${API_BASE}/api/public/careers`);
        if (res.ok) {
          const list = await res.json();
          window.allCareersData = list;
          job = (list || []).find(j => String(j.id) === String(jobId));
        }
      } catch (e) {
        console.warn('Failed to fetch job details:', e);
      }
    }
    if (!job) {
      if (window.toast) window.toast.error('Job opening details not found');
      else alert('Job opening details not found');
      return;
    }

    window.closePublicModal();
    document.body.style.overflow = 'hidden';

    const skills = (job.requirements || '').split(',').map(s => s.trim()).filter(Boolean);
    const salary = job.salary_range ? job.salary_range : 'Best in Industry';
    const jobType = job.job_type ? job.job_type : 'Full-time';
    const location = job.location || 'Salem, Tamil Nadu';
    const dept = job.department || 'General';

    const modalHtml = `
      <div id="public-modal-backdrop" onclick="if(event.target === this) closePublicModal()" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 border border-[#D3DDD7] dark:border-slate-800 w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-[#0F172A] dark:text-slate-100 max-h-[90vh] overflow-y-auto no-scrollbar">
          
          <!-- Header -->
          <div class="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div class="space-y-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-3 py-1 bg-[#E8EFEB] dark:bg-emerald-950/70 text-[#123B32] dark:text-emerald-400 font-bold text-xs rounded-full uppercase tracking-wider">
                  ${dept}
                </span>
                <span class="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-md">
                  ${jobType}
                </span>
                <span class="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-md">
                  Open
                </span>
              </div>
              <h2 class="text-xl sm:text-2xl font-black font-heading text-brand-darkText dark:text-white leading-tight">
                ${job.title}
              </h2>
            </div>
            <button onclick="closePublicModal()" class="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0">
              <i class="bi bi-x-lg text-sm pointer-events-none"></i>
            </button>
          </div>

          <!-- Quick Spec Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="p-3.5 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Location</span>
              <div class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <i class="bi bi-geo-alt-fill text-[#123B32] dark:text-emerald-400"></i>
                <span>${location}</span>
              </div>
            </div>
            <div class="p-3.5 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Work Type & Hours</span>
              <div class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <i class="bi bi-clock-fill text-[#C47D4C]"></i>
                <span>${jobType}</span>
              </div>
            </div>
            <div class="p-3.5 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Compensation / Pay</span>
              <div class="text-xs font-bold text-amber-700 dark:text-amber-400 font-mono flex items-center gap-1.5">
                <i class="bi bi-cash-stack"></i>
                <span>${salary}</span>
              </div>
            </div>
          </div>

          <!-- Full Description & Requirements Body -->
          <div class="space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Role Details & Description</h4>
            <div class="p-4 bg-[#F8FAFC] dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line font-sans">
${job.description || 'No description provided.'}
            </div>
          </div>

          ${skills.length > 0 ? `
            <div class="space-y-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Skills & Focus Areas</h4>
              <div class="flex flex-wrap gap-1.5">
                ${skills.map(s => `<span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold">${s}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Footer Actions -->
          <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onclick="closePublicModal()" class="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer">
              Close
            </button>
            <button type="button" onclick="closePublicModal(); openApplyModal('${job.id}', '${encodeURIComponent(job.title)}')" class="w-full sm:w-auto px-6 py-2.5 bg-[#123B32] hover:bg-[#C47D4C] text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer">
              <i class="bi bi-file-earmark-person"></i>
              <span>Apply For Position</span>
              <i class="bi bi-arrow-right text-xs"></i>
            </button>
          </div>

        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  window.openApplyModal = function (jobId, encodedTitle) {
    let title = 'Position';
    let id = jobId || '1';
    let rawEncodedTitle = encodedTitle;

    if (encodedTitle) {
      title = decodeURIComponent(encodedTitle);
    } else if (typeof jobId === 'string' && isNaN(Number(jobId))) {
      title = jobId;
      rawEncodedTitle = encodeURIComponent(jobId);
      id = '1';
    } else if (jobId) {
      title = `Position #${jobId}`;
      rawEncodedTitle = encodeURIComponent(title);
    }

    window.closePublicModal();
    document.body.style.overflow = 'hidden';

    const modalHtml = `
      <div id="public-modal-backdrop" onclick="if(event.target === this) closePublicModal()" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 border border-[#D3DDD7] dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 text-[#0F172A] dark:text-slate-100 max-h-[90vh] overflow-y-auto no-scrollbar">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 class="text-lg sm:text-xl font-black font-heading text-[#0F172A] dark:text-white leading-tight">Apply for ${title}</h3>
              <p class="text-xs text-[#527A68] dark:text-emerald-400 font-semibold mt-0.5">Shazu Soft Technologies Hiring Portal</p>
            </div>
            <button onclick="closePublicModal()" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"><i class="bi bi-x-lg text-sm pointer-events-none"></i></button>
          </div>
          <form onsubmit="submitJobApplication(event, '${id}', '${rawEncodedTitle}')" class="space-y-3.5 text-xs">
            <div>
              <label class="block font-bold text-xs text-[#1E292B] dark:text-slate-200 mb-1.5">Full Name *</label>
              <input type="text" id="pub-app-name" required placeholder="John Doe" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32] dark:focus:border-emerald-500 font-sans transition-all">
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label class="block font-bold text-xs text-[#1E292B] dark:text-slate-200 mb-1.5">Email Address *</label>
                <input type="email" id="pub-app-email" required placeholder="john@example.com" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32] dark:focus:border-emerald-500 font-sans transition-all">
              </div>
              <div>
                <label class="block font-bold text-xs text-[#1E292B] dark:text-slate-200 mb-1.5">Phone Number *</label>
                <input type="tel" id="pub-app-phone" required placeholder="+91 98765 43210" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32] dark:focus:border-emerald-500 font-sans transition-all">
              </div>
            </div>
            <div>
              <label class="block font-bold text-xs text-[#1E292B] dark:text-slate-200 mb-1.5">Upload Resume / Portfolio Document (Max 10 MB) *</label>
              <input type="file" id="pub-app-resume-file" required accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onchange="handlePublicResumeUpload(event)" class="w-full p-2.5 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-slate-300 cursor-pointer">
              <input type="hidden" id="pub-app-resume" value="">
              <div id="pub-resume-preview" class="hidden pt-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <i class="bi bi-file-earmark-check-fill text-sm"></i>
                <span id="pub-resume-filename">File attached</span>
              </div>
            </div>
            <div>
              <label class="block font-bold text-xs text-[#1E292B] dark:text-slate-200 mb-1.5">Cover Note / Brief Intro *</label>
              <textarea id="pub-app-msg" required placeholder="Tell us why you are a great fit for SST..." class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 h-24 focus:outline-none focus:border-[#123B32] dark:focus:border-emerald-500 font-sans transition-all"></textarea>
            </div>
            <div class="flex justify-end items-center gap-3 pt-2">
              <button type="button" onclick="closePublicModal()" class="px-5 py-2.5 bg-[#F1F5F3] hover:bg-[#E2E8F0] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#0F172A] dark:text-slate-300 rounded-xl font-bold text-xs transition-all cursor-pointer">Cancel</button>
              <button type="submit" class="px-6 py-2.5 bg-[#123B32] hover:bg-[#1A4B40] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-extrabold rounded-xl transition-all shadow-md text-xs inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                <span>Submit Application</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  window.submitJobApplication = async function (e, jobId, encodedTitle) {
    e.preventDefault();
    const title = decodeURIComponent(encodedTitle);
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Submit Application';

    const name = document.getElementById('pub-app-name')?.value?.trim() || '';
    const email = document.getElementById('pub-app-email')?.value?.trim() || '';
    const phone = document.getElementById('pub-app-phone')?.value?.trim() || '';
    const resume = document.getElementById('pub-app-resume')?.value || '';
    const message = document.getElementById('pub-app-msg')?.value?.trim() || '';

    if (!name || name.length < 2) {
      showPublicModalNotice('Name Required', 'Please enter your full name (minimum 2 characters).', true);
      return;
    }

    if (!window.isValidEmail(email)) {
      showPublicModalNotice('Invalid Email', 'Please enter a valid email address (e.g., name@domain.com).', true);
      return;
    }

    if (!phone || !window.isValidPhone(phone)) {
      showPublicModalNotice('Phone Number Required', 'Please enter a valid contact phone number.', true);
      return;
    }

    if (!resume) {
      showPublicModalNotice('Resume Required', 'Please upload your resume / portfolio document.', true);
      return;
    }

    if (!message || message.length < 5) {
      showPublicModalNotice('Cover Note Required', 'Please provide a cover note / brief intro (minimum 5 characters).', true);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-white inline-block mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg><span>Submitting...</span>`;
    }

    const body = {
      job_id: jobId,
      job_title: title,
      applicant_name: name,
      email: email,
      phone: phone,
      resume_url: resume,
      message: message
    };

    try {
      const res = await fetch(`${API_BASE}/api/public/careers/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || 'Submission failed');
        err.token_no = data.token_no;
        err.is_duplicate = data.is_duplicate;
        throw err;
      }
      closePublicModal();
      const token = data.token_no || (data.application && data.application.token_no);
      if (token) localStorage.setItem('sst_last_token', token);
      showPublicModalNotice('Application Submitted!', 'Your job application has been successfully recorded in our database. Our hiring team will review your application and we will contact you shortly.', false, token);
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
      showPublicModalNotice(err.is_duplicate ? 'Already Applied' : 'Submission Error', err.message, true, err.token_no || null);
    }
  };

  window.updateAttendeeCategoryFields = function (category) {
    const orgLabel = document.getElementById('lbl-reg-org');
    const orgInput = document.getElementById('pub-reg-org');
    const deptLabel = document.getElementById('lbl-reg-dept');
    const deptInput = document.getElementById('pub-reg-dept-degree');
    const desigLabel = document.getElementById('lbl-reg-desig');
    const desigInput = document.getElementById('pub-reg-desig-year');
    const idLabel = document.getElementById('lbl-reg-id');
    const idInput = document.getElementById('pub-reg-id-no');

    if (!orgLabel || !deptLabel || !desigLabel || !idLabel) return;

    if (category.includes('School')) {
      orgLabel.textContent = 'School / Institution Name *';
      orgInput.placeholder = 'e.g. Kendriya Vidyalaya / Cluny Matriculation, Salem';
      deptLabel.textContent = 'Class / Standard & Stream *';
      deptInput.placeholder = 'e.g. 11th Standard (Computer Science / Bio-Maths)';
      desigLabel.textContent = 'Grade / Section *';
      desigInput.placeholder = 'e.g. 11th - Section A';
      idLabel.textContent = 'School Roll No / Admission No';
      idInput.placeholder = 'e.g. ADM-84920';
    } else if (category.includes('Faculty')) {
      orgLabel.textContent = 'College / University / Institute Name *';
      orgInput.placeholder = 'e.g. Government College of Engineering / Anna University';
      deptLabel.textContent = 'Academic Department *';
      deptInput.placeholder = 'e.g. Dept of Computer Science & Engineering';
      desigLabel.textContent = 'Designation / Academic Rank *';
      desigInput.placeholder = 'e.g. Assistant Professor / Associate Professor / HOD';
      idLabel.textContent = 'Staff / Faculty Employee ID';
      idInput.placeholder = 'e.g. FAC-4091';
    } else if (category.includes('Research')) {
      orgLabel.textContent = 'Research Institution / University *';
      orgInput.placeholder = 'e.g. Anna University Research Center / IIT';
      deptLabel.textContent = 'Research Field / Domain *';
      deptInput.placeholder = 'e.g. Neural Networks & Cloud Distributed Systems';
      desigLabel.textContent = 'Research Level / Stage *';
      desigInput.placeholder = 'e.g. Ph.D. Candidate (Year 2) / Post-Doc';
      idLabel.textContent = 'Scholar Registration ID';
      idInput.placeholder = 'e.g. SCH-7721';
    } else if (category.includes('Industry')) {
      orgLabel.textContent = 'Company / Organization Name *';
      orgInput.placeholder = 'e.g. Shazu Soft Technologies / Infosys / Zoho';
      deptLabel.textContent = 'Job Title & Division *';
      deptInput.placeholder = 'e.g. Cloud Architect - Enterprise Engineering';
      desigLabel.textContent = 'Experience Level *';
      desigInput.placeholder = 'e.g. 5+ Years Experience / Senior Lead';
      idLabel.textContent = 'Corporate Employee ID';
      idInput.placeholder = 'e.g. EMP-9941';
    } else {
      // Default: College / University Student
      orgLabel.textContent = 'College / University Name *';
      orgInput.placeholder = 'e.g. Anna University / Sona College of Technology, Salem';
      deptLabel.textContent = 'Degree & Department / Branch *';
      deptInput.placeholder = 'e.g. B.E Computer Science & Engineering / B.Tech AI / MCA';
      desigLabel.textContent = 'Year of Study *';
      desigInput.placeholder = 'e.g. 3rd Year (Semester 6) / Final Year';
      idLabel.textContent = 'Student Roll No / University Reg No';
      idInput.placeholder = 'e.g. 731621104055';
    }
  };

  window.openRegisterModal = function (eventId, encodedTitle, encodedFee = 'Free') {
    const title = decodeURIComponent(encodedTitle);
    const fee = decodeURIComponent(encodedFee);
    const isPaid = fee !== 'Free' && fee !== '0' && fee !== '' && !fee.toLowerCase().includes('free');

    const allEvs = window.allEventsData || [];
    const eventObj = allEvs.find(e => String(e.id) === String(eventId) || e.title === title) || {};
    
    // Auto-generate UPI QR string from UPI ID and numeric fee
    const upiId = (eventObj.upi_id || 'shazusofttechnologies@upi').trim();
    const numAmount = (fee.match(/\d+/) || ['499'])[0];
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Shazu%20Soft%20Technologies&am=${numAmount}&cu=INR&tn=${encodeURIComponent(title.slice(0, 30))}`;
    const qrUrl = eventObj.payment_qr || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;

    // Close any previous modal and lock background scrolling
    window.closePublicModal();
    document.body.style.overflow = 'hidden';

    const modalHtml = `
      <div id="public-modal-backdrop" onclick="if(event.target === this) closePublicModal()" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 md:p-6 animate-in fade-in duration-200 overflow-y-auto">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl md:max-w-2xl rounded-3xl p-5 sm:p-7 md:p-8 shadow-2xl space-y-5 sm:space-y-6 text-[#0F172A] dark:text-slate-100 max-h-[90vh] overflow-y-auto no-scrollbar relative my-auto">
          
          <!-- Modal Header with Single Consolidated Share Icon & Visible Close Button -->
          <div class="flex items-start justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-800">
            <div class="space-y-1 flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${isPaid ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'}">
                  ${isPaid ? `Fee: ${fee}` : 'Free Entry'}
                </span>
                <span class="text-[11px] text-slate-400 font-mono">Official Registration Pass</span>
              </div>
              <h3 class="text-base sm:text-xl font-black font-heading text-[#0F172A] dark:text-white leading-snug truncate">${title}</h3>
              <p class="text-xs text-[#527A68] dark:text-emerald-400 font-medium">Shazu Soft Technologies Event &amp; Training Portal</p>
            </div>
            
            <div class="flex items-center gap-2 shrink-0">
              <!-- Single Consolidated Share Button -->
              <button type="button" onclick="window.openShareModal('${eventId}')" class="w-9 h-9 rounded-full bg-slate-100 hover:bg-[#E8EFEB] dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-[#123B32] dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-xs group" title="Share Event" aria-label="Share Event">
                <i class="bi bi-share-fill text-xs group-hover:scale-110 transition-transform pointer-events-none"></i>
              </button>
              <!-- Close Button -->
              <button type="button" onclick="closePublicModal()" class="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-xs" title="Close" aria-label="Close">
                <i class="bi bi-x-lg text-sm pointer-events-none"></i>
              </button>
            </div>
          </div>

          ${isPaid ? `
            <!-- Payment QR Card with Clean Spacing & Mobile Touch Targets -->
            <div class="bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 p-4 sm:p-5 rounded-2xl space-y-3.5 shadow-xs">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span class="text-xs font-black uppercase tracking-wider text-[#123B32] dark:text-emerald-300">Registration Fee: <span class="font-mono text-amber-700 dark:text-amber-400 text-sm font-black ml-1">${fee}</span></span>
                </div>
                <span class="px-2.5 py-1 bg-[#123B32] dark:bg-emerald-700 text-white font-mono font-bold text-[11px] rounded-lg">Instant UPI QR</span>
              </div>
              
              <div class="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-emerald-900/60 shadow-xs">
                <div class="bg-white p-2.5 rounded-2xl shadow-md border-2 border-emerald-600/30 shrink-0">
                  <img src="${qrUrl}" alt="Scan QR Code to Pay" class="w-28 h-28 object-contain mx-auto">
                </div>
                <div class="space-y-2 text-center sm:text-left flex-1 min-w-0">
                  <span class="block font-black text-xs sm:text-sm text-[#0F172A] dark:text-white">Scan &amp; Pay using any UPI App (GPay, PhonePe, Paytm)</span>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">UPI ID: <code class="font-mono font-bold text-[#123B32] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 select-all">${upiId}</code></p>
                  <span class="block text-[11px] text-slate-500 dark:text-slate-400 leading-tight">After making payment, enter your 12-digit UPI UTR reference number in the field below to confirm your pass.</span>
                </div>
              </div>
            </div>
          ` : ''}

          <form onsubmit="submitEventRegistration(event, '${eventId}', '${encodedTitle}', '${encodedFee}')" class="space-y-5 text-xs">
            
            <!-- 1. CATEGORY SELECTION -->
            <div class="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5">
              <label class="block font-bold text-xs text-[#123B32] dark:text-emerald-400 flex items-center gap-1.5">
                <i class="bi bi-person-badge-fill text-amber-600 dark:text-amber-400"></i>
                <span>Select Attendee Category *</span>
              </label>
              <select id="pub-reg-category" onchange="window.updateAttendeeCategoryFields(this.value)" required class="w-full p-3 bg-white dark:bg-[#0B0F19] border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold text-[#0F172A] dark:text-white focus:outline-none focus:border-[#123B32] cursor-pointer shadow-2xs">
                <option value="College / University Student (UG / PG)" selected>🎓 College / University Student (UG / PG)</option>
                <option value="School Student (Grade 6 - 12 / Higher Secondary)">🎒 School Student (Grade 6 - 12 / Higher Secondary)</option>
                <option value="College / University Faculty (FDP / Conference)">🧑‍🏫 College / University Faculty (FDP / Conference / Seminar)</option>
                <option value="Research Scholar / Ph.D. Candidate">🔬 Research Scholar / Ph.D. Candidate</option>
                <option value="Industry Professional / Corporate Delegate">💼 Industry Professional / Corporate Delegate</option>
              </select>
            </div>

            <!-- 2. PERSONAL INFORMATION -->
            <div class="space-y-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <i class="bi bi-person-fill text-[#123B32] dark:text-emerald-400"></i> <span>Personal Details</span>
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label class="block font-bold text-[11px] text-[#1E292B] dark:text-slate-200 mb-1">Full Name *</label>
                  <input type="text" id="pub-reg-name" required placeholder="e.g. Jane Doe" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32]">
                </div>
                <div>
                  <label class="block font-bold text-[11px] text-[#1E292B] dark:text-slate-200 mb-1">Email Address *</label>
                  <input type="email" id="pub-reg-email" required placeholder="e.g. jane@example.com" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32]">
                </div>
                <div>
                  <label class="block font-bold text-[11px] text-[#1E292B] dark:text-slate-200 mb-1">Phone / WhatsApp Number *</label>
                  <input type="tel" id="pub-reg-phone" required placeholder="e.g. +91 98765 43210" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32]">
                </div>
                <div>
                  <label class="block font-bold text-[11px] text-[#1E292B] dark:text-slate-200 mb-1">Gender</label>
                  <select id="pub-reg-gender" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white focus:outline-none focus:border-[#123B32] cursor-pointer">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- 3. ACADEMIC / INSTITUTIONAL PROFILE -->
            <div class="space-y-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <i class="bi bi-building text-[#123B32] dark:text-emerald-400"></i> <span>Institutional &amp; Academic Details</span>
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div class="sm:col-span-2">
                  <label id="lbl-reg-org" class="block font-bold text-[11px] text-[#1E292B] dark:text-slate-200 mb-1">College / University Name *</label>
                  <input type="text" id="pub-reg-org" required placeholder="e.g. Anna University / Sona College of Technology, Salem" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32]">
                </div>
                <div>
                  <label id="lbl-reg-dept" class="block font-bold text-[11px] text-[#1E292B] dark:text-slate-200 mb-1">Degree &amp; Department / Branch *</label>
                  <input type="text" id="pub-reg-dept-degree" required placeholder="e.g. B.E CSE / B.Tech AI / MCA" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32]">
                </div>
                <div>
                  <label id="lbl-reg-desig" class="block font-bold text-[11px] text-[#1E292B] dark:text-slate-200 mb-1">Year of Study / Designation *</label>
                  <input type="text" id="pub-reg-desig-year" required placeholder="e.g. 3rd Year (Semester 6) / Final Year" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32]">
                </div>
                <div>
                  <label id="lbl-reg-id" class="block font-bold text-[11px] text-[#1E292B] dark:text-slate-200 mb-1">Roll No / Reg No / Staff ID</label>
                  <input type="text" id="pub-reg-id-no" placeholder="e.g. 731621104055 / EMP-4091" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32]">
                </div>
                <div>
                  <label class="block font-bold text-[11px] text-[#1E292B] dark:text-slate-200 mb-1">City &amp; State</label>
                  <input type="text" id="pub-reg-city-state" placeholder="e.g. Salem, Tamil Nadu" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32]">
                </div>
              </div>
            </div>

            <!-- 4. PAYMENT REFERENCE (FOR PAID EVENTS) -->
            ${isPaid ? `
              <div class="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-2">
                <label class="block font-bold text-xs text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <i class="bi bi-receipt"></i>
                  <span>12-Digit UPI Transaction / UTR Reference No *</span>
                </label>
                <input type="text" id="pub-reg-utr" required placeholder="e.g. 423589102456" class="w-full p-3 bg-white dark:bg-[#0B0F19] border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-bold text-[#0F172A] dark:text-white focus:outline-none focus:border-[#123B32] font-mono tracking-wider">
                <span class="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight">Enter the 12-digit UTR found on your payment confirmation screen (GPay, PhonePe, Paytm).</span>
              </div>
            ` : ''}

            <!-- 5. DECLARATION -->
            <div class="flex items-start gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
              <input type="checkbox" id="pub-reg-declaration" required checked class="w-4 h-4 mt-0.5 text-emerald-600 rounded cursor-pointer shrink-0">
              <label for="pub-reg-declaration" class="text-[11px] text-slate-600 dark:text-slate-300 leading-tight cursor-pointer">
                I hereby declare that all academic, institutional, and personal information provided above is true and authentic.
              </label>
            </div>

            <!-- 6. Clear Primary CTA Button -->
            <div class="pt-2">
              ${isPaid ? `
                <button type="submit" id="pub-reg-submit-btn" class="w-full py-3.5 px-6 bg-[#123B32] hover:bg-[#1A4B40] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-extrabold rounded-xl transition-all shadow-lg hover:shadow-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                  <i class="bi bi-shield-check text-base"></i>
                  <span>I've Paid — Submit UTR &amp; Complete Registration</span>
                  <i class="bi bi-arrow-right text-xs"></i>
                </button>
              ` : `
                <button type="submit" id="pub-reg-submit-btn" class="w-full py-3.5 px-6 bg-[#123B32] hover:bg-[#1A4B40] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-extrabold rounded-xl transition-all shadow-lg hover:shadow-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                  <i class="bi bi-ticket-perforated text-base"></i>
                  <span>Confirm &amp; Complete Registration</span>
                  <i class="bi bi-arrow-right text-xs"></i>
                </button>
              `}
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  window.closePublicModal = function () {
    const backdrop = document.getElementById('public-modal-backdrop');
    if (backdrop) backdrop.remove();
    document.body.style.overflow = '';
  };

  // Global Escape Key Listener for Modals
  if (!window._modalEscListenerAttached) {
    window._modalEscListenerAttached = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closePublicModal();
      }
    });
  }

  // 6. Share Event Functions (Social Channels, Direct URL, QR & Native Share)
  window.getEventShareDetails = function (eventId) {
    const allEvs = window.allEventsData || [];
    const ev = allEvs.find(e => String(e.id) === String(eventId) || e.title === eventId) || allEvs[0] || {};
    
    // Resolve clean absolute share URL for events page
    const origin = (window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file:')) 
      ? window.location.origin 
      : 'https://shazusofttechnologies.org';
    const path = (window.location.pathname && window.location.pathname.includes('.html'))
      ? window.location.pathname.replace(/\/[^\/]*$/, '/events.html')
      : '/events.html';
    const shareUrl = `${origin}${path.startsWith('/') ? path : '/' + path}?event=${encodeURIComponent(ev.id || '101')}`;
    
    const fee = ev.registration_fee || 'Free';
    const date = ev.event_date || 'TBA';
    const location = ev.location || 'Salem, Tamil Nadu';
    const title = ev.title || 'Event at Shazu Soft Technologies';
    const category = ev.category || 'Event';
    
    const shareText = `🚀 *${title}*\n📅 *Date:* ${date}\n📍 *Venue:* ${location}\n🎟️ *Fee:* ${fee}\n\nJoin us at Shazu Soft Technologies! Register online here:\n${shareUrl}`;
    
    return {
      ev,
      id: ev.id,
      title,
      date,
      location,
      fee,
      category,
      description: ev.description || '',
      imageUrl: ev.image_url || (category.toLowerCase().includes('hackathon') 
        ? 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80'
        : 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80'),
      shareUrl,
      shareText,
      whatsappUrl: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`,
      linkedinUrl: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      twitterUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${title} organized by @shazusoft!`)}&url=${encodeURIComponent(shareUrl)}&hashtags=ShazuSoft,TechEvents,Innovation`,
      telegramUrl: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`🚀 ${title} (${date})`)}`,
      facebookUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      mailtoUrl: `mailto:?subject=${encodeURIComponent(`Invitation: ${title} | Shazu Soft Technologies`)}&body=${encodeURIComponent(`Hi,\n\nI'd like to share this upcoming event from Shazu Soft Technologies with you:\n\nEvent: ${title}\nCategory: ${category}\nDate: ${date}\nLocation: ${location}\nFee: ${fee}\n\nDescription:\n${ev.description || ''}\n\nRead more and register online at:\n${shareUrl}\n\nBest regards,\nShazu Soft Technologies`)}`,
      qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`
    };
  };

  window.openShareModal = function (eventId) {
    const details = window.getEventShareDetails(eventId);
    const { ev, title, date, location, fee, category, shareUrl, whatsappUrl, linkedinUrl, twitterUrl, telegramUrl, facebookUrl, mailtoUrl, qrUrl, imageUrl } = details;
    const isPaid = fee !== 'Free' && fee !== '0' && fee !== '' && !fee.toLowerCase().includes('free');

    // Remove any existing active modal
    window.closePublicModal();
    document.body.style.overflow = 'hidden';

    const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    const modalHtml = `
      <div id="public-modal-backdrop" onclick="if(event.target === this) closePublicModal()" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
        <div class="bg-white dark:bg-slate-900 border border-[#D3DDD7] dark:border-slate-800 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100 max-h-[92vh] overflow-y-auto no-scrollbar relative">
          
          <!-- Modal Header -->
          <div class="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80 text-[#123B32] dark:text-emerald-400 flex items-center justify-center text-base shadow-xs shrink-0">
                <i class="bi bi-share-fill"></i>
              </div>
              <div>
                <h3 class="text-base sm:text-lg font-black font-heading text-slate-900 dark:text-white leading-tight">Share This Event</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Spread the word with classmates, colleagues &amp; peers</p>
              </div>
            </div>
            <button onclick="closePublicModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0" aria-label="Close Share Modal">
              <i class="bi bi-x-lg text-xs pointer-events-none"></i>
            </button>
          </div>

          <!-- Event Mini Preview Card -->
          <div class="flex items-center gap-3.5 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
            <img src="${imageUrl}" alt="${title}" class="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700">
            <div class="min-w-0 flex-1 space-y-0.5">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-md uppercase font-mono">${category.split('|')[0].trim()}</span>
                <span class="px-2 py-0.5 ${isPaid ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'} text-[10px] font-mono font-bold rounded-md">${fee}</span>
              </div>
              <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate" title="${title}">${title}</h4>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <i class="bi bi-calendar3 text-[10px] text-amber-600 dark:text-amber-400"></i> <span>${date}</span>
                <span class="mx-1 text-slate-300 dark:text-slate-600">•</span>
                <i class="bi bi-geo-alt-fill text-[10px] text-emerald-600 dark:text-emerald-400"></i> <span class="truncate">${location}</span>
              </p>
            </div>
          </div>

          <!-- Quick Social Share Buttons Grid -->
          <div class="space-y-2">
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <i class="bi bi-send text-xs text-[#123B32] dark:text-emerald-400"></i> Share directly to
            </label>
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <!-- WhatsApp -->
              <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-[#25D366]/30 transition-all duration-200 hover:-translate-y-0.5 group">
                <i class="bi bi-whatsapp text-lg sm:text-xl group-hover:scale-110 transition-transform"></i>
                <span class="text-[10px] font-bold mt-1">WhatsApp</span>
              </a>

              <!-- LinkedIn -->
              <a href="${linkedinUrl}" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-[#0077b5]/10 hover:bg-[#0077b5] text-[#0077b5] hover:text-white border border-[#0077b5]/30 transition-all duration-200 hover:-translate-y-0.5 group">
                <i class="bi bi-linkedin text-lg sm:text-xl group-hover:scale-110 transition-transform"></i>
                <span class="text-[10px] font-bold mt-1">LinkedIn</span>
              </a>

              <!-- X / Twitter -->
              <a href="${twitterUrl}" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-900/10 dark:bg-white/10 hover:bg-slate-900 dark:hover:bg-white text-slate-900 dark:text-white hover:text-white dark:hover:text-slate-900 border border-slate-300 dark:border-slate-700 transition-all duration-200 hover:-translate-y-0.5 group">
                <i class="bi bi-twitter-x text-lg sm:text-xl group-hover:scale-110 transition-transform"></i>
                <span class="text-[10px] font-bold mt-1">X / Twitter</span>
              </a>

              <!-- Telegram -->
              <a href="${telegramUrl}" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-[#229ED9]/10 hover:bg-[#229ED9] text-[#229ED9] hover:text-white border border-[#229ED9]/30 transition-all duration-200 hover:-translate-y-0.5 group">
                <i class="bi bi-telegram text-lg sm:text-xl group-hover:scale-110 transition-transform"></i>
                <span class="text-[10px] font-bold mt-1">Telegram</span>
              </a>

              <!-- Facebook -->
              <a href="${facebookUrl}" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-[#1877F2]/10 hover:bg-[#1877F2] text-[#1877F2] hover:text-white border border-[#1877F2]/30 transition-all duration-200 hover:-translate-y-0.5 group">
                <i class="bi bi-facebook text-lg sm:text-xl group-hover:scale-110 transition-transform"></i>
                <span class="text-[10px] font-bold mt-1">Facebook</span>
              </a>

              <!-- Email -->
              <a href="${mailtoUrl}" class="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-600 text-amber-700 dark:text-amber-400 hover:text-white border border-amber-500/30 transition-all duration-200 hover:-translate-y-0.5 group">
                <i class="bi bi-envelope-fill text-lg sm:text-xl group-hover:scale-110 transition-transform"></i>
                <span class="text-[10px] font-bold mt-1">Email</span>
              </a>
            </div>
          </div>

          <!-- Native Device Share Button (If Supported) -->
          ${hasNativeShare ? `
            <button onclick="window.triggerNativeShare('${encodeURIComponent(eventId)}')" class="w-full py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-[#123B32] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer">
              <i class="bi bi-phone-fill text-sm"></i>
              <span>Share via Device System Apps (More...)</span>
            </button>
          ` : ''}

          <!-- Copy Direct Link Bar -->
          <div class="space-y-1.5 pt-1">
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <i class="bi bi-link-45deg text-xs text-[#123B32] dark:text-emerald-400"></i> Direct Event URL
            </label>
            <div class="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <input type="text" id="share-link-input" readonly value="${shareUrl}" class="flex-1 bg-transparent px-3 text-xs text-slate-700 dark:text-slate-300 font-mono focus:outline-none select-all truncate">
              <button type="button" id="btn-copy-share-link" onclick="window.copyEventLink('${encodeURIComponent(eventId)}', this)" class="px-4 py-2 bg-[#123B32] hover:bg-[#2F5B4E] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0">
                <i class="bi bi-clipboard"></i>
                <span>Copy Link</span>
              </button>
            </div>
          </div>

          <!-- QR Code Section (Compact) -->
          <div class="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3">
            <div class="space-y-0.5">
              <span class="block font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <i class="bi bi-qr-code text-amber-600 dark:text-amber-400"></i> Instant QR Scanner
              </span>
              <span class="block text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Scan with any phone camera to view or register directly</span>
            </div>
            <div class="bg-white p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs shrink-0">
              <img src="${qrUrl}" alt="Event QR Code" class="w-14 h-14 object-contain">
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <button type="button" onclick="closePublicModal()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer">
              Close
            </button>
            <button type="button" onclick="closePublicModal(); openRegisterModal('${ev.id}', '${encodeURIComponent(title)}', '${encodeURIComponent(fee)}')" class="px-5 py-2 bg-[#123B32] hover:bg-[#C47D4C] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer">
              <i class="bi bi-ticket-perforated"></i>
              <span>Register Now</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  window.quickShareEvent = function(channel, eventId) {
    const details = window.getEventShareDetails(eventId);
    if (channel === 'whatsapp') {
      window.open(details.whatsappUrl, '_blank', 'noopener,noreferrer');
    } else if (channel === 'linkedin') {
      window.open(details.linkedinUrl, '_blank', 'noopener,noreferrer');
    } else if (channel === 'x' || channel === 'twitter') {
      window.open(details.twitterUrl, '_blank', 'noopener,noreferrer');
    } else if (channel === 'telegram') {
      window.open(details.telegramUrl, '_blank', 'noopener,noreferrer');
    } else if (channel === 'facebook') {
      window.open(details.facebookUrl, '_blank', 'noopener,noreferrer');
    } else if (channel === 'email') {
      window.location.href = details.mailtoUrl;
    } else if (channel === 'copy') {
      window.copyEventLink(eventId);
    } else if (channel === 'native') {
      window.triggerNativeShare(eventId);
    }
  };

  window.copyEventLink = async function(eventId, btnEl) {
    const details = window.getEventShareDetails(eventId);
    const link = details.shareUrl;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const tempInput = document.createElement('textarea');
        tempInput.value = link;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }

      if (btnEl) {
        const originalHtml = btnEl.innerHTML;
        btnEl.classList.remove('bg-[#123B32]', 'dark:bg-emerald-600');
        btnEl.classList.add('bg-emerald-600', 'text-white');
        btnEl.innerHTML = `<i class="bi bi-check2"></i><span>Copied!</span>`;
        setTimeout(() => {
          btnEl.classList.add('bg-[#123B32]', 'dark:bg-emerald-600');
          btnEl.classList.remove('bg-emerald-600');
          btnEl.innerHTML = originalHtml;
        }, 2500);
      }

      if (window.toast) {
        window.toast.success('Event link copied to clipboard! 📋');
      }
    } catch (err) {
      if (window.toast) {
        window.toast.error('Failed to copy link automatically. Please copy manually.');
      }
    }
  };

  window.triggerNativeShare = async function(eventId) {
    const details = window.getEventShareDetails(eventId);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: details.title,
          text: `Check out ${details.title} on ${details.date} at Shazu Soft Technologies!`,
          url: details.shareUrl
        });
        if (window.toast) window.toast.success('Shared successfully!');
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Native share notice:', err);
        }
      }
    } else {
      window.openShareModal(eventId);
    }
  };

  window.handleSharedEventParam = function() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedEventId = urlParams.get('event') || urlParams.get('eventId') || urlParams.get('id');
      if (!sharedEventId) return;

      setTimeout(() => {
        const card = document.getElementById(`event-card-${sharedEventId}`) || 
                     document.querySelector(`[data-event-id="${sharedEventId}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('ring-4', 'ring-[#123B32]', 'dark:ring-emerald-400', 'transition-all', 'duration-500', 'shadow-2xl');
          setTimeout(() => {
            card.classList.remove('ring-4', 'ring-[#123B32]', 'dark:ring-emerald-400');
          }, 4500);

          const evObj = (window.allEventsData || []).find(e => String(e.id) === String(sharedEventId));
          if (evObj && window.toast) {
            window.toast.custom(`✨ Highlighting: ${evObj.title}`, { icon: '🎯', duration: 4000 });
          }
        }
      }, 400);
    } catch (err) {
      console.warn('Deep link resolution note:', err);
    }
  };

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closePublicModal();
    }
  });

  window.submitEventRegistration = async function (e, eventId, encodedTitle, encodedFee = 'Free') {
    e.preventDefault();
    const title = decodeURIComponent(encodedTitle);
    const fee = decodeURIComponent(encodedFee);
    const isFree = fee.toLowerCase().includes('free') || fee === '0' || fee === '';
    const utrEl = document.getElementById('pub-reg-utr');
    const declEl = document.getElementById('pub-reg-declaration');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Complete Registration & Issue Pass';

    const name = document.getElementById('pub-reg-name')?.value?.trim() || '';
    const email = document.getElementById('pub-reg-email')?.value?.trim() || '';
    const phone = document.getElementById('pub-reg-phone')?.value?.trim() || '';
    const utr = utrEl ? utrEl.value.trim() : '';

    if (!name || name.length < 2) {
      showPublicModalNotice('Name Required', 'Please enter your full name (minimum 2 characters).', true);
      return;
    }

    if (!window.isValidEmail(email)) {
      showPublicModalNotice('Invalid Email', 'Please enter a valid email address (e.g., name@domain.com).', true);
      return;
    }

    if (phone && !window.isValidPhone(phone)) {
      showPublicModalNotice('Invalid Phone', 'Please enter a valid contact phone number.', true);
      return;
    }

    if (!isFree && utr.length < 4) {
      showPublicModalNotice('Transaction UTR Required', 'Please enter a valid UPI / Bank Transaction UTR Number for payment verification.', true);
      return;
    }

    if (declEl && !declEl.checked) {
      showPublicModalNotice('Declaration Required', 'Please check the declaration box before submitting.', true);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-white inline-block mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg><span>Issuing Pass...</span>`;
    }

    const body = {
      event_id: eventId,
      event_title: title,
      attendee_category: document.getElementById('pub-reg-category')?.value || 'College / University Student (UG / PG)',
      name: name,
      email: email,
      phone: phone,
      gender: document.getElementById('pub-reg-gender')?.value || 'Male',
      organization: document.getElementById('pub-reg-org')?.value || '',
      department_degree: document.getElementById('pub-reg-dept-degree')?.value || '',
      designation_year: document.getElementById('pub-reg-desig-year')?.value || '',
      roll_no_employee_id: document.getElementById('pub-reg-id-no')?.value || '',
      city_state: document.getElementById('pub-reg-city-state')?.value || '',
      registration_fee: fee,
      payment_method: 'UPI QR',
      transaction_id: utr,
      declaration_agreed: declEl ? declEl.checked : true
    };

    try {
      const res = await fetch(`${API_BASE}/api/public/events/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || 'Registration failed');
        err.token_no = data.token_no;
        err.is_duplicate = data.is_duplicate;
        throw err;
      }
      closePublicModal();
      if (data.is_pending_payment) {
        showPublicModalNotice(
          'Payment Verification Pending ⏳',
          'Thank you for registering! Your registration has been received. Because this is a paid event, your official entry pass token and attendance QR code will be dispatched to your registered email once payment (UTR) is verified by Admin.',
          false,
          null
        );
      } else {
        const token = data.token_no || (data.registration && data.registration.token_no);
        if (token) localStorage.setItem('sst_last_token', token);
        showPublicModalNotice('Registration Confirmed!', 'Thank you for registering! Your event pass dossier has been recorded and emailed to you. We will contact you shortly.', false, token);
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
      showPublicModalNotice(err.is_duplicate ? 'Already Registered' : 'Registration Error', err.message, true, err.token_no || null);
    }
  };

  // 11-Field Membership Application Submission Handler
  window.submitMembershipApplication = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (window.isMembershipSubmitting) return;
    window.isMembershipSubmitting = true;

    const submitBtn = document.getElementById('member-submit-btn');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Submit Application';

    const declEl = document.getElementById('member-declaration');
    const body = {
      association_name: document.getElementById('member-association')?.value?.trim() || 'SST Academic & Research Network',
      membership_type: document.getElementById('member-category')?.value || 'Professional Member',
      name: document.getElementById('member-name')?.value?.trim() || '',
      dob: document.getElementById('member-dob')?.value || '',
      area_of_interest: document.getElementById('member-interest')?.value?.trim() || '',
      phone: document.getElementById('member-phone')?.value?.trim() || '',
      email: document.getElementById('member-email')?.value?.trim() || '',
      professional_qualification: document.getElementById('member-qualification')?.value?.trim() || '',
      present_designation: document.getElementById('member-designation')?.value?.trim() || '',
      organization_name_address: document.getElementById('member-institution')?.value?.trim() || '',
      declaration_agreed: declEl ? declEl.checked : true
    };

    if (!body.name || body.name.length < 2) {
      window.isMembershipSubmitting = false;
      showPublicModalNotice('Name Required', 'Please enter your full name (minimum 2 characters).', true);
      return;
    }

    if (!window.isValidEmail(body.email)) {
      window.isMembershipSubmitting = false;
      showPublicModalNotice('Invalid Email', 'Please enter a valid email address (e.g., name@domain.com).', true);
      return;
    }

    if (body.phone && !window.isValidPhone(body.phone)) {
      window.isMembershipSubmitting = false;
      showPublicModalNotice('Invalid Phone', 'Please enter a valid contact phone number.', true);
      return;
    }

    if (!body.membership_type) {
      window.isMembershipSubmitting = false;
      showPublicModalNotice('Category Required', 'Please select a valid membership category.', true);
      return;
    }

    if (declEl && !declEl.checked) {
      window.isMembershipSubmitting = false;
      showPublicModalNotice('Declaration Required', 'Please accept the declaration checkbox to confirm your details are accurate.', true);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-white inline-block mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg><span>Submitting Application...</span>`;
    }

    try {
      const res = await fetch(`${API_BASE}/api/public/membership/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || 'Failed to submit membership application');
        err.token_no = data.token_no;
        err.is_duplicate = data.is_duplicate;
        throw err;
      }

      const form = document.getElementById('membership-form');
      if (form) form.reset();

      const token = data.token_no || (data.membership && data.membership.token_no);
      if (token) localStorage.setItem('sst_last_token', token);
      showPublicModalNotice('Membership Application Received!', 'Thank you! Your membership dossier has been recorded in the database. We will contact you shortly.', false, token);
    } catch (err) {
      showPublicModalNotice(err.is_duplicate ? 'Application Already Exists' : 'Submission Error', err.message, true, err.token_no || null);
    } finally {
      window.isMembershipSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  };

  window.showPublicModalNotice = function (title, message, isError = false, tokenNo = null) {
    document.querySelectorAll('#public-notice-backdrop').forEach(el => el.remove());

    const contactBadge = !isError ? `
      <div class="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs font-bold text-[#123B32] dark:text-emerald-300 flex items-center justify-center gap-2 my-2">
        <i class="bi bi-headset text-sm text-[#C47D4C]"></i>
        <span>We will contact you shortly.</span>
      </div>
    ` : '';

    const tokenBox = tokenNo ? `
      <div class="bg-[#F8FAFC] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl space-y-1 my-3 text-center">
        <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Your Reference Token:</span>
        <div class="text-base sm:text-lg font-mono font-black text-[#123B32] dark:text-emerald-400 select-all">${tokenNo}</div>
        <div class="flex items-center justify-center gap-2 pt-1">
          <button type="button" onclick="navigator.clipboard.writeText('${tokenNo}'); this.textContent = 'Copied!';" class="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs">Copy Token</button>
          <a href="track.html?token=${encodeURIComponent(tokenNo)}" class="px-2.5 py-1 bg-[#123B32] text-white rounded-lg text-[11px] font-bold shadow-xs">Track Status</a>
        </div>
      </div>
    ` : '';

    const modalHtml = `
      <div id="public-notice-backdrop" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-3.5 text-center">
          <div class="w-12 h-12 rounded-full ${isError ? 'bg-red-100 dark:bg-red-950 text-red-600' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'} flex items-center justify-center mx-auto text-2xl">
            <i class="bi bi-${isError ? 'x-circle-fill' : 'check-circle-fill'}"></i>
          </div>
          <div class="space-y-1">
            <h3 class="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">${title}</h3>
            <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${message}</p>
          </div>
          ${contactBadge}
          ${tokenBox}
          <div class="flex items-center justify-center gap-2 pt-1">
            <button onclick="document.querySelectorAll('#public-notice-backdrop').forEach(el => el.remove())" class="flex-1 py-2.5 bg-[#123B32] hover:bg-[#2F5B4E] text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer">OK, Got It</button>
            ${tokenNo ? `<a href="track.html?token=${encodeURIComponent(tokenNo)}" class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md text-center">View Status</a>` : ''}
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  window.submitContactInquiry = async function (name, email, phone, subject, service_category, message) {
    const contactForm = document.getElementById('contact-form');
    const submitBtn = contactForm ? contactForm.querySelector('button[type="submit"]') : null;
    const originalText = submitBtn ? submitBtn.innerHTML : 'Send Message';

    if (!name || name.length < 2) {
      showPublicModalNotice('Name Required', 'Please enter your full name (minimum 2 characters).', true);
      return false;
    }

    if (!window.isValidEmail(email)) {
      showPublicModalNotice('Invalid Email', 'Please enter a valid email address (e.g., name@domain.com).', true);
      return false;
    }

    if (phone && !window.isValidPhone(phone)) {
      showPublicModalNotice('Invalid Phone', 'Please enter a valid contact phone number.', true);
      return false;
    }

    if (!message || message.length < 5) {
      showPublicModalNotice('Message Required', 'Please enter a detailed message (minimum 5 characters).', true);
      return false;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-white inline-block mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg><span>Sending...</span>`;
    }

    try {
      const res = await fetch(`${API_BASE}/api/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, subject, service_category, message })
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || 'Failed to submit inquiry');
        err.token_no = data.token_no;
        err.is_duplicate = data.is_duplicate;
        throw err;
      }
      const token = data.inquiry ? data.inquiry.token_no : (data.token_no || null);
      if (token) localStorage.setItem('sst_last_token', token);
      showPublicModalNotice('Message Sent!', 'Thank you for reaching out! We have recorded your inquiry ticket in the database. We will contact you shortly.', false, token);
      return true;
    } catch (err) {
      showPublicModalNotice(err.is_duplicate ? 'Inquiry Recently Submitted' : 'Submission Error', err.message, true, err.token_no || null);
      return false;
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  };

  // Universal Track Status Modal (callable anywhere on site via window.openTrackModal)
  window.openTrackModal = function(initialToken = '') {
    const existing = document.getElementById('track-modal-backdrop');
    if (existing) existing.remove();

    const storedToken = initialToken || localStorage.getItem('sst_last_token') || '';

    const modalHtml = `
      <div id="track-modal-backdrop" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto no-scrollbar">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-xl bg-[#E8EFEB] dark:bg-emerald-950 text-[#123B32] dark:text-emerald-300 flex items-center justify-center text-sm"><i class="bi bi-search"></i></span>
              <div>
                <h3 class="text-base font-extrabold font-heading text-slate-900 dark:text-white">Track Application & Pass Status</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">Enter your SST Reference Token</p>
              </div>
            </div>
            <button onclick="document.getElementById('track-modal-backdrop').remove()" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"><i class="bi bi-x-lg text-xs pointer-events-none"></i></button>
          </div>

          <form onsubmit="window.handleQuickTrack(event)" class="space-y-3">
            <div class="relative">
              <input type="text" id="quick-track-input" required placeholder="e.g. SST-PASS-..., SST-APP-..., SST-MEM-..." value="${storedToken}" class="w-full pl-3.5 pr-20 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white uppercase focus:outline-none focus:border-[#123B32]">
              <button type="submit" id="quick-track-btn" class="absolute right-1.5 top-1.5 px-3 py-1.5 bg-[#123B32] text-white text-xs font-bold rounded-lg cursor-pointer">Track</button>
            </div>
          </form>

          <div id="quick-track-result" class="hidden space-y-3 pt-2"></div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    if (storedToken) {
      window.fetchQuickTrackData(storedToken);
    }
  };

  window.handleQuickTrack = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('quick-track-input');
    const token = input ? input.value.trim() : '';
    if (token) window.fetchQuickTrackData(token);
  };

  window.fetchQuickTrackData = async function(token) {
    const resBox = document.getElementById('quick-track-result');
    if (!resBox) return;
    resBox.classList.remove('hidden');
    resBox.innerHTML = `<div class="text-center py-4 text-xs text-slate-500"><svg class="animate-spin h-4 w-4 text-emerald-600 inline-block mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>Checking status...</div>`;

    try {
      const res = await fetch(`${API_BASE}/api/public/track/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok || !data.found) throw new Error(data.error || 'Token not found');

      resBox.innerHTML = `
        <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="px-2.5 py-0.5 bg-[#123B32] text-white font-extrabold text-[10px] rounded-full uppercase">${data.category_type}</span>
            <span class="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold text-[11px] rounded-full border border-emerald-300 dark:border-emerald-700">${data.status}</span>
          </div>
          <div>
            <h4 class="text-xs font-bold text-slate-900 dark:text-white">${data.title}</h4>
            <p class="text-[11px] text-slate-500">Applicant: <strong>${data.applicant_name}</strong></p>
          </div>
          ${data.admin_notes ? `
            <div class="bg-[#E8EFEB] dark:bg-slate-900 border-l-3 border-[#123B32] dark:border-emerald-400 p-2.5 rounded-r-xl">
              <span class="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase block">ADMIN REMARKS:</span>
              <p class="text-xs text-slate-800 dark:text-slate-200 mt-0.5">${data.admin_notes}</p>
            </div>
          ` : ''}
          <div class="flex items-center justify-between pt-1">
            <span class="text-[10px] font-mono text-slate-400">${data.token_no}</span>
            <a href="track.html?token=${encodeURIComponent(data.token_no)}" class="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">Full Details & Pass →</a>
          </div>
        </div>
      `;
    } catch (err) {
      resBox.innerHTML = `
        <div class="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3 rounded-xl text-center">
          <p class="text-xs text-red-600 dark:text-red-300 font-bold">${err.message}</p>
        </div>
      `;
    }
  };

  // Reusable Dynamic Content Initialization for initial page load and SPA navigation
  window.initDynamicContent = function() {
    trackPageView();
    loadAnnouncements();
    loadAnnouncementsPage();
    loadCareers();
    loadEvents();
    loadGalleryShowcase();

    // 3-Tier Multi-Filter Listeners
    // Tier 1: Event Type Cards
    const typeCards = document.querySelectorAll('.event-type-card');
    typeCards.forEach(card => {
      if (card.dataset.spaBound) return;
      card.dataset.spaBound = 'true';
      card.addEventListener('click', () => {
        typeCards.forEach(c => {
          c.classList.remove('active', 'border-amber-500', 'bg-amber-500/10', 'text-amber-900', 'dark:text-amber-200');
          c.classList.add('border-slate-200', 'dark:border-slate-800', 'text-slate-700', 'dark:text-slate-300');
          const icon = c.querySelector('div');
          if (icon && c.getAttribute('data-type') !== 'all') {
            icon.classList.remove('bg-amber-500', 'text-white');
            icon.classList.add('bg-slate-200', 'dark:bg-slate-800', 'text-amber-600', 'dark:text-amber-400');
          }
        });
        card.classList.add('active', 'border-amber-500', 'bg-amber-500/10', 'text-amber-900', 'dark:text-amber-200');
        card.classList.remove('border-slate-200', 'dark:border-slate-800', 'text-slate-700', 'dark:text-slate-300');
        const activeIcon = card.querySelector('div');
        if (activeIcon) {
          activeIcon.classList.remove('bg-slate-200', 'dark:bg-slate-800', 'text-amber-600', 'dark:text-amber-400');
          activeIcon.classList.add('bg-amber-500', 'text-white');
        }

        window.eventFilterState.type = card.getAttribute('data-type') || 'all';
        window.applyEventFilters();
      });
    });

    // Tier 2: Live Search Input
    const searchInput = document.getElementById('event-search');
    if (searchInput && !searchInput.dataset.spaBound) {
      searchInput.dataset.spaBound = 'true';
      searchInput.addEventListener('input', (e) => {
        window.eventFilterState.search = e.target.value;
        window.applyEventFilters();
      });
    }

    // Tier 2: Status Tabs (All, Upcoming, Past)
    const statusPills = document.querySelectorAll('.event-status-pill');
    statusPills.forEach(pill => {
      if (pill.dataset.spaBound) return;
      pill.dataset.spaBound = 'true';
      pill.addEventListener('click', () => {
        statusPills.forEach(p => {
          p.classList.remove('active', 'bg-[#123B32]', 'text-white', 'shadow-sm');
          p.classList.add('text-slate-600', 'dark:text-slate-400');
        });
        pill.classList.add('active', 'bg-[#123B32]', 'text-white', 'shadow-sm');
        pill.classList.remove('text-slate-600', 'dark:text-slate-400');

        window.eventFilterState.status = pill.getAttribute('data-status') || 'all';
        window.applyEventFilters();
      });
    });

    // Tier 3: Field / Category Pills
    const fieldPills = document.querySelectorAll('.event-field-pill');
    fieldPills.forEach(pill => {
      if (pill.dataset.spaBound) return;
      pill.dataset.spaBound = 'true';
      pill.addEventListener('click', () => {
        fieldPills.forEach(p => {
          p.classList.remove('active', 'bg-[#123B32]', 'text-white', 'shadow-xs');
          p.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');
        });
        pill.classList.add('active', 'bg-[#123B32]', 'text-white', 'shadow-xs');
        pill.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');

        window.eventFilterState.field = pill.getAttribute('data-field') || 'all';
        window.applyEventFilters();
      });
    });

    // Dropdown Handlers
    const typeSelect = document.getElementById('event-type-select');
    if (typeSelect && !typeSelect.dataset.spaBound) {
      typeSelect.dataset.spaBound = 'true';
      typeSelect.addEventListener('change', (e) => {
        window.handleEventTypeSelect(e.target.value);
      });
    }

    const fieldSelect = document.getElementById('event-field-select');
    if (fieldSelect && !fieldSelect.dataset.spaBound) {
      fieldSelect.dataset.spaBound = 'true';
      fieldSelect.addEventListener('change', (e) => {
        window.handleEventFieldSelect(e.target.value);
      });
    }

    const statusSelect = document.getElementById('event-status-select');
    if (statusSelect && !statusSelect.dataset.spaBound) {
      statusSelect.dataset.spaBound = 'true';
      statusSelect.addEventListener('change', (e) => {
        window.handleEventStatusSelect(e.target.value);
      });
    }

    window.handleEventTypeSelect = function(val) {
      window.eventFilterState = window.eventFilterState || { type: 'all', search: '', status: 'all', field: 'all' };
      window.eventFilterState.type = val || 'all';
      const el = document.getElementById('event-type-select');
      if (el && el.value !== val) el.value = val;
      window.applyEventFilters();
    };

    window.handleEventFieldSelect = function(val) {
      window.eventFilterState = window.eventFilterState || { type: 'all', search: '', status: 'all', field: 'all' };
      window.eventFilterState.field = val || 'all';
      const el = document.getElementById('event-field-select');
      if (el && el.value !== val) el.value = val;
      window.applyEventFilters();
    };

    window.handleEventStatusSelect = function(val) {
      window.eventFilterState = window.eventFilterState || { type: 'all', search: '', status: 'all', field: 'all' };
      window.eventFilterState.status = val || 'all';
      const el = document.getElementById('event-status-select');
      if (el && el.value !== val) el.value = val;
      window.applyEventFilters();
    };

    // Quick Reset Filters function
    window.resetAllEventFilters = function() {
      window.eventFilterState = { type: 'all', search: '', status: 'all', field: 'all' };
      const sInput = document.getElementById('event-search');
      if (sInput) sInput.value = '';

      const typeSelect = document.getElementById('event-type-select');
      if (typeSelect) typeSelect.value = 'all';

      const fieldSelect = document.getElementById('event-field-select');
      if (fieldSelect) fieldSelect.value = 'all';

      const statusSelect = document.getElementById('event-status-select');
      if (statusSelect) statusSelect.value = 'all';

      document.querySelectorAll('.event-type-card').forEach(c => {
        const isAll = c.getAttribute('data-type') === 'all';
        c.classList.toggle('active', isAll);
      });
      document.querySelectorAll('.event-status-pill').forEach(p => {
        const isAll = p.getAttribute('data-status') === 'all';
        p.classList.toggle('active', isAll);
      });
      document.querySelectorAll('.event-field-pill').forEach(f => {
        const isAll = f.getAttribute('data-field') === 'all';
        f.classList.toggle('active', isAll);
      });

      window.applyEventFilters();
    };

    // Attach contact form listener if present
    const contactForm = document.getElementById('contact-form') || document.querySelector('form[action*="contact"]');
    if (contactForm && !contactForm.dataset.spaBound) {
      contactForm.dataset.spaBound = 'true';
      contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (document.getElementById('name') || document.querySelector('input[name="name"]'))?.value || '';
        const email = (document.getElementById('email') || document.querySelector('input[name="email"]'))?.value || '';
        const phone = (document.getElementById('phone') || document.querySelector('input[name="phone"]'))?.value || '';
        const subject = (document.getElementById('subject') || document.querySelector('input[name="subject"]'))?.value || '';
        const message = (document.getElementById('message') || document.querySelector('textarea[name="message"]'))?.value || '';
        
        const success = await window.submitContactInquiry(name, email, phone, subject, 'General', message);
        if (success) contactForm.reset();
      });
    }

    // Initialize Floating Help & Support Widget
    window.initFloatingHelpWidget();
  };

  // 6. Global Floating Radial Speed-Dial Support Action Widget
  window.initFloatingHelpWidget = function () {
    const existing = document.getElementById('global-floating-help-widget');
    if (existing) return;

    // Do not render on admin panel
    if (window.location.pathname.includes('admin.html')) return;

    const widgetHtml = `
      <div id="global-floating-help-widget" class="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
        <!-- Floating Speed-Dial Actions Menu -->
        <div id="floating-help-menu" class="hidden flex-col items-center gap-2.5 mb-2.5 transition-all duration-300 transform scale-90 opacity-0 origin-bottom">
          <!-- 1. AI Assistant Chatbot Button -->
          <button type="button" onclick="window.toggleFloatingHelpMenu(); if (typeof window.openChatbot === 'function') window.openChatbot();" class="group relative flex items-center border-none bg-transparent p-0 cursor-pointer">
            <span class="absolute right-12 whitespace-nowrap bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none border border-slate-700">Ask SST AI</span>
            <div class="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl transition-all duration-200 hover:scale-110 border border-indigo-400/40 cursor-pointer">
              <i class="bi bi-robot text-sm"></i>
            </div>
          </button>

          <!-- 2. Track Pass / Token Button -->
          <a href="track.html" class="group relative flex items-center">
            <span class="absolute right-12 whitespace-nowrap bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none border border-slate-700">Track Status</span>
            <div class="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center shadow-xl transition-all duration-200 hover:scale-110 border border-slate-600 cursor-pointer">
              <i class="bi bi-search text-xs"></i>
            </div>
          </a>

          <!-- 3. Phone Call Button -->
          <a href="tel:+919361680077" class="group relative flex items-center">
            <span class="absolute right-12 whitespace-nowrap bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none border border-slate-700">Call Desk</span>
            <div class="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-xl transition-all duration-200 hover:scale-110 border border-blue-400/40 cursor-pointer">
              <i class="bi bi-telephone-fill text-xs"></i>
            </div>
          </a>

          <!-- 4. WhatsApp Support Button -->
          <a href="https://wa.me/919361680077?text=Hi%20SST%20Support%2C%20I%20have%20an%20inquiry" target="_blank" rel="noopener noreferrer" class="group relative flex items-center">
            <span class="absolute right-12 whitespace-nowrap bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none border border-slate-700">WhatsApp</span>
            <div class="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-xl transition-all duration-200 hover:scale-110 border border-emerald-300/40 cursor-pointer">
              <i class="bi bi-whatsapp text-sm"></i>
            </div>
          </a>
        </div>

        <!-- Main Speed-Dial Trigger Button -->
        <button id="btn-toggle-floating-help" onclick="window.toggleFloatingHelpMenu()" class="w-10 h-10 rounded-full bg-[#123B32] hover:bg-[#1A4B40] text-white shadow-2xl flex items-center justify-center border-2 border-white/20 transition-all duration-300 hover:scale-105 cursor-pointer relative group" title="Help & Support Menu">
          <div id="floating-help-icon-wrapper" class="relative flex items-center justify-center transition-transform duration-300">
            <i id="floating-help-icon" class="bi bi-headset text-lg text-emerald-300 group-hover:text-white transition-colors duration-200"></i>
            <span id="floating-help-ping" class="absolute -top-1 -right-1 flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
        </button>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHtml);
  };

  window.toggleFloatingHelpMenu = function () {
    const menu = document.getElementById('floating-help-menu');
    const icon = document.getElementById('floating-help-icon');
    const ping = document.getElementById('floating-help-ping');
    const btn = document.getElementById('btn-toggle-floating-help');
    if (!menu || !icon) return;

    const isHidden = menu.classList.contains('hidden');
    if (isHidden) {
      menu.classList.remove('hidden');
      void menu.offsetWidth; // trigger reflow for css transition
      menu.classList.remove('scale-90', 'opacity-0');
      menu.classList.add('flex', 'scale-100', 'opacity-100');
      
      icon.className = 'bi bi-x-lg text-lg text-white transition-all duration-300 transform rotate-90';
      if (ping) ping.style.display = 'none';
      if (btn) {
        btn.classList.remove('bg-[#123B32]', 'hover:bg-[#1A4B40]');
        btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
      }
    } else {
      menu.classList.remove('scale-100', 'opacity-100');
      menu.classList.add('scale-90', 'opacity-0');
      setTimeout(() => {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
      }, 200);

      icon.className = 'bi bi-headset text-lg text-emerald-300 group-hover:text-white transition-all duration-300 transform rotate-0';
      if (ping) ping.style.display = 'flex';
      if (btn) {
        btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        btn.classList.add('bg-[#123B32]', 'hover:bg-[#1A4B40]');
      }
    }
  };

  // Initialize on DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    window.initDynamicContent();
  });
})();
