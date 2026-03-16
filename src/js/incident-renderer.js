import { capitalize, ensurePeriod } from './utils.js';
import { timeAgo, parseUTC, formatDuration } from './time.js';
import { saveIncidentResult } from './incident-api.js';
import { authHeaders, handleExpiredSession, isUnauthorized } from './auth.js';
import { summarize } from './summarizer.js';
import { openTicketModal } from './ticket-modal.js';
import { showToast } from './toast.js';
import { icons } from './icons.js';
import { UI } from './strings.js';

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

function buildIncidentHTML({ typeBadgeClass, typeBadgeLabel, statusBadge, durationBadge, timeLabel, transcript, showSpinner, noBugHTML }) {
  return `
    <div class="incident-header">
      <div class="incident-badges">
        <span class="badge ${typeBadgeClass}">${typeBadgeLabel}</span>
        ${statusBadge || ''}
        ${durationBadge || ''}
      </div>
      <div style="display:flex;align-items:center;gap:16px">
        <span class="incident-time js-time-relative">${timeLabel}</span>
        <button class="incident-delete" aria-label="${UI.DELETE_LABEL}">${icons.delete}</button>
      </div>
    </div>
    <div class="incident-body">
      <p class="incident-text"></p>
      ${noBugHTML || ''}
      ${showSpinner ? '<div class="incident-spinner js-spinner"></div>' : ''}
    </div>
  `;
}

