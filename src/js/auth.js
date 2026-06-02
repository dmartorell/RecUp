import { UI } from './strings.js';
import { showToast } from './toast.js';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem('recup_session'));
  } catch {
    return null;
  }
}

export function tagSentryUser() {
  if (!window.Sentry) return;
  const email = getSession()?.user?.email;
  window.Sentry.setUser(email ? { email } : null);
}

export function authHeaders() {
  const session = getSession();
  return {
    Authorization: `Bearer ${session?.token || ''}`,
    'Content-Type': 'application/json',
  };
}

export function handleExpiredSession() {
  if (window.__recupSessionExpired) return;
  window.__recupSessionExpired = true;
  localStorage.removeItem('recup_session');
  window.postMessage({ type: 'recup:logout' }, '*');
  showToast(UI.SESSION_EXPIRED);
  setTimeout(() => location.reload(), 1500);
}

export function isUnauthorized(res) {
  return res.status === 401;
}

export function updateSessionToken(newToken) {
  const session = getSession();
  if (!session?.user) return;
  localStorage.setItem('recup_session', JSON.stringify({ ...session, token: newToken }));
}

const AUTH_PUBLIC_PATHS = ['/api/auth/login', '/api/auth/register'];

function isAuthPublicRequest(input) {
  const url = typeof input === 'string' ? input : input?.url || '';
  return AUTH_PUBLIC_PATHS.some((p) => url.includes(p));
}

export function installTokenRefreshInterceptor() {
  if (window.__recupFetchPatched) return;
  window.__recupFetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await originalFetch(...args);
    const fresh = res.headers.get('X-New-Token');
    if (fresh) updateSessionToken(fresh);
    if (res.status === 401 && !isAuthPublicRequest(args[0]) && getSession()?.token) {
      handleExpiredSession();
    }
    return res;
  };
}
