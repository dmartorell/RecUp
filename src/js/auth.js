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
