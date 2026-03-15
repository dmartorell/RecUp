import { capitalize, ensurePeriod } from './utils.js';
import { timeAgo, parseUTC, formatDuration } from './time.js';
import { saveIncidentResult } from './incident-api.js';
import { authHeaders } from './auth.js';
import { summarize } from './summarizer.js';
import { openTicketModal } from './ticket-modal.js';
import { showToast } from './toast.js';

const feed = document.getElementById('feed');
const emptyState = document.getElementById('empty-state');
const clearAllBtn = document.getElementById('clear-all-btn');

export function updateEmptyState() {
  if (feed.children.length === 0) {
    emptyState.classList.remove('hidden');
    clearAllBtn.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    clearAllBtn.classList.remove('hidden');
  }
}

function attachTicketButton(incident, footer) {
  const ticketBtn = footer.querySelector('.btn-create-ticket');
  ticketBtn.addEventListener('click', async () => {
    if (incident.querySelector('.badge-sent')) return;
    openTicketModal({
      title: incident.dataset.summaryTitle,
      transcript: incident.dataset.summaryTranscript,
      bullets: JSON.parse(incident.dataset.summaryBullets),
      incidentElement: incident,
      onTicketCreated: async (taskId, taskUrl) => {
        const incidentId = incident.dataset.incidentId;
        if (incidentId) {
          try {
            await fetch(`/api/incidents/${incidentId}`, {
              method: 'PATCH',
              headers: authHeaders(),
              body: JSON.stringify({ clickup_task_id: taskId, clickup_task_url: taskUrl, status: 'completado' })
            });
          } catch (e) { console.warn('degradacion graceful:', e); }
        }
      }
    });
  });
}

export async function runSummarize(incident, rawText, sourceType, durationMs) {
  try {
    const result = await summarize(rawText);
    const badge = incident.querySelector('.js-status-badge');
    const spinner = incident.querySelector('.js-spinner');
    if (spinner) spinner.remove();

    const body = incident.querySelector('.incident-body');

    if (!result.is_bug) {
      badge.textContent = 'Completado';
      badge.className = 'badge badge-completed js-status-badge';

      const msg = document.createElement('p');
      msg.className = 'incident-no-bug';
      msg.textContent = 'No hay información suficiente para generar el ticket.';
      body.appendChild(msg);

      incident.dataset.summaryTranscript = rawText;

      await saveIncidentResult(incident, { transcript: rawText, status: 'completado' }, sourceType, durationMs);
      return;
    }

    badge.textContent = 'Completado';
    badge.className = 'badge badge-completed js-status-badge';

    incident.dataset.summaryTitle = result.title;

    const bullets = document.createElement('ul');
    bullets.className = 'incident-bullets';
    result.bullets.forEach((b) => {
      const li = document.createElement('li');
      li.textContent = ensurePeriod(capitalize(b));
      bullets.appendChild(li);
    });
    body.appendChild(bullets);

    const footer = document.createElement('div');
    footer.className = 'incident-footer';
    footer.innerHTML = `<button class="btn-create-ticket">Crear ticket en ClickUp <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg></button>`;
    incident.appendChild(footer);

    incident.dataset.summaryTranscript = result.transcript;
    incident.dataset.summaryBullets = JSON.stringify(result.bullets);

    attachTicketButton(incident, footer);

    await saveIncidentResult(incident, {
      transcript: rawText,
      title: result.title,
      bullets: JSON.stringify(result.bullets),
      status: 'completado',
    }, sourceType, durationMs);

  } catch (err) {
    const badge = incident.querySelector('.js-status-badge');
    badge.textContent = 'Error';
    badge.className = 'badge badge-error js-status-badge';

    const spinner = incident.querySelector('.js-spinner');
    if (spinner) spinner.remove();

    const body = incident.querySelector('.incident-body');
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-retry';
    retryBtn.textContent = 'Reintentar';
    retryBtn.addEventListener('click', () => {
      badge.textContent = 'Procesando';
      badge.className = 'badge badge-processing js-status-badge';

      const newSpinner = document.createElement('div');
      newSpinner.className = 'incident-spinner js-spinner';
      body.appendChild(newSpinner);

      retryBtn.remove();
      runSummarize(incident, rawText, sourceType, durationMs);
    });
    body.appendChild(retryBtn);

    showToast('Error al resumir: ' + err.message);
  }
}

