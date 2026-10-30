// SST Fixed Light Theme Engine (Theme switching disabled per user requirements)
(() => {
  // Ensure document is permanently in clean light mode
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('dark');
    if (document.body) {
      document.body.classList.remove('dark');
    }
  }

  // Clear any existing stored dark preferences
  try {
    localStorage.removeItem('sst-theme');
    localStorage.removeItem('theme');
  } catch (e) {}

  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.remove('dark');
    if (document.body) {
      document.body.classList.remove('dark');
    }

    // Hide all theme switchers and inputs if present in DOM
    const themeElements = document.querySelectorAll(
      '.switch, #theme-toggle, #sw-theme-toggle, #sw-mobile-theme-toggle, .theme-switch, .theme-toggle-btn, .theme-toggle-input'
    );
    themeElements.forEach(el => {
      el.style.display = 'none';
      if (el.tagName === 'INPUT') el.checked = false;
    });
  });
})();
