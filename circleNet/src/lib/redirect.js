// src/lib/redirect.js
/**
 * Get the current URL path (including search params) to use as a redirect target.
 * Works on client and server.
 */
export function getCurrentPath() {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.search;
}

/**
 * Build a login/signup URL that preserves the current page as a redirect target.
 * @param {string} authPage - '/login' or '/register'
 * @param {string} [returnTo] - optional path to return to; defaults to current page
 */
export function getAuthUrl(authPage, returnTo) {
  const redirect = returnTo || (typeof window !== 'undefined' ? getCurrentPath() : '/');
  return `${authPage}?redirect=${encodeURIComponent(redirect)}`;
}