export function buildOnTicketCreated(incident) {
  return async (taskId, taskUrl) => {
    const incidentId = incident.dataset.incidentId;
    if (incidentId) {
      try {
        const res = await fetch(`/api/incidents/${incidentId}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ clickup_task_id: taskId, clickup_task_url: taskUrl, status: 'completado' })
        });
        if (isUnauthorized(res)) handleExpiredSession();
      } catch (e) { console.warn('degradacion graceful:', e); }
    }
  };
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
      onTicketCreated: buildOnTicketCreated(incident)
    });
  });
}

function attachDeleteHandler(incident, hasId) {
  incident.querySelector('.incident-delete').addEventListener('click', async () => {
    const incidentId = incident.dataset.incidentId;
    if (hasId && incidentId) {
      try {
        const res = await fetch(`/api/incidents/${incidentId}`, { method: 'DELETE', headers: authHeaders() });
        if (isUnauthorized(res)) { handleExpiredSession(); return; }
      } catch (e) { console.warn('delete incident:', e); }
    }
    incident.remove();
    updateEmptyState();
  });
}

function createTicketFooter(incident, { isLink, url }) {
  const footer = document.createElement('div');
  footer.className = 'incident-footer';
  if (isLink) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'text-sm text-accent hover:underline';
    link.innerHTML = `${UI.TICKET_VIEW} ${icons.externalLinkInline}`;
    footer.appendChild(link);
  } else {
    footer.innerHTML = `<button class="btn-create-ticket">${UI.TICKET_CREATE_BTN} ${icons.externalLink}</button>`;
    attachTicketButton(incident, footer);
  }
  incident.appendChild(footer);
  return footer;
}

export async function runSummarize(incident, rawText, sourceType, durationMs) {
  try {
    const result = await summarize(rawText);
    const badge = incident.querySelector('.js-status-badge');
    const spinner = incident.querySelector('.js-spinner');
    if (spinner) spinner.remove();

    const body = incident.querySelector('.incident-body');

    if (!result.is_bug) {
      badge.textContent = UI.STATUS_COMPLETED;
      badge.className = 'badge badge-neutral js-status-badge';

      const msg = document.createElement('p');
      msg.className = 'incident-no-bug';
      msg.textContent = UI.NO_BUG_MSG;
      body.appendChild(msg);

      incident.dataset.summaryTranscript = rawText;

      await saveIncidentResult(incident, { transcript: rawText, status: 'completado' }, sourceType, durationMs);
      return;
    }

    badge.textContent = UI.STATUS_COMPLETED;
    badge.className = 'badge badge-neutral js-status-badge';

    incident.dataset.summaryTitle = result.title;

    const bullets = document.createElement('ul');
    bullets.className = 'incident-bullets';
    result.bullets.forEach((b) => {
      const li = document.createElement('li');
      li.textContent = ensurePeriod(capitalize(b));
      bullets.appendChild(li);
    });
    body.appendChild(bullets);

    incident.dataset.summaryTranscript = result.transcript;
    incident.dataset.summaryBullets = JSON.stringify(result.bullets);

    createTicketFooter(incident, { isLink: false });

    openTicketModal({
      title: result.title,
      transcript: result.transcript,
      bullets: result.bullets,
      incidentElement: incident,
      onTicketCreated: buildOnTicketCreated(incident)
    });

    await saveIncidentResult(incident, {
      transcript: rawText,
      title: result.title,
      bullets: JSON.stringify(result.bullets),
      status: 'completado',
    }, sourceType, durationMs);

  } catch (err) {
    const badge = incident.querySelector('.js-status-badge');
    badge.textContent = UI.STATUS_ERROR;
    badge.className = 'badge badge-neutral js-status-badge';

    const spinner = incident.querySelector('.js-spinner');
    if (spinner) spinner.remove();

    const body = incident.querySelector('.incident-body');
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-retry';
    retryBtn.textContent = UI.RETRY_BTN;
    retryBtn.addEventListener('click', () => {
      badge.textContent = UI.STATUS_PROCESSING;
      badge.className = 'badge badge-processing js-status-badge';

      const newSpinner = document.createElement('div');
      newSpinner.className = 'incident-spinner js-spinner';
      body.appendChild(newSpinner);

      retryBtn.remove();
      runSummarize(incident, rawText, sourceType, durationMs);
    });
    body.appendChild(retryBtn);

    showToast(UI.SUMMARIZE_ERROR_PREFIX + err.message);
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
  const typeBadgeLabel = hasAudio ? UI.TYPE_AUDIO : UI.TYPE_TEXT;

  if (!rawText) {
    incident.innerHTML = buildIncidentHTML({
      typeBadgeClass,
      typeBadgeLabel,
      durationBadge: hasAudio ? `<span class="badge badge-neutral">${durationStr}</span>` : '',
      timeLabel: timeAgo(createdAt),
      transcript: UI.NO_VOICE,
    });
    incident.querySelector('.incident-text').textContent = UI.NO_VOICE;
    attachDeleteHandler(incident, false);
    feed.prepend(incident);
    updateEmptyState();
    return;
  }

  const displayText = ensurePeriod(capitalize(rawText));

  incident.innerHTML = buildIncidentHTML({
    typeBadgeClass,
    typeBadgeLabel,
    statusBadge: `<span class="badge badge-processing js-status-badge">${UI.STATUS_PROCESSING}</span>`,
    durationBadge: hasAudio ? `<span class="badge badge-neutral">${durationStr}</span>` : '',
    timeLabel: timeAgo(createdAt),
    showSpinner: true,
  });
  incident.querySelector('.incident-text').textContent = displayText;

  attachDeleteHandler(incident, true);

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
  const typeBadgeLabel = sourceType === 'audio' ? UI.TYPE_AUDIO : UI.TYPE_TEXT;

  const isPending = dbIncident.status === 'procesando';
  const statusBadgeClass = isPending ? 'badge-processing' : 'badge-neutral';
  const statusLabel = isPending ? UI.STATUS_PROCESSING : (dbIncident.status === 'error' ? UI.STATUS_ERROR : UI.STATUS_COMPLETED);

  const hasBullets = dbIncident.bullets && dbIncident.title;
  const displayText = capitalize(dbIncident.transcript || '');

  if (isPending) {
    incident.dataset.transcript = dbIncident.transcript || '';
    incident.dataset.sourceType = sourceType;
    incident.dataset.durationMs = dbIncident.duration_ms || 0;
  }

  let noBugHTML = '';
  let parsedBullets = [];

  if (isPending) {
    // spinner shown via buildIncidentHTML
  } else if (hasBullets) {
    parsedBullets = Array.isArray(dbIncident.bullets) ? dbIncident.bullets : (() => { try { return JSON.parse(dbIncident.bullets); } catch { return []; } })();
    incident.dataset.summaryTitle = dbIncident.title;
    incident.dataset.summaryTranscript = dbIncident.transcript;
    incident.dataset.summaryBullets = JSON.stringify(dbIncident.bullets);
  } else {
    noBugHTML = `<p class="incident-no-bug">${UI.NO_BUG_MSG}</p>`;
    incident.dataset.summaryTranscript = dbIncident.transcript;
  }

  const sentBadge = dbIncident.clickup_task_id
    ? `<span class="badge badge-sent js-status-badge">${UI.STATUS_SENT}</span>`
    : `<span class="badge ${statusBadgeClass} js-status-badge">${statusLabel}</span>`;

  incident.innerHTML = buildIncidentHTML({
    typeBadgeClass,
    typeBadgeLabel,
    statusBadge: sentBadge,
    durationBadge: sourceType !== 'text' && dbIncident.duration_ms ? `<span class="badge badge-neutral">${durationStr}</span>` : '',
    timeLabel: timeAgo(createdAt),
    showSpinner: isPending,
    noBugHTML,
  });
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
    createTicketFooter(incident, { isLink: true, url: dbIncident.clickup_task_url });
  } else if (hasBullets) {
    createTicketFooter(incident, { isLink: false });
  }

  attachDeleteHandler(incident, true);

  return incident;
}

export function resumePendingIncidents() {
  const pendingIncidents = feed.querySelectorAll('.incident');
  pendingIncidents.forEach(incident => {
    const badge = incident.querySelector('.js-status-badge');
    if (!badge || badge.textContent.trim() !== UI.STATUS_PROCESSING) return;
    const transcript = incident.dataset.transcript;
    if (!transcript) return;
    const sourceType = incident.dataset.sourceType || 'text';
    const durationMs = parseInt(incident.dataset.durationMs) || 0;
    runSummarize(incident, transcript, sourceType, durationMs);
  });
}
