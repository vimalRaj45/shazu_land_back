// Global Mobile Drawer Controller (With Console Diagnostic Logging)
window.toggleMobileDrawer = function(e) {
  console.log('🍔 [HAMBURGER CLICK DETECTED!]', e);
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileBackdrop = document.getElementById('mobile-backdrop');
  const menuBtn = document.getElementById('mobile-menu-btn');

  console.log('📱 Mobile Menu Element:', mobileMenu);
  console.log('🌌 Mobile Backdrop Element:', mobileBackdrop);
  console.log('🔘 Menu Button Element:', menuBtn);

  if (mobileMenu && mobileBackdrop) {
    const isActive = mobileMenu.classList.contains('active');
    console.log('⚡ Current Active State:', isActive);

    if (isActive) {
      mobileMenu.classList.remove('active');
      mobileBackdrop.classList.remove('active');
      if (menuBtn) menuBtn.classList.remove('open');
      document.body.style.overflow = '';
      console.log('❌ Drawer Closed!');
    } else {
      mobileMenu.classList.add('active');
      mobileBackdrop.classList.add('active');
      if (menuBtn) menuBtn.classList.add('open');
      document.body.style.overflow = 'hidden';
      console.log('✅ Drawer Opened! Active class applied successfully.');
    }
  } else {
    console.error('⚠️ ERROR: #mobile-menu or #mobile-backdrop element not found in DOM!');
  }
};

