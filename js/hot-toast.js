/**
 * HotToast JS - Lightweight Vanilla JS implementation of React-Hot-Toast
 * Supports toast(), toast.success(), toast.error(), toast.loading(), custom emojis, themes & positions.
 */

(function (window) {
  let toastContainer = null;
  let activePosition = 'top-center';

  function ensureContainer(position = 'top-center') {
    activePosition = position;
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'hot-toast-container';
      document.body.appendChild(toastContainer);
    }

    // Set position classes
    let posClasses = 'fixed z-[99999] flex flex-col gap-2.5 pointer-events-none transition-all duration-300 p-4 ';
    if (position.includes('top')) posClasses += 'top-2 ';
    else posClasses += 'bottom-2 ';

    if (position.includes('center')) posClasses += 'left-1/2 -translate-x-1/2 items-center';
    else if (position.includes('right')) posClasses += 'right-4 items-end';
    else posClasses += 'left-4 items-start';

    toastContainer.className = posClasses;
    return toastContainer;
  }

  function createToastElement(message, type = 'blank', opts = {}) {
    const toast = document.createElement('div');
    const isDark = opts.style === 'dark' || document.documentElement.classList.contains('dark');
    
    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-medium font-sans transition-all duration-300 transform translate-y-[-20px] opacity-0 scale-95 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] border ${
      isDark 
        ? 'bg-slate-900 text-slate-100 border-slate-800' 
        : 'bg-white text-slate-800 border-slate-100'
    }`;

    // Icon Badge
    let iconHtml = '';
    if (opts.icon) {
      iconHtml = `<span class="text-base leading-none">${opts.icon}</span>`;
    } else if (type === 'success') {
      iconHtml = `
        <div class="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 shadow-xs">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
        </div>
      `;
    } else if (type === 'error') {
      iconHtml = `
        <div class="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 shadow-xs">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
        </div>
      `;
    } else if (type === 'loading') {
      iconHtml = `
        <div class="w-4 h-4 border-2 border-[#123B32] border-t-transparent rounded-full animate-spin shrink-0"></div>
      `;
    }

    toast.innerHTML = `
      ${iconHtml}
      <span class="leading-snug">${message}</span>
    `;

    return toast;
  }

  function showToast(message, type = 'blank', opts = {}) {
    const container = ensureContainer(opts.position || activePosition);
    const toast = createToastElement(message, type, opts);
    
    container.appendChild(toast);

    // Trigger Enter Animation
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-[-20px]', 'opacity-0', 'scale-95');
      toast.classList.add('translate-y-0', 'opacity-100', 'scale-100');
    });

    // Auto Dismiss
    const duration = opts.duration || 3000;
    if (type !== 'loading' && duration > 0) {
      setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100', 'scale-100');
        toast.classList.add('translate-y-[-10px]', 'opacity-0', 'scale-95');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    return {
      id: toast,
      dismiss: () => {
        toast.classList.remove('translate-y-0', 'opacity-100', 'scale-100');
        toast.classList.add('translate-y-[-10px]', 'opacity-0', 'scale-95');
        setTimeout(() => toast.remove(), 300);
      }
    };
  }

  // Main toast API mimicking react-hot-toast
  const toast = function (message, opts) {
    return showToast(message, 'blank', opts);
  };

  toast.success = function (message, opts) {
    return showToast(message, 'success', opts);
  };

  toast.error = function (message, opts) {
    return showToast(message, 'error', opts);
  };

  toast.loading = function (message, opts) {
    return showToast(message, 'loading', opts);
  };

  toast.custom = function (message, opts) {
    return showToast(message, 'blank', opts);
  };

  toast.dismiss = function (toastRef) {
    if (toastRef && toastRef.dismiss) {
      toastRef.dismiss();
    } else if (toastContainer) {
      toastContainer.innerHTML = '';
    }
  };

  window.toast = toast;
})(window);
