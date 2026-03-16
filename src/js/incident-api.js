import { authHeaders, handleExpiredSession, isUnauthorized } from './auth.js';

export async function persistIncident(payload) {
  try {
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    if (isUnauthorized(res)) { handleExpiredSession(); return null; }
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.incident?.id || null;
  } catch (e) {
    console.warn('persistIncident:', e);
    return null;
  }
}

export async function saveIncidentResult(incident, payload, sourceType, durationMs) {
  const existingId = incident.dataset.incidentId;
  if (existingId) {
    try {
      const res = await fetch(`/api/incidents/${existingId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (isUnauthorized(res)) handleExpiredSession();
    } catch { /* degradacion graceful */ }
  } else {
    const incidentId = await persistIncident({
      ...payload,
      source_type: sourceType || 'audio',
      duration_ms: durationMs || 0,
    });
    if (incidentId) incident.dataset.incidentId = incidentId;
  }
}
