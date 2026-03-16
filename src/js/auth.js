import { showToast } from './toast.js';
import { UI } from './strings.js';

export function getSession() {
  try { return JSON.parse(localStorage.getItem('recup_session')); } catch { return null; }
}

export function authHeaders() {
  const session = getSession();
  return {
    'Authorization': 'Bearer ' + (session?.token || ''),
    'Content-Type': 'application/json'
  };
}

export function handleExpiredSession() {
  localStorage.removeItem('recup_session');
  showToast(UI.SESSION_EXPIRED);
  setTimeout(() => location.reload(), 1500);
}

export function isUnauthorized(res) {
  return res.status === 401;
}
