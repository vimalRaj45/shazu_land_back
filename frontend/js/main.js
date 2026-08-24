// ==========================================================================
// Shazu Soft Technologies - Core Engine & Seamless SPA Page Router
// ==========================================================================

// Global Mobile Drawer Controller
window.toggleMobileDrawer = function(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileBackdrop = document.getElementById('mobile-backdrop');
  const menuBtn = document.getElementById('mobile-menu-btn');

  if (mobileMenu && mobileBackdrop) {
    const isActive = mobileMenu.classList.contains('active');
    if (isActive) {
      mobileMenu.classList.remove('active');
      mobileBackdrop.classList.remove('active');
      if (menuBtn) menuBtn.classList.remove('open');
      document.body.style.overflow = '';
    } else {
      mobileMenu.classList.add('active');
      mobileBackdrop.classList.add('active');
      if (menuBtn) menuBtn.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }
};

window.closeMobileDrawer = function(e) {
  if (e && e.stopPropagation) {
    e.stopPropagation();
  }
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileBackdrop = document.getElementById('mobile-backdrop');
  const menuBtn = document.getElementById('mobile-menu-btn');
  if (mobileMenu) mobileMenu.classList.remove('active');
  if (mobileBackdrop) mobileBackdrop.classList.remove('active');
  if (menuBtn) menuBtn.classList.remove('open');
  document.body.style.overflow = '';
};

// Global Toast Feedback Helper
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-5 right-5 px-3.5 py-2 rounded-md shadow-md z-50 text-[11px] font-medium text-white transition-all duration-200 transform translate-y-6 opacity-0 flex items-center gap-2 border ${
    type === 'success' ? 'bg-[#123B32] border-[#2F5B4E]' : 'bg-red-700 border-red-800'
  }`;
  toast.innerHTML = `<i class="bi ${type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'} text-xs"></i> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-6', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('translate-y-6', 'opacity-0');
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}
window.showToast = showToast;

