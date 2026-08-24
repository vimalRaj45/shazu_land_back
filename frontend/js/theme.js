// SST Dark & Light Theme Controller
(() => {
  const getStoredTheme = () => localStorage.getItem('sst-theme');
  const setStoredTheme = theme => localStorage.setItem('sst-theme', theme);

  const getPreferredTheme = () => {
    const storedTheme = getStoredTheme();
    if (storedTheme) {
      return storedTheme;
    }
    return 'light';
  };

  const setTheme = theme => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setStoredTheme(theme);
    updateThemeUI(theme);
  };

  const updateThemeUI = theme => {
    const inputs = document.querySelectorAll('.theme-toggle-input');
    inputs.forEach(input => {
      // Light Theme shows Sun (unchecked), Dark Theme shows Moon (checked)
      input.checked = (theme === 'dark');
    });
    // Support legacy buttons if any
    const toggleBtns = document.querySelectorAll('#theme-toggle-btn, .theme-toggle-btn');
    toggleBtns.forEach(btn => {
      if (btn.tagName !== 'LABEL' && !btn.querySelector('input')) {
        const icon = btn.querySelector('i');
        if (theme === 'dark') {
          btn.setAttribute('aria-label', 'Switch to Light Mode');
          btn.setAttribute('title', 'Switch to Light Mode');
          if (icon) icon.className = 'bi bi-sun-fill text-amber-400 text-base pointer-events-none';
        } else {
          btn.setAttribute('aria-label', 'Switch to Dark Mode');
          btn.setAttribute('title', 'Switch to Dark Mode');
          if (icon) icon.className = 'bi bi-moon-stars-fill text-slate-600 text-base pointer-events-none';
        }
      }
    });
  };

  // Set theme class on <html> immediately to prevent theme flicker
  const initialTheme = getPreferredTheme();
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateThemeUI(getPreferredTheme());

    // Listen for checkbox toggle changes
    document.addEventListener('change', e => {
      if (e.target.matches('.theme-toggle-input')) {
        const nextTheme = e.target.checked ? 'dark' : 'light';
        setTheme(nextTheme);
      }
    });

    // Listen for legacy button clicks
    document.addEventListener('click', e => {
      const toggleBtn = e.target.closest('#theme-toggle-btn, .theme-toggle-btn');
      if (toggleBtn && !e.target.matches('.theme-toggle-input')) {
        const nextTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        setTheme(nextTheme);
      }
    });
  });
})();