window.closeMobileDrawer = function(e) {
  console.log('🔒 [CLOSE DRAWER TRIGGERED]');
  if (e) {
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

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM Content Loaded. Initializing Mobile Drawer Event Handlers...');
  const menuBtn = document.getElementById('mobile-menu-btn');
  const closeBtn = document.getElementById('mobile-close-btn');
  const mobileBackdrop = document.getElementById('mobile-backdrop');
  const mobileMenu = document.getElementById('mobile-menu');

  if (menuBtn) menuBtn.addEventListener('click', window.toggleMobileDrawer);
  if (closeBtn) closeBtn.addEventListener('click', window.closeMobileDrawer);
  if (mobileBackdrop) mobileBackdrop.addEventListener('click', window.closeMobileDrawer);

  if (mobileMenu) {
    const links = mobileMenu.querySelectorAll('.mobile-accordion-menu a, a:not(.mobile-accordion-toggle)');
    links.forEach(l => l.addEventListener('click', window.closeMobileDrawer));
  }

  // Mobile Drawer Accordion Sub-Menu Toggle Handler
  const accordionToggles = document.querySelectorAll('.mobile-accordion-toggle');
  accordionToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const accordion = toggle.closest('.mobile-accordion');
      const menu = accordion ? accordion.querySelector('.mobile-accordion-menu') : null;
      const arrow = toggle.querySelector('.accordion-arrow');

      if (menu) {
        const isHidden = menu.classList.contains('hidden');
        
        // Optional: close other open accordions for accordion behavior
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
  console.log('Mobile Drawer Listeners Registered.');

  // 2. Sticky Glassmorphic Navbar on Scroll
  const header = document.querySelector('header');
  if (header) {
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

  // 3. Contact Form Submission Handler
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Simple validation
      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const subject = document.getElementById('contact-subject').value.trim();
      const message = document.getElementById('contact-message').value.trim();

      if (!name || !email || !subject || !message) {
        showToast('Please fill out all required fields.', 'error');
        return;
      }

      // Success feedback
      showSuccessModal(
        'Message Sent!',
        `Thank you, ${name}. We have received your message regarding "${subject}" and will respond shortly.`
      );
      contactForm.reset();
    });
  }

  // 4. Membership Form Submission Handler
  const membershipForm = document.getElementById('membership-form');
  if (membershipForm) {
    membershipForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('member-name').value.trim();
      const email = document.getElementById('member-email').value.trim();
      const category = document.getElementById('member-category').value;
      const institution = document.getElementById('member-institution').value.trim();

      if (!name || !email || !category || !institution) {
        showToast('Please fill in all the details.', 'error');
        return;
      }

      showSuccessModal(
        'Registration Submitted!',
        `Thank you for applying as a ${category}. We will review your application for ${institution} and contact you soon.`
      );
      membershipForm.reset();
    });
  }

  // 5. Events Search & Filtering (events.html)
  const searchInput = document.getElementById('event-search');
  const filterPills = document.querySelectorAll('.event-filter-pill');
  const eventCards = document.querySelectorAll('.event-card');

  if (searchInput || filterPills.length > 0) {
    let currentCategory = 'all';
    let searchQuery = '';

    const filterEvents = () => {
      eventCards.forEach(card => {
        const text = card.textContent.toLowerCase();
        const category = card.getAttribute('data-category');
        
        const matchesSearch = text.includes(searchQuery);
        const matchesCategory = currentCategory === 'all' || category === currentCategory;

        if (matchesSearch && matchesCategory) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    };

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        filterEvents();
      });
    }

    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('bg-brand-green', 'text-white'));
        filterPills.forEach(p => p.classList.add('bg-white', 'text-brand-secText'));
        
        pill.classList.remove('bg-white', 'text-brand-secText');
        pill.classList.add('bg-brand-green', 'text-white');

        currentCategory = pill.getAttribute('data-filter');
        filterEvents();
      });
    });
  }

  // Helper function for Toast
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 right-5 px-6 py-3 rounded-lg shadow-lg z-50 text-white transition-all duration-300 transform translate-y-10 opacity-0 ${
      type === 'success' ? 'bg-brand-green' : 'bg-red-600'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Animate out
    setTimeout(() => {
      toast.classList.add('translate-y-10', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Helper function for Success Modal
  function showSuccessModal(title, text) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4 animate-fade-in';
    modal.innerHTML = `
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center transform transition-transform duration-300 scale-95 glassmorphism">
        <div class="w-16 h-16 bg-brand-softGreen text-brand-green rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="bi bi-check-circle-fill text-3xl"></i>
        </div>
        <h3 class="text-2xl font-bold text-brand-darkText mb-2 font-heading">${title}</h3>
        <p class="text-brand-secText mb-6 text-sm">${text}</p>
        <button id="close-modal-btn" class="bg-brand-green hover:bg-brand-hoverGreen text-white font-medium px-6 py-2.5 rounded-lg w-full transition-all duration-200">
          Close
        </button>
      </div>
    `;
    document.body.appendChild(modal);

    // Trigger scale-100 animation
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

  // Bind to window for global access (used in careers.html inline action)
  window.showSuccessModal = showSuccessModal;

  // 6. Hero Image Slider (index.html)
  const slides = document.querySelectorAll('.slider-slide');
  const prevBtn = document.getElementById('slider-prev');
  const nextBtn = document.getElementById('slider-next');
  const dots = document.querySelectorAll('.slider-dot');
  
  if (slides.length > 0) {
    let activeSlideIndex = 0;
    let autoSlideInterval;

    const showSlide = (index) => {
      slides.forEach(s => s.classList.remove('active'));
      dots.forEach(d => {
        d.classList.remove('bg-white');
        d.classList.add('bg-white/40');
      });

      activeSlideIndex = (index + slides.length) % slides.length;
      slides[activeSlideIndex].classList.add('active');
      if (dots[activeSlideIndex]) {
        dots[activeSlideIndex].classList.remove('bg-white/40');
        dots[activeSlideIndex].classList.add('bg-white');
      }
    };

    const nextSlide = () => showSlide(activeSlideIndex + 1);
    const prevSlide = () => showSlide(activeSlideIndex - 1);

    if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); resetAutoSlide(); });
    if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); resetAutoSlide(); });

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        showSlide(idx);
        resetAutoSlide();
      });
    });

    const startAutoSlide = () => {
      autoSlideInterval = setInterval(nextSlide, 5000);
    };

    const resetAutoSlide = () => {
      clearInterval(autoSlideInterval);
      startAutoSlide();
    };

    startAutoSlide();
  }

  // 7. Hero Typewriter Effect (index.html)
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
        typeSpeed = 2000; // Pause at end of phrase
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typeSpeed = 400; // Pause before typing next phrase
      }

      setTimeout(typeLoop, typeSpeed);
    };

    // Start typewriter loop
    setTimeout(typeLoop, 800);
  }

  // 8. Statistics Counter Animation
  const counters = document.querySelectorAll('.stat-counter');
  if (counters.length > 0) {
    const formatNum = (num) => {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const runCounter = (counter) => {
      const target = +counter.getAttribute('data-target');
      const duration = 1500; // 1.5 seconds animation time
      const stepTime = 25; // millisecond steps
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
      // Fallback for older browsers
      counters.forEach(c => {
        const target = c.getAttribute('data-target');
        c.textContent = formatNum(target) + "+";
      });
    }
  }

  // 9. AOS Initialization and Fallback
  try {
    if (typeof AOS !== 'undefined') {
      AOS.init({
        duration: 600,
        once: true,
        easing: 'ease-out-quad'
      });
    } else {
      throw new Error("AOS script was blocked or not loaded.");
    }
  } catch (e) {
    console.warn("AOS load failed. Initializing vanilla scroll transitions fallback:", e.message);
    document.querySelectorAll('[data-aos]').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.transition = 'none';
    });
  }

  // 10. Auto-Format Brand Logo Subtitle Exact Width Across All Devices
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

  // 11. Sync ONLY current active page in Mobile Drawer
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('aside#mobile-menu nav a').forEach(link => {
    const href = link.getAttribute('href') || '';
    const isCurrent = href === currentPath || (currentPath === '' && href === 'index.html');
    if (isCurrent) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
      const dot = link.querySelector('.w-1\\.5.h-1\\.5, .rounded-full.bg-\\[\\#123B32\\]');
      if (dot && dot.parentElement === link) dot.remove();
    }
  });
});