// Global Success Modal Helper
function showSuccessModal(title, text) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4 animate-fade-in';
  modal.innerHTML = `
    <div class="bg-white dark:bg-[#1e293b] rounded-xl shadow-xl max-w-md w-full p-6 text-center transform transition-transform duration-300 scale-95 border border-brand-border dark:border-slate-700">
      <div class="w-16 h-16 bg-[#E8EFEB] dark:bg-emerald-950 text-[#123B32] dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
        <i class="bi bi-check-circle-fill text-3xl"></i>
      </div>
      <h3 class="text-2xl font-bold text-[#0F172A] dark:text-white mb-2 font-heading">${title}</h3>
      <p class="text-[#334E43] dark:text-slate-300 mb-6 text-sm">${text}</p>
      <button id="close-modal-btn" class="bg-[#123B32] hover:bg-[#2F5B4E] text-white font-medium px-6 py-2.5 rounded-lg w-full transition-all duration-200 cursor-pointer">
        Close
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  setTimeout(() => {
    modal.querySelector('div').classList.remove('scale-95');
    modal.querySelector('div').classList.add('scale-100');
  }, 10);

  const closeBtn = modal.querySelector('#close-modal-btn');
  closeBtn.addEventListener('click', () => {
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.remove(), 200);
  });
}
window.showSuccessModal = showSuccessModal;

// Active Navigation Sync (Header Desktop Nav & Mobile Drawer)
function syncActiveNavLinks() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  // Desktop Navbar Links
  document.querySelectorAll('header nav a').forEach(link => {
    const href = (link.getAttribute('href') || '').split('#')[0];
    const isCurrent = href === currentPath || (currentPath === '' && href === 'index.html');
    if (isCurrent && !link.classList.contains('nav-dropdown-item')) {
      link.classList.add('text-[#123B32]', 'font-extrabold');
    }
  });

  // Mobile Drawer Links
  document.querySelectorAll('aside#mobile-menu nav a').forEach(link => {
    const href = (link.getAttribute('href') || '').split('#')[0];
    const isCurrent = href === currentPath || (currentPath === '' && href === 'index.html');
    if (isCurrent) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
      const dot = link.querySelector('.w-1\\.5.h-1\\.5, .rounded-full.bg-\\[\\#123B32\\]');
      if (dot && dot.parentElement === link) dot.remove();
    }
  });
}

// 1. Mobile Drawer Listeners
function initMobileDrawer() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const closeBtn = document.getElementById('mobile-close-btn');
  const mobileBackdrop = document.getElementById('mobile-backdrop');
  const mobileMenu = document.getElementById('mobile-menu');

  if (menuBtn && !menuBtn.dataset.bound) {
    menuBtn.dataset.bound = 'true';
    menuBtn.addEventListener('click', window.toggleMobileDrawer);
  }
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = 'true';
    closeBtn.addEventListener('click', window.closeMobileDrawer);
  }
  if (mobileBackdrop && !mobileBackdrop.dataset.bound) {
    mobileBackdrop.dataset.bound = 'true';
    mobileBackdrop.addEventListener('click', window.closeMobileDrawer);
  }

  if (mobileMenu && !mobileMenu.dataset.bound) {
    mobileMenu.dataset.bound = 'true';
    mobileMenu.querySelectorAll('.mobile-accordion-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const accordion = toggle.closest('.mobile-accordion');
        const menu = accordion ? accordion.querySelector('.mobile-accordion-menu') : null;
        const arrow = toggle.querySelector('.accordion-arrow');

        if (menu) {
          const isHidden = menu.classList.contains('hidden');
          document.querySelectorAll('.mobile-accordion-menu').forEach(m => {
            if (m !== menu) m.classList.add('hidden');
          });
          document.querySelectorAll('.accordion-arrow').forEach(a => {
            if (a !== arrow) a.classList.remove('rotate-180');
          });

          if (isHidden) {
            menu.classList.remove('hidden');
            if (arrow) arrow.classList.add('rotate-180');
          } else {
            menu.classList.add('hidden');
            if (arrow) arrow.classList.remove('rotate-180');
          }
        }
      });
    });
  }
}

// 2. Sticky Glassmorphic Navbar on Scroll
function initNavbarScroll() {
  const header = document.querySelector('header');
  if (header && !header.dataset.bound) {
    header.dataset.bound = 'true';
    window.addEventListener('scroll', () => {
      if (window.scrollY > 10) {
        header.classList.add('glassmorphism', 'shadow-sm');
        header.classList.remove('bg-white');
      } else {
        header.classList.remove('glassmorphism', 'shadow-sm');
        header.classList.add('bg-white');
      }
    });
  }
}

// 3. Contact & Membership Form Handlers
function initForms() {
  const contactForm = document.getElementById('contact-form');
  if (contactForm && !contactForm.dataset.mainBound) {
    contactForm.dataset.mainBound = 'true';
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const name = (document.getElementById('contact-name') || document.getElementById('name'))?.value?.trim();
      const email = (document.getElementById('contact-email') || document.getElementById('email'))?.value?.trim();
      const phone = (document.getElementById('contact-phone') || document.getElementById('phone'))?.value?.trim() || '';
      const subject = (document.getElementById('contact-subject') || document.getElementById('subject'))?.value?.trim() || 'General Inquiry';
      const category = (document.getElementById('contact-category') || document.getElementById('service_category'))?.value || 'General';
      const message = (document.getElementById('contact-message') || document.getElementById('message'))?.value?.trim();

      if (!name || !email || !message) {
        if (typeof window.showPublicModalNotice === 'function') {
          window.showPublicModalNotice('Required Fields Missing', 'Please fill in all required fields (Name, Email, and Message).', true);
        } else if (typeof showToast === 'function') {
          showToast('Please fill in Name, Email, and Message.', 'error');
        }
        return;
      }

      if (typeof window.submitContactInquiry === 'function') {
        const success = await window.submitContactInquiry(name, email, phone, subject, category, message);
        if (success) contactForm.reset();
      }
    });
  }

  // membership-form submission is handled directly via onsubmit in membership.html & dynamic-content.js
}

// 4. Events Search & Filtering (events.html)
function initEventsFilter() {
  if (typeof window.applyEventFilters === 'function') {
    return;
  }
}

// 5. Hero Image Slider & Fullscreen Lightbox Modal (index.html)
let currentHeroSliderInterval = null;
async function initHeroSlider() {
  if (currentHeroSliderInterval) {
    clearInterval(currentHeroSliderInterval);
    currentHeroSliderInterval = null;
  }

  const sliderContainer = document.getElementById('hero-slider');
  const dotsContainer = document.getElementById('slider-dots');

  if (sliderContainer) {
    let slidesToRender = [];

    try {
      const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? (window.location.port === '5000' ? '' : 'http://localhost:5000') 
        : (window.ENV?.API_BASE || 'https://shazu-land-back.onrender.com');

      const res = await fetch(`${API_BASE}/api/public/slider`);
      if (res.ok) {
        const data = await res.json();
        if (data.slides && data.slides.length > 0) {
          slidesToRender = data.slides;
        }
      }
    } catch (err) {
      console.warn('Hero slider database fetch notice:', err);
    }

    // Default fallback if database has not returned slides yet
    if (slidesToRender.length === 0) {
      slidesToRender = [
        { badge: 'INAUGURATION', title: 'Official Launch & Keynote Ceremony', image_url: 'images/MDwith Inaugural.jpeg' },
        { badge: 'TECH INNOVATION', title: 'Engineering Summits & Applied Projects', image_url: 'images/mahendra.jpeg' },
        { badge: 'DELEGATIONS', title: 'Professional Memberships & Global Academic Network', image_url: 'images/member.jpeg' },
        { badge: 'COLLABORATIONS', title: 'Institutional MoUs & Research Partnerships', image_url: 'images/moui.jpeg' },
        { badge: 'TECH PLATFORM', title: 'AI, Software & Cloud Ecosystem', image_url: 'images/software.png' }
      ];
    }

    // Render Dynamic Slides
    sliderContainer.innerHTML = slidesToRender.map((s, idx) => `
      <div class="slider-slide ${idx === 0 ? 'active' : ''} absolute inset-0 flex items-center justify-center overflow-hidden" data-slide-index="${idx}">
        <img src="${s.image_url}" alt="${s.title}" class="slider-img-trigger relative z-10 w-full h-full object-cover p-0 cursor-pointer" title="Click to view full image in modal" />
        
        <button class="expand-slide-btn absolute top-3.5 left-3.5 bg-black/45 hover:bg-[#123B32] text-white text-[11px] font-semibold px-3 py-1.5 rounded-full border border-white/25 backdrop-blur-md flex items-center gap-1.5 z-20 cursor-pointer shadow-md transition-all duration-200 hover:scale-105" title="Click to view full image">
          <i class="bi bi-arrows-fullscreen text-[10px]"></i>
          <span>View Full</span>
        </button>

        <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-14 pb-8 px-5 sm:px-6 z-10 pointer-events-none">
          <span class="slider-badge text-[10px] font-extrabold uppercase tracking-widest text-white bg-[#C47D4C] px-2.5 py-0.5 rounded-full inline-block mb-1.5 shadow-xs">${s.badge || 'EVENT'}</span>
          <h4 class="slider-title font-heading font-black text-sm sm:text-base md:text-lg text-white leading-snug drop-shadow-sm truncate" style="color: #FFFFFF !important;">${s.title}</h4>
        </div>
      </div>
    `).join('');

    // Render Dynamic Dots
    if (dotsContainer) {
      dotsContainer.innerHTML = slidesToRender.map((_, idx) => `
        <span class="slider-dot ${idx === 0 ? 'w-6 bg-[#C47D4C]' : 'w-2 bg-white/40'} h-2 rounded-full cursor-pointer transition-all duration-300" data-slide="${idx}"></span>
      `).join('');
    }
  }

  const slides = document.querySelectorAll('.slider-slide');
  const prevBtn = document.getElementById('slider-prev');
  const nextBtn = document.getElementById('slider-next');
  const dots = document.querySelectorAll('.slider-dot');
  const modal = document.getElementById('hero-image-modal');
  const modalImg = document.getElementById('modal-image-preview');
  const modalTitle = document.getElementById('modal-title');
  const modalBadge = document.getElementById('modal-badge');
  const modalCounter = document.getElementById('modal-counter');
  const closeBtn = document.getElementById('close-hero-modal');
  const modalPrevBtn = document.getElementById('modal-prev-btn');
  const modalNextBtn = document.getElementById('modal-next-btn');

  if (slides.length > 0) {
    let activeSlideIndex = 0;

    const updateModalContent = (index) => {
      const activeSlide = slides[index];
      if (!activeSlide || !modalImg) return;
      const img = activeSlide.querySelector('img');
      const titleEl = activeSlide.querySelector('.slider-title') || activeSlide.querySelector('h4');
      const badgeEl = activeSlide.querySelector('.slider-badge') || activeSlide.querySelector('span');

      if (img) modalImg.src = img.src;
      if (titleEl && modalTitle) modalTitle.textContent = titleEl.textContent.trim();
      if (badgeEl && modalBadge) {
        modalBadge.textContent = badgeEl.textContent.trim();
        modalBadge.className = badgeEl.className; // sync vibrant theme color badge
      }
      if (modalCounter) modalCounter.textContent = `${index + 1} / ${slides.length}`;
    };

    const showSlide = (index) => {
      slides.forEach(s => s.classList.remove('active'));
      dots.forEach(d => {
        d.classList.remove('w-6', 'bg-[#C47D4C]', 'shadow-sm');
        d.classList.add('w-2', 'bg-white/40');
      });

      activeSlideIndex = (index + slides.length) % slides.length;
      slides[activeSlideIndex].classList.add('active');
      if (dots[activeSlideIndex]) {
        dots[activeSlideIndex].classList.remove('w-2', 'bg-white/40');
        dots[activeSlideIndex].classList.add('w-6', 'bg-[#C47D4C]', 'shadow-sm');
      }

      if (modal && !modal.classList.contains('hidden')) {
        updateModalContent(activeSlideIndex);
      }
    };

    const openModal = (index) => {
      if (!modal) return;
      activeSlideIndex = index;
      showSlide(index);
      updateModalContent(index);
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
      clearInterval(currentHeroSliderInterval);
    };

    const closeModal = () => {
      if (!modal) return;
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
      resetAutoSlide();
    };

    const nextSlide = () => showSlide(activeSlideIndex + 1);
    const prevSlide = () => showSlide(activeSlideIndex - 1);

    if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); nextSlide(); resetAutoSlide(); };
    if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); prevSlide(); resetAutoSlide(); };

    dots.forEach((dot, idx) => {
      dot.onclick = (e) => {
        e.stopPropagation();
        showSlide(idx);
        resetAutoSlide();
      };
    });

    // Make slide images and buttons open the full modal preview
    slides.forEach((slide, idx) => {
      const triggers = slide.querySelectorAll('.slider-img-trigger, img, .expand-slide-btn');
      triggers.forEach(trigger => {
        trigger.onclick = (e) => {
          e.stopPropagation();
          openModal(idx);
        };
      });
    });

    // Milestone Video Card opens inauguration full modal
    const milestoneVideoCard = document.querySelector('[aria-label*="Inauguration Video"]') || document.querySelector('.video-card-overlay')?.parentElement;
    if (milestoneVideoCard) {
      milestoneVideoCard.onclick = () => openModal(0);
    }

    if (closeBtn) closeBtn.onclick = closeModal;
    if (modalPrevBtn) modalPrevBtn.onclick = (e) => { e.stopPropagation(); prevSlide(); };
    if (modalNextBtn) modalNextBtn.onclick = (e) => { e.stopPropagation(); nextSlide(); };

    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal || e.target.id === 'modal-backdrop-area') {
          closeModal();
        }
      };
    }

    // Keyboard controls for modal navigation
    document.addEventListener('keydown', (e) => {
      if (!modal || modal.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    });

    const startAutoSlide = () => {
      currentHeroSliderInterval = setInterval(nextSlide, 5000);
    };

    const resetAutoSlide = () => {
      clearInterval(currentHeroSliderInterval);
      startAutoSlide();
    };

    startAutoSlide();
  }
}

// 6. Hero Typewriter Effect (index.html)
let currentTypewriterTimeout = null;
function initHeroTypewriter() {
  if (currentTypewriterTimeout) {
    clearTimeout(currentTypewriterTimeout);
    currentTypewriterTimeout = null;
  }

  const typewriterText = document.getElementById('typewriter-text');
  if (typewriterText) {
    const phrases = ["Practical Excellence", "Academic Innovation", "Digital Transformation", "Research Advancement"];
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typeSpeed = 80;

    const typeLoop = () => {
      const currentPhrase = phrases[phraseIndex];
      if (isDeleting) {
        typewriterText.textContent = currentPhrase.substring(0, charIndex - 1);
        charIndex--;
        typeSpeed = 40;
      } else {
        typewriterText.textContent = currentPhrase.substring(0, charIndex + 1);
        charIndex++;
        typeSpeed = 80;
      }

      if (!isDeleting && charIndex === currentPhrase.length) {
        isDeleting = true;
        typeSpeed = 2000;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typeSpeed = 400;
      }

      currentTypewriterTimeout = setTimeout(typeLoop, typeSpeed);
    };

    currentTypewriterTimeout = setTimeout(typeLoop, 800);
  }
}

// 7. Statistics Counter Animation
function initCounters() {
  const counters = document.querySelectorAll('.stat-counter');
  if (counters.length > 0) {
    const formatNum = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    const runCounter = (counter) => {
      const target = +counter.getAttribute('data-target');
      if (isNaN(target)) return;
      const duration = 1500;
      const stepTime = 25;
      const steps = duration / stepTime;
      const increment = target / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          clearInterval(timer);
          counter.textContent = formatNum(target) + "+";
        } else {
          counter.textContent = formatNum(Math.floor(current)) + "+";
        }
      }, stepTime);
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            runCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3 });

      counters.forEach(c => observer.observe(c));
    } else {
      counters.forEach(c => {
        const target = c.getAttribute('data-target');
        c.textContent = formatNum(target) + "+";
      });
    }
  }
}

// 8. AOS Initialization and Fallback
function initAOS() {
  try {
    if (typeof AOS !== 'undefined') {
      AOS.init({
        duration: 600,
        once: true,
        easing: 'ease-out-quad'
      });
      AOS.refreshHard();
    } else {
      throw new Error("AOS script not available.");
    }
  } catch (e) {
    document.querySelectorAll('[data-aos]').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.transition = 'none';
    });
  }
}

// 9. Auto-Format Brand Logo Subtitle Exact Width Across All Devices
function initBrandSubtitles() {
  document.querySelectorAll('header a, footer a, aside#mobile-menu a').forEach(brandLink => {
    const divs = brandLink.querySelectorAll(':scope > div');
    divs.forEach(container => {
      const spans = container.querySelectorAll(':scope > span');
      if (spans.length >= 2) {
        container.classList.add('brand-text-container');
        const titleSpan = spans[0];
        const subSpan = spans[1];
        titleSpan.classList.add('brand-title-text');
        subSpan.classList.add('brand-sub-text');
        if (subSpan.textContent.trim().toUpperCase() === 'TECHNOLOGIES' && !subSpan.querySelector('span')) {
          subSpan.innerHTML = 'TECHNOLOGIES'.split('').map(c => `<span>${c}</span>`).join('');
        }
      }
    });
  });
}

// Master Page Interactions Initializer (runs on first load & after every SPA route transition)
function initPageInteractions() {
  initMobileDrawer();
  initNavbarScroll();
  initForms();
  initEventsFilter();
  initHeroSlider();
  initHeroTypewriter();
  initCounters();
  initAOS();
  initBrandSubtitles();
  syncActiveNavLinks();

  if (typeof window.initDynamicContent === 'function') {
    window.initDynamicContent();
  }
}

// ==========================================================================
// Seamless Single Page Application (SPA) Router Engine
// ==========================================================================

// Create Top Progress Bar element
let progressBarEl = null;
let progressTimer = null;

function ensureProgressBar() {
  if (!progressBarEl) {
    progressBarEl = document.getElementById('sst-spa-progress-bar');
    if (!progressBarEl) {
      progressBarEl = document.createElement('div');
      progressBarEl.id = 'sst-spa-progress-bar';
      document.body.appendChild(progressBarEl);
    }
  }
  return progressBarEl;
}

function startProgressBar() {
  const bar = ensureProgressBar();
  if (progressTimer) clearInterval(progressTimer);
  bar.style.opacity = '1';
  bar.style.width = '30%';

  let currentW = 30;
  progressTimer = setInterval(() => {
    if (currentW < 85) {
      currentW += 5;
      bar.style.width = `${currentW}%`;
    }
  }, 100);
}

function finishProgressBar() {
  const bar = ensureProgressBar();
  if (progressTimer) clearInterval(progressTimer);
  bar.style.width = '100%';
  setTimeout(() => {
    bar.style.opacity = '0';
    setTimeout(() => {
      bar.style.width = '0%';
    }, 300);
  }, 150);
}

// Cache for instant navigation
const spaPageCache = new Map();

async function navigateSPA(url, isPopState = false) {
  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(url, window.location.href);

  // If navigating to the same path with just a hash change
  if (currentUrl.pathname === targetUrl.pathname && targetUrl.hash) {
    if (!isPopState) history.pushState(null, '', url);
    const targetEl = document.querySelector(targetUrl.hash);
    if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
    window.closeMobileDrawer();
    return;
  }

  const mainContainer = document.querySelector('main');
  if (!mainContainer) {
    window.location.href = url;
    return;
  }

  startProgressBar();
  mainContainer.classList.add('spa-loading');

  try {
    let html = spaPageCache.get(targetUrl.pathname);

    if (!html) {
      const res = await fetch(targetUrl.href, {
        headers: { 'X-Requested-With': 'SST-SPA' }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
      spaPageCache.set(targetUrl.pathname, html);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newMain = doc.querySelector('main');

    if (!newMain) {
      window.location.href = url;
      return;
    }

    // Smooth swap delay for transition
    await new Promise(r => setTimeout(r, 120));

    // Update document title & meta tags
    if (doc.title) document.title = doc.title;
    const newMetaDesc = doc.querySelector('meta[name="description"]');
    const currentMetaDesc = document.querySelector('meta[name="description"]');
    if (newMetaDesc && currentMetaDesc) {
      currentMetaDesc.setAttribute('content', newMetaDesc.getAttribute('content'));
    }

    // Replace main content and attributes
    mainContainer.innerHTML = newMain.innerHTML;
    mainContainer.className = newMain.className;
    
    if (newMain.hasAttribute('data-aos')) {
      mainContainer.setAttribute('data-aos', newMain.getAttribute('data-aos'));
    } else {
      mainContainer.removeAttribute('data-aos');
    }

    // Update history state
    if (!isPopState) {
      history.pushState(null, '', targetUrl.href);
    }

    // Scroll to hash target or top
    if (targetUrl.hash) {
      const hashEl = document.querySelector(targetUrl.hash);
      if (hashEl) {
        hashEl.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    // Close mobile drawer
    window.closeMobileDrawer();

    // Re-initialize all scripts and active links
    initPageInteractions();

  } catch (err) {
    console.warn('SPA navigation fallback to standard reload:', err);
    window.location.href = url;
  } finally {
    mainContainer.classList.remove('spa-loading');
    finishProgressBar();
  }
}

// Prefetch link HTML on hover for instant navigation
function prefetchSPALink(url) {
  try {
    const targetUrl = new URL(url, window.location.href);
    if (targetUrl.origin !== window.location.origin) return;
    if (spaPageCache.has(targetUrl.pathname)) return;

    fetch(targetUrl.href, { priority: 'low' })
      .then(res => res.ok ? res.text() : null)
      .then(html => {
        if (html) spaPageCache.set(targetUrl.pathname, html);
      })
      .catch(() => {});
  } catch (e) {}
}

// Global Click Interceptor for SPA Links
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
    return;
  }

  const link = e.target.closest('a');
  if (!link) return;

  const href = link.getAttribute('href');
  if (!href) return;

  // Ignore special protocols, blank targets, downloads, or admin panel
  if (
    href.startsWith('#') && !href.includes('.html') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:') ||
    link.hasAttribute('download') ||
    link.getAttribute('target') === '_blank' ||
    link.hasAttribute('data-no-spa') ||
    href.includes('admin.html') ||
    href.includes('/admin')
  ) {
    if (href.startsWith('#')) {
      window.closeMobileDrawer();
    }
    return;
  }

  try {
    const targetUrl = new URL(link.href, window.location.href);
    if (targetUrl.origin !== window.location.origin) {
      return; // External link
    }

    e.preventDefault();
    navigateSPA(link.href);
  } catch (err) {
    // Fallback standard navigation
  }
});

// Prefetch on mouseover / touchstart
document.addEventListener('mouseover', (e) => {
  const link = e.target.closest('a');
  if (link && link.href && link.origin === window.location.origin && !link.hasAttribute('data-no-spa')) {
    prefetchSPALink(link.href);
  }
}, { passive: true });

document.addEventListener('touchstart', (e) => {
  const link = e.target.closest('a');
  if (link && link.href && link.origin === window.location.origin && !link.hasAttribute('data-no-spa')) {
    prefetchSPALink(link.href);
  }
}, { passive: true });

// Browser Back / Forward Button Handling
window.addEventListener('popstate', () => {
  navigateSPA(window.location.href, true);
});

// Initial Page Load
document.addEventListener('DOMContentLoaded', () => {
  ensureProgressBar();
  initPageInteractions();
});
