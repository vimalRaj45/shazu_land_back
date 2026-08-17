/**
 * Shazu Soft Technologies - Frontend Environment Configuration
 * 
 * Sets the Backend API Base URL dynamically based on local / production environment.
 */

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const defaultApiBase = isLocalhost 
  ? (window.location.port === '5000' ? '' : 'http://localhost:5000') 
  : 'https://shazu-land-back.onrender.com';

window.ENV = window.ENV || {
  API_BASE: window.__API_BASE__ || (isLocalhost ? defaultApiBase : (localStorage.getItem('SST_API_BASE') || defaultApiBase))
};

window.SST_CONFIG = window.SST_CONFIG || {
  API_BASE_URL: window.ENV.API_BASE
};