export function createIncident(transcript, audioBlob, duration) {
  const incident = document.createElement('div');
  incident.className = 'incident';

  const rawText = transcript.trim();
  const durationStr = formatDuration(duration);
  const createdAt = new Date();

  const hasAudio = !!audioBlob;
  if (audioBlob && audioBlob instanceof Blob) {
    incident.dataset.audioBlobUrl = URL.createObjectURL(audioBlob);
  }
  incident.dataset.createdAt = createdAt.toISOString();

  const typeBadgeClass = hasAudio ? 'badge-audio' : 'badge-text';
  const typeBadgeLabel = hasAudio ? 'Audio' : 'Texto';

  if (!rawText) {
    incident.innerHTML = `
      <div class="incident-header">
        <div class="incident-badges">
          <span class="badge ${typeBadgeClass}">${typeBadgeLabel}</span>
          ${hasAudio ? `<span class="badge badge-duration">${durationStr}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:16px">
          <span class="incident-time js-time-relative">${timeAgo(createdAt)}</span>
          <button class="incident-delete" aria-label="Eliminar"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg></button>
        </div>
      </div>
      <div class="incident-body">
        <p class="incident-text">No se detecto voz. Intenta grabar de nuevo.</p>
      </div>
    `;
    incident.querySelector('.incident-delete').addEventListener('click', () => {
      incident.remove();
      updateEmptyState();
    });
    feed.prepend(incident);
    updateEmptyState();
    return;
  }

  let displayText = ensurePeriod(capitalize(rawText));

  incident.innerHTML = `
    <div class="incident-header">
      <div class="incident-badges">
        <span class="badge ${typeBadgeClass}">${typeBadgeLabel}</span>
        <span class="badge badge-processing js-status-badge">Procesando</span>
        ${hasAudio ? `<span class="badge badge-duration">${durationStr}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:16px">
        <span class="incident-time js-time-relative">${timeAgo(createdAt)}</span>
        <button class="incident-delete" aria-label="Eliminar"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg></button>
      </div>
    </div>
    <div class="incident-body">
      <p class="incident-text"></p>
      <div class="incident-spinner js-spinner"></div>
    </div>
  `;
  incident.querySelector('.incident-text').textContent = displayText;

  incident.querySelector('.incident-delete').addEventListener('click', async () => {
    const incidentId = incident.dataset.incidentId;
    if (incidentId) {
      try {
        await fetch(`/api/incidents/${incidentId}`, { method: 'DELETE', headers: authHeaders() });
      } catch (e) { console.warn('degradacion graceful:', e); }
    }
    incident.remove();
    updateEmptyState();
  });

  feed.prepend(incident);
  updateEmptyState();

  const sourceType = hasAudio ? 'audio' : 'text';
  runSummarize(incident, rawText, sourceType, duration);
}

export function renderIncidentFromDB(dbIncident) {
  const incident = document.createElement('div');
  incident.className = 'incident';
  incident.dataset.incidentId = dbIncident.id;
  incident.dataset.createdAt = dbIncident.created_at;

  const createdAt = parseUTC(dbIncident.created_at);
  const durationStr = formatDuration(dbIncident.duration_ms || 0);
  const sourceType = dbIncident.source_type || 'audio';
  const typeBadgeClass = sourceType === 'audio' ? 'badge-audio' : 'badge-text';
  const typeBadgeLabel = sourceType === 'audio' ? 'Audio' : 'Texto';

  const isPending = dbIncident.status === 'procesando';
  const statusBadgeClass = isPending ? 'badge-processing' : (dbIncident.status === 'error' ? 'badge-error' : 'badge-completed');
  const statusLabel = isPending ? 'Procesando' : (dbIncident.status === 'error' ? 'Error' : 'Completado');

  const hasBullets = dbIncident.bullets && dbIncident.title;
  const displayText = capitalize(dbIncident.transcript || '');

  if (isPending) {
    incident.dataset.transcript = dbIncident.transcript || '';
    incident.dataset.sourceType = sourceType;
    incident.dataset.durationMs = dbIncident.duration_ms || 0;
  }

  let noBugHTML = '';
  let spinnerHTML = '';
  let parsedBullets = [];

  if (isPending) {
    spinnerHTML = '<div class="incident-spinner js-spinner"></div>';
  } else if (hasBullets) {
    parsedBullets = Array.isArray(dbIncident.bullets) ? dbIncident.bullets : (() => { try { return JSON.parse(dbIncident.bullets); } catch { return []; } })();
    incident.dataset.summaryTitle = dbIncident.title;
    incident.dataset.summaryTranscript = dbIncident.transcript;
    incident.dataset.summaryBullets = JSON.stringify(dbIncident.bullets);
  } else {
    noBugHTML = `<p class="incident-no-bug">No hay información suficiente para generar el ticket.</p>`;
    incident.dataset.summaryTranscript = dbIncident.transcript;
  }

  const sentBadge = dbIncident.clickup_task_id
    ? `<span class="badge badge-sent js-status-badge">Enviado</span>`
    : `<span class="badge ${statusBadgeClass} js-status-badge">${statusLabel}</span>`;

  incident.innerHTML = `
    <div class="incident-header">
      <div class="incident-badges">
        <span class="badge ${typeBadgeClass}">${typeBadgeLabel}</span>
        ${sentBadge}
        ${sourceType !== 'text' && dbIncident.duration_ms ? `<span class="badge badge-duration">${durationStr}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:16px">
        <span class="incident-time js-time-relative">${timeAgo(createdAt)}</span>
        <button class="incident-delete" aria-label="Eliminar"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0 -7.5 0"/></svg></button>
      </div>
    </div>
    <div class="incident-body">
      <p class="incident-text"></p>
      ${noBugHTML}
      ${spinnerHTML}
    </div>
  `;
  incident.querySelector('.incident-text').textContent = displayText;

  const body = incident.querySelector('.incident-body');

  if (parsedBullets.length > 0) {
    const ul = document.createElement('ul');
    ul.className = 'incident-bullets';
    parsedBullets.forEach(b => {
      const li = document.createElement('li');
      li.textContent = ensurePeriod(capitalize(b));
      ul.appendChild(li);
    });
    body.appendChild(ul);
  }

  if (dbIncident.clickup_task_url) {
    const footer = document.createElement('div');
    footer.className = 'incident-footer';
    const link = document.createElement('a');
    link.href = dbIncident.clickup_task_url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'text-sm text-accent hover:underline';
    link.innerHTML = `Ver ticket <svg class="w-4 h-4" style="display:inline;vertical-align:middle;margin-left:2px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>`;
    footer.appendChild(link);
    incident.appendChild(footer);
  } else if (hasBullets) {
    const footer = document.createElement('div');
    footer.className = 'incident-footer';
    footer.innerHTML = `<button class="btn-create-ticket">Crear ticket en ClickUp <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg></button>`;
    incident.appendChild(footer);
    attachTicketButton(incident, footer);
  }

  incident.querySelector('.incident-delete').addEventListener('click', async () => {
    try {
      await fetch(`/api/incidents/${incident.dataset.incidentId}`, { method: 'DELETE', headers: authHeaders() });
    } catch (e) { console.warn('delete incident:', e); }
    incident.remove();
    updateEmptyState();
  });

  return incident;
}

export function resumePendingIncidents() {
  const pendingIncidents = feed.querySelectorAll('.incident');
  pendingIncidents.forEach(incident => {
    const badge = incident.querySelector('.js-status-badge');
    if (!badge || badge.textContent.trim() !== 'Procesando') return;
    const transcript = incident.dataset.transcript;
    if (!transcript) return;
    const sourceType = incident.dataset.sourceType || 'text';
    const durationMs = parseInt(incident.dataset.durationMs) || 0;
    runSummarize(incident, transcript, sourceType, durationMs);
  });
}
