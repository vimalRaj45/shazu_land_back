/**
 * Shazu Soft Technologies - Dynamic Content Engine & Telemetry Integration
 */

(function () {
  const API_BASE = (window.ENV && window.ENV.API_BASE) || '';

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

  // 2. Load Dynamic Announcements Top Bar (Moving Ticker with Left Announcements Button)
  window.allAnnouncementsList = [];
  async function loadAnnouncements() {
    const container = document.getElementById('dynamic-announcement-bar');
    if (!container) return;

    try {
      const res = await fetch(`${API_BASE}/api/public/announcements`);
      const data = await res.json();

      if (!data.announcements || data.announcements.length === 0) {
        container.innerHTML = '';
        return;
      }

      window.allAnnouncementsList = data.announcements;

      // Build announcement ticker items
      const itemsHtml = data.announcements.map(ann => `
        <div class="inline-flex items-center gap-3 px-6 py-0.5 shrink-0">
          <span class="px-2.5 py-0.5 rounded-full bg-[#C47D4C] text-white text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">${ann.badge_type || 'IMPORTANT'}</span>
          <span class="font-bold text-white text-xs">${ann.title}:</span>
          <span class="text-emerald-100 text-xs">${ann.content}</span>
          ${ann.link_url ? `<a href="${ann.link_url}" class="text-[11px] font-bold text-amber-300 hover:text-white underline transition-colors flex items-center gap-1"><span>Learn More</span> <i class="bi bi-arrow-right"></i></a>` : ''}
          <span class="text-emerald-700/60 font-mono text-xs mx-3">•</span>
        </div>
      `).join('');

      container.innerHTML = `
        <div class="bg-[#123B32] text-white border-b border-[#527A68]/40 py-1 px-4 overflow-hidden shadow-xs relative z-30 flex items-center gap-3">
          <!-- Left Fixed Announcements Trigger Button -->
          <a href="announcements.html" class="shrink-0 bg-[#C47D4C] hover:bg-[#a66439] text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1.5 cursor-pointer z-10 transition-colors">
            <i class="bi bi-megaphone-fill text-[10px]"></i>
            <span class="hidden sm:inline">Announcements</span>
            <span class="bg-white/20 px-1.5 py-0.2 rounded-full text-[9px] font-mono">${data.announcements.length}</span>
          </a>

          <!-- Continuous Scrolling Ticker -->
          <div class="flex-1 overflow-hidden">
            <div class="animate-marquee-track">
              ${itemsHtml}
              ${itemsHtml}
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.warn('Could not fetch dynamic announcements:', err);
    }
  }

  // 2b. Dedicated Announcements Inside Page Loader
  async function loadAnnouncementsPage() {
    const container = document.getElementById('dynamic-all-announcements-container');
    if (!container) return;

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
  async function loadCareers() {
    const container = document.getElementById('dynamic-jobs-container');
    if (!container) return;

    // Render Animated Skeleton Loader Cards
    container.innerHTML = `
      <div class="animate-pulse bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
        <div class="flex justify-between items-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-24"></div><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-20"></div></div>
        <div class="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4"></div>
        <div class="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-2xl"></div>
        <div class="h-10 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
      </div>
      <div class="animate-pulse bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm hidden sm:block">
        <div class="flex justify-between items-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-24"></div><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-20"></div></div>
        <div class="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4"></div>
        <div class="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-2xl"></div>
        <div class="h-10 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
      </div>
    `;

    try {
      const res = await fetch(`${API_BASE}/api/public/careers`);
      const data = await res.json();

      if (!data.jobs || data.jobs.length === 0) {
        container.innerHTML = `
          <div class="col-span-full text-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p class="text-sm text-slate-500">Currently no active job openings. Check back soon!</p>
          </div>
        `;
        return;
      }

      container.innerHTML = data.jobs.map(job => {
        const coverImg = job.image_url || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80';
        return `
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between overflow-hidden group">
            <!-- Job Cover Image Header -->
            <div class="h-40 w-full relative overflow-hidden bg-slate-100">
              <img src="${coverImg}" alt="${job.title}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <div class="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white">
                <span class="px-3 py-1 bg-[#123B32]/90 backdrop-blur-md text-white font-bold text-[10px] rounded-full uppercase tracking-wider">${job.department}</span>
                <span class="text-xs font-mono font-bold text-amber-300 bg-black/50 px-2 py-0.5 rounded backdrop-blur-xs">${job.salary_range}</span>
              </div>
            </div>

            <div class="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div class="space-y-3">
                <h3 class="text-xl font-bold font-heading text-[#0F172A] dark:text-white group-hover:text-[#123B32] dark:group-hover:text-emerald-400 transition-colors">${job.title}</h3>
                <div class="flex items-center gap-4 text-xs text-slate-500 font-medium">
                  <span><i class="bi bi-briefcase text-[#123B32] mr-1"></i> ${job.job_type}</span>
                  <span><i class="bi bi-geo-alt-fill text-[#123B32] mr-1"></i> ${job.location}</span>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${job.description}</p>
                ${job.requirements ? `
                  <div class="pt-2">
                    <span class="block text-[11px] font-bold uppercase text-slate-400 mb-1">Requirements & Skills</span>
                    <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">${job.requirements}</p>
                  </div>
                ` : ''}
              </div>
              <button onclick="openApplyModal('${job.id}', '${encodeURIComponent(job.title)}')" class="w-full py-3 bg-[#123B32] hover:bg-[#C47D4C] text-white font-bold text-xs rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-xl cursor-pointer">
                <i class="bi bi-file-earmark-person text-sm"></i>
                <span>Apply For Position</span>
                <i class="bi bi-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.warn('Could not fetch dynamic careers:', err);
    }
  }

  // 4. Load Dynamic Events Listing
  async function loadEvents() {
    const container = document.getElementById('dynamic-events-container');
    if (!container) return;

    // Render Animated Skeleton Loader Cards
    container.innerHTML = `
      <div class="animate-pulse bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
        <div class="flex justify-between items-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-24"></div><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-16"></div></div>
        <div class="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4"></div>
        <div class="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-2xl"></div>
        <div class="h-10 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
      </div>
      <div class="animate-pulse bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm hidden sm:block">
        <div class="flex justify-between items-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-24"></div><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-16"></div></div>
        <div class="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4"></div>
        <div class="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-2xl"></div>
        <div class="h-10 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
      </div>
      <div class="animate-pulse bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm hidden lg:block">
        <div class="flex justify-between items-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-24"></div><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-16"></div></div>
        <div class="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4"></div>
        <div class="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-2xl"></div>
        <div class="h-10 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
      </div>
    `;

    try {
      const res = await fetch(`${API_BASE}/api/public/events`);
      const data = await res.json();

      if (!data.events || data.events.length === 0) {
        container.innerHTML = `
          <div class="col-span-full text-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p class="text-sm text-slate-500">No upcoming events at this moment.</p>
          </div>
        `;
        return;
      }

      window.allEventsData = data.events || [];
      renderEventsList(window.allEventsData);
    } catch (err) {
      console.warn('Could not fetch dynamic events:', err);
    }
  }

  window.renderEventsList = function (eventsList) {
    const container = document.getElementById('dynamic-events-container');
    if (!container) return;

    if (!eventsList || eventsList.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div class="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-2xl">
            <i class="bi bi-calendar-x"></i>
          </div>
          <h4 class="text-base font-bold text-slate-800 dark:text-white">No Matching Events Found</h4>
          <p class="text-xs text-slate-500 max-w-sm mx-auto">Try adjusting your search query or selecting a different event category filter.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = eventsList.map(ev => {
      const fee = ev.registration_fee || 'Free';
      const isPaid = fee !== 'Free' && fee !== '0' && fee !== '';
      const defaultImg = ev.category && ev.category.toLowerCase().includes('hackathon') ? 
        'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80' : 
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80';
      const eventImg = ev.image_url || defaultImg;

      return `
        <div class="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
          <!-- Event Cover Image Banner -->
          <div class="h-44 w-full relative overflow-hidden bg-slate-100">
            <img src="${eventImg}" alt="${ev.title}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            
            <!-- Category & Status Overlay Badges -->
            <div class="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
              <span class="px-3 py-1 bg-black/60 backdrop-blur-md text-white font-extrabold text-[10px] rounded-full uppercase tracking-wider border border-white/20">
                <i class="bi bi-tag-fill text-[9px] mr-1 text-emerald-400"></i>${ev.category || 'Event'}
              </span>
              <span class="px-3 py-1 ${isPaid ? 'bg-amber-500 text-white font-bold' : 'bg-emerald-600 text-white font-bold'} text-xs rounded-full shadow-md font-mono">
                ${fee}
              </span>
            </div>
            
            <!-- Date Overlay on Image -->
            <div class="absolute bottom-3 left-4 text-white">
              <span class="block text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5">
                <i class="bi bi-calendar3"></i> ${ev.event_date || 'TBA'}
              </span>
            </div>
          </div>

          <div class="p-6 space-y-4 flex-1 flex flex-col justify-between">
            <div class="space-y-3">
              <!-- Title -->
              <h3 class="text-lg font-bold font-heading text-slate-900 dark:text-white group-hover:text-[#123B32] dark:group-hover:text-emerald-400 transition-colors leading-snug">
                ${ev.title}
              </h3>

              <!-- Venue Details -->
              <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <i class="bi bi-geo-alt-fill text-[#123B32] dark:text-emerald-400"></i>
                <span class="truncate">${ev.location || 'Salem, Tamil Nadu'}</span>
              </div>

              <!-- Description -->
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
                ${ev.description}
              </p>
            </div>

            <!-- Register Button -->
            <button onclick="openRegisterModal('${ev.id}', '${encodeURIComponent(ev.title)}', '${encodeURIComponent(fee)}')" class="w-full py-3 bg-[#123B32] hover:bg-[#C47D4C] text-white font-bold text-xs rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-xl cursor-pointer">
              <i class="bi bi-ticket-perforated text-sm"></i>
              <span>Register For Event</span>
              <i class="bi bi-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
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

  // 5. Global Modal Helpers for Apply & Event Register
  window.openApplyModal = function (jobId, encodedTitle) {
    const title = decodeURIComponent(encodedTitle);
    const modalHtml = `
      <div id="public-modal-backdrop" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 border border-[#D3DDD7] dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 text-[#0F172A] dark:text-slate-100 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 class="text-lg sm:text-xl font-black font-heading text-[#0F172A] dark:text-white leading-tight">Apply for ${title}</h3>
              <p class="text-xs text-[#527A68] dark:text-emerald-400 font-semibold mt-0.5">Shazu Soft Technologies Hiring Portal</p>
            </div>
            <button onclick="closePublicModal()" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"><i class="bi bi-x-lg text-sm pointer-events-none"></i></button>
          </div>
          <form onsubmit="submitJobApplication(event, '${jobId}', '${encodedTitle}')" class="space-y-3.5 text-xs">
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
                <label class="block font-bold text-xs text-[#1E292B] dark:text-slate-200 mb-1.5">Phone Number</label>
                <input type="tel" id="pub-app-phone" placeholder="+91 98765 43210" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32] dark:focus:border-emerald-500 font-sans transition-all">
              </div>
            </div>
            <div>
              <label class="block font-bold text-xs text-[#1E292B] dark:text-slate-200 mb-1.5">Upload Resume / Portfolio Document (Max 10 MB)</label>
              <input type="file" id="pub-app-resume-file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onchange="handlePublicResumeUpload(event)" class="w-full p-2.5 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-slate-300 cursor-pointer">
              <input type="hidden" id="pub-app-resume" value="">
              <div id="pub-resume-preview" class="hidden pt-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <i class="bi bi-file-earmark-check-fill text-sm"></i>
                <span id="pub-resume-filename">File attached</span>
              </div>
            </div>
            <div>
              <label class="block font-bold text-xs text-[#1E292B] dark:text-slate-200 mb-1.5">Cover Note / Brief Intro</label>
              <textarea id="pub-app-msg" placeholder="Tell us why you are a great fit for SST..." class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 h-24 focus:outline-none focus:border-[#123B32] dark:focus:border-emerald-500 font-sans transition-all"></textarea>
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

  window.openRegisterModal = function (eventId, encodedTitle, encodedFee = 'Free') {
    const title = decodeURIComponent(encodedTitle);
    const fee = decodeURIComponent(encodedFee);
    const isPaid = fee !== 'Free' && fee !== '0' && fee !== '';

    const modalHtml = `
      <div id="public-modal-backdrop" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 border border-[#D3DDD7] dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 text-[#0F172A] dark:text-slate-100 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 class="text-lg sm:text-xl font-black font-heading text-[#0F172A] dark:text-white leading-tight">Register for ${title}</h3>
              <p class="text-xs text-[#527A68] dark:text-emerald-400 font-semibold mt-0.5">SST Event & Contest Registration</p>
            </div>
            <button onclick="closePublicModal()" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"><i class="bi bi-x-lg text-sm pointer-events-none"></i></button>
          </div>

          ${isPaid ? `
            <div class="bg-[#E8EFEB] dark:bg-emerald-950/50 border border-[#D3DDD7] dark:border-emerald-800 p-4 rounded-2xl space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-[#123B32] dark:text-emerald-300">Registration Fee Required</span>
                <span class="px-3 py-1 bg-[#123B32] text-white font-mono font-bold text-xs rounded-lg">${fee}</span>
              </div>
              <div class="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-emerald-900/50">
                <div class="bg-white p-1.5 rounded-lg shadow-xs border border-slate-200">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=upi://pay?pa=shazusofttechnologies@upi%26pn=ShazuSoftTechnologies%26am=499%26cu=INR" alt="UPI QR Code" class="w-24 h-24">
                </div>
                <div class="space-y-1 text-center sm:text-left text-xs">
                  <span class="block font-bold text-[#0F172A] dark:text-white">Pay via any UPI App (GPay / PhonePe / Paytm)</span>
                  <span class="block font-mono font-bold text-[#123B32] dark:text-emerald-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">UPI ID: shazusofttechnologies@upi</span>
                  <span class="block text-[11px] text-slate-500">Scan QR or use UPI ID, complete payment, and enter your 12-digit UTR / Ref No below.</span>
                </div>
              </div>
            </div>
          ` : ''}

          <form onsubmit="submitEventRegistration(event, '${eventId}', '${encodedTitle}', '${encodedFee}')" class="space-y-3.5 text-xs">
            <div>
              <label class="block font-bold text-xs text-[#1E292B] dark:text-slate-200 mb-1.5">Full Name *</label>
              <input type="text" id="pub-reg-name" required placeholder="Jane Doe" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32] dark:focus:border-emerald-500 font-sans transition-all">
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label class="block font-bold text-xs text-[#1E292B] dark:text-slate-200 mb-1.5">Email Address *</label>
                <input type="email" id="pub-reg-email" required placeholder="jane@example.com" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32] dark:focus:border-emerald-500 font-sans transition-all">
              </div>
              <div>
                <label class="block font-bold text-xs text-[#1E292B] dark:text-slate-200 mb-1.5">Phone Number *</label>
                <input type="tel" id="pub-reg-phone" required placeholder="+91 98765 43210" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32] dark:focus:border-emerald-500 font-sans transition-all">
              </div>
            </div>
            <div>
              <label class="block font-bold text-xs text-[#1E292B] dark:text-slate-200 mb-1.5">College / Organization</label>
              <input type="text" id="pub-reg-org" placeholder="Anna University / SST Tech" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#D3DDD7] dark:border-slate-800 rounded-xl text-xs text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#123B32] dark:focus:border-emerald-500 font-sans transition-all">
            </div>

            ${isPaid ? `
              <div>
                <label class="block font-bold text-xs text-[#1E292B] dark:text-slate-200 mb-1.5">UPI Transaction / UTR No *</label>
                <input type="text" id="pub-reg-utr" required placeholder="e.g. 423589102456" class="w-full p-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-[#0F172A] dark:text-white focus:outline-none focus:border-[#123B32] font-mono">
                <span class="text-[10px] text-slate-500 mt-1 block">Find 12-digit UTR in GPay / PhonePe payment receipt.</span>
              </div>
            ` : ''}

            <div class="flex justify-end items-center gap-3 pt-2">
              <button type="button" onclick="closePublicModal()" class="px-5 py-2.5 bg-[#F1F5F3] hover:bg-[#E2E8F0] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#0F172A] dark:text-slate-300 rounded-xl font-bold text-xs transition-all cursor-pointer">Cancel</button>
              <button type="submit" class="px-6 py-2.5 bg-[#123B32] hover:bg-[#1A4B40] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-extrabold rounded-xl transition-all shadow-md text-xs inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                <span>Complete Registration</span>
              </button>
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
  };

  window.submitJobApplication = async function (e, jobId, encodedTitle) {
    e.preventDefault();
    const title = decodeURIComponent(encodedTitle);
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Submit Application';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-white inline-block mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg><span>Submitting...</span>`;
    }

    const body = {
      job_id: jobId,
      job_title: title,
      applicant_name: document.getElementById('pub-app-name').value,
      email: document.getElementById('pub-app-email').value,
      phone: document.getElementById('pub-app-phone').value,
      resume_url: document.getElementById('pub-app-resume').value,
      message: document.getElementById('pub-app-msg').value
    };

    try {
      const res = await fetch(`${API_BASE}/api/public/careers/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      closePublicModal();
      showPublicModalNotice('Application Submitted!', 'Your job application has been successfully submitted to Shazu Soft Technologies! Our hiring team will review it shortly.');
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
      showPublicModalNotice('Submission Error', err.message, true);
    }
  };

  window.submitEventRegistration = async function (e, eventId, encodedTitle, encodedFee = 'Free') {
    e.preventDefault();
    const title = decodeURIComponent(encodedTitle);
    const fee = decodeURIComponent(encodedFee);
    const utrEl = document.getElementById('pub-reg-utr');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Complete Registration';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-white inline-block mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg><span>Registering...</span>`;
    }

    const body = {
      event_id: eventId,
      event_title: title,
      name: document.getElementById('pub-reg-name').value,
      email: document.getElementById('pub-reg-email').value,
      phone: document.getElementById('pub-reg-phone').value,
      organization: document.getElementById('pub-reg-org').value,
      registration_fee: fee,
      payment_method: 'UPI QR',
      transaction_id: utrEl ? utrEl.value : ''
    };

    try {
      const res = await fetch(`${API_BASE}/api/public/events/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      closePublicModal();
      showPublicModalNotice('Registration Confirmed!', 'You have successfully registered for the event! A confirmation pass has been sent to your email.');
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
      showPublicModalNotice('Registration Error', err.message, true);
    }
  };

  window.showPublicModalNotice = function (title, message, isError = false) {
    if (window.toast) {
      if (isError) {
        window.toast.error(`${title}: ${message}`, { position: 'top-center' });
      } else {
        window.toast.success(`${title} ${message}`, { position: 'top-center' });
      }
      return;
    }

    const modalHtml = `
      <div id="public-notice-backdrop" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4 text-center">
          <div class="w-12 h-12 rounded-full ${isError ? 'bg-red-100 dark:bg-red-950 text-red-600' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'} flex items-center justify-center mx-auto text-2xl">
            <i class="bi bi-${isError ? 'x-circle-fill' : 'check-circle-fill'}"></i>
          </div>
          <div class="space-y-1">
            <h3 class="text-lg font-bold font-heading text-slate-900 dark:text-white">${title}</h3>
            <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${message}</p>
          </div>
          <button onclick="document.getElementById('public-notice-backdrop').remove()" class="w-full py-2.5 bg-[#123B32] hover:bg-[#2F5B4E] text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer">OK, Got It</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  window.submitContactInquiry = async function (name, email, phone, subject, service_category, message) {
    try {
      const res = await fetch(`${API_BASE}/api/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, subject, service_category, message })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit inquiry');
      showPublicModalNotice('Message Sent!', 'Thank you for reaching out! We have received your message and sent a confirmation to your email address.');
      return true;
    } catch (err) {
      showPublicModalNotice('Submission Error', err.message, true);
      return false;
    }
  };

  // Reusable Dynamic Content Initialization for initial page load and SPA navigation
  window.initDynamicContent = function() {
    trackPageView();
    loadAnnouncements();
    loadAnnouncementsPage();
    loadCareers();
    loadEvents();

    // Event Search Input Listener
    const searchInput = document.getElementById('event-search');
    if (searchInput && !searchInput.dataset.spaBound) {
      searchInput.dataset.spaBound = 'true';
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (!window.allEventsData) return;
        const filtered = window.allEventsData.filter(ev => 
          ev.title.toLowerCase().includes(query) || 
          ev.category.toLowerCase().includes(query) || 
          ev.location.toLowerCase().includes(query) ||
          ev.description.toLowerCase().includes(query)
        );
        renderEventsList(filtered);
      });
    }

    // Category Filter Pills Listener
    const filterPills = document.querySelectorAll('.event-filter-pill');
    filterPills.forEach(pill => {
      if (pill.dataset.spaBound) return;
      pill.dataset.spaBound = 'true';
      pill.addEventListener('click', (e) => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const filter = pill.getAttribute('data-filter') || 'all';
        if (!window.allEventsData) return;

        if (filter === 'all') {
          renderEventsList(window.allEventsData);
        } else {
          const filtered = window.allEventsData.filter(ev => {
            const cat = ev.category.toLowerCase();
            if (filter === 'technology' || filter === 'hackathons') return cat.includes('hackathon') || cat.includes('workshop') || cat.includes('tech') || cat.includes('engineering');
            if (filter === 'medical') return cat.includes('medical') || cat.includes('health');
            if (filter === 'business') return cat.includes('business') || cat.includes('management') || cat.includes('webinar');
            if (filter === 'humanities') return cat.includes('humanities') || cat.includes('education');
            return cat.includes(filter);
          });
          renderEventsList(filtered);
        }
      });
    });

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
  };

  // Initialize on DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    window.initDynamicContent();
  });
})();
