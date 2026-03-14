import { requestMicAccess, getStream, startRecording, stopRecording } from './recorder.js';
import { startTranscription, stopTranscription } from './transcriber.js';
import { summarize } from './summarizer.js';
import { openTicketModal } from './ticket-modal.js';

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
function ensurePeriod(str) { return /[.?!]$/.test(str) ? str : str + '.'; }

function scrollFeedToTop() {
  const mainEl = document.querySelector('main');
  if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
}

function isBrowserCompatible() {
  return !!window.chrome;
}

if (!isBrowserCompatible()) {
  document.getElementById('app').style.display = 'none';
  document.getElementById('unsupported').style.display = 'flex';
}

const loginScreen = document.getElementById('login-screen');
const loginBtn = document.getElementById('login-btn');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginNameInput = document.getElementById('login-name');
const loginNameField = document.getElementById('login-name-field');
const loginToggleLink = document.getElementById('login-toggle-link');
const loginError = document.getElementById('login-error');
const userAvatar = document.getElementById('user-avatar');
const avatarEmail = document.getElementById('avatar-email');

const togglePasswordBtn = document.getElementById('toggle-password-btn');
const eyeIcon = document.getElementById('eye-icon');
const eyeOffIcon = document.getElementById('eye-off-icon');

togglePasswordBtn.addEventListener('click', () => {
  const isPassword = loginPasswordInput.type === 'password';
  loginPasswordInput.type = isPassword ? 'text' : 'password';
  eyeIcon.classList.toggle('hidden', isPassword);
  eyeOffIcon.classList.toggle('hidden', !isPassword);
});

let isRegisterMode = false;

function setLoginMode(register) {
  isRegisterMode = register;
  loginNameField.classList.toggle('invisible', !register);
  loginNameField.classList.toggle('order-last', !register);
  loginNameField.classList.toggle('order-first', register);
  loginBtn.textContent = register ? 'Registrarse' : 'Entrar';
  loginToggleLink.textContent = register ? 'Ya tengo cuenta' : '¿No tienes cuenta? Regístrate';
  loginError.classList.remove('visible');
  loginError.classList.add('invisible');
  loginEmailInput.value = '';
  loginPasswordInput.value = '';
  loginNameInput.value = '';
}

loginToggleLink.addEventListener('click', (e) => {
  e.preventDefault();
  setLoginMode(!isRegisterMode);
});

function getSession() {
  try { return JSON.parse(localStorage.getItem('bugshot_session')); } catch { return null; }
}

function authHeaders() {
  const session = getSession();
  return {
    'Authorization': 'Bearer ' + (session?.token || ''),
    'Content-Type': 'application/json'
  };
}

function showApp(email) {
  loginScreen.classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  avatarEmail.textContent = email;
  avatarEmail.style.display = '';
  userAvatar.classList.remove('hidden');
}

function checkAuth() {
  const session = getSession();
  if (session?.token && session?.user) {
    showApp(session.user.email);
    return true;
  }
  loginScreen.classList.remove('hidden');
  return false;
}

function showLoginError(msg) {
  loginError.textContent = msg || 'Credenciales incorrectas';
  loginError.classList.remove('invisible');
  loginError.classList.add('visible');
}

[loginEmailInput, loginPasswordInput, loginNameInput].forEach(input => {
  if (input) input.addEventListener('focus', () => {
    loginError.classList.remove('visible');
    loginError.classList.add('invisible');
  });
});

loginBtn.addEventListener('click', async () => {
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;
  loginError.classList.remove('visible');
  loginError.classList.add('invisible');

  if (!email || !password) {
    showLoginError('Email y contraseña son obligatorios');
    return;
  }

  const originalText = loginBtn.textContent;
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>';

  try {
    let body, endpoint;
    if (isRegisterMode) {
      const name = loginNameInput.value.trim();
      if (!name) {
        loginBtn.disabled = false;
        loginBtn.textContent = originalText;
        showLoginError('El nombre es obligatorio para registrarse.');
        return;
      }
      endpoint = '/api/auth/register';
      body = { name, email, password };
    } else {
      endpoint = '/api/auth/login';
      body = { email, password };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showLoginError(data.error || 'Error al iniciar sesión.');
      loginBtn.disabled = false;
      loginBtn.textContent = originalText;
      return;
    }

    localStorage.setItem('bugshot_session', JSON.stringify({ token: data.data.token, user: data.data.user }));
    loginBtn.disabled = false;
    loginBtn.textContent = originalText;
    showApp(data.data.user.email);
    await loadIncidents();
    resumePendingIncidents();
    initMic();
  } catch {
    showLoginError('Error de red. Intenta de nuevo.');
    loginBtn.disabled = false;
    loginBtn.textContent = originalText;
  }
});

loginPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

userAvatar.addEventListener('click', () => {
  localStorage.removeItem('bugshot_session');
  location.reload();
});

function parseUTC(ts) {
  return new Date(ts.endsWith('Z') ? ts : ts + 'Z');
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'justo ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'hace 1 hora' : `hace ${hours} horas`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hace 1 dia' : `hace ${days} dias`;
}

let isRecording = false;
let timerInterval = null;
let startTime = null;
let micReady = false;
let analyser = null;
let animFrameId = null;

const recordBtn = document.getElementById('record-btn');
const micIcon = document.getElementById('mic-icon');
const recordingUI = document.getElementById('recording-ui');
const timerDisplay = document.getElementById('timer');
const waveformBars = document.querySelectorAll('.waveform-bar');
const feed = document.getElementById('feed');
const emptyState = document.getElementById('empty-state');
const clearAllBtn = document.getElementById('clear-all-btn');
const toastContainer = document.getElementById('toast-container');
const textInputBtn = document.getElementById('text-input-btn');
const textInputModal = document.getElementById('text-input-modal');
const textInputArea = document.getElementById('text-input-area');
const textInputSubmit = document.getElementById('text-input-submit');
const textInputCancel = document.getElementById('text-input-cancel');
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-modal-title');
const confirmMessage = document.getElementById('confirm-modal-message');
const confirmOk = document.getElementById('confirm-modal-ok');
const confirmCancel = document.getElementById('confirm-modal-cancel');

function setPageInteractive(enabled) {
  const targets = [
    textInputBtn,
    clearAllBtn,
    userAvatar,
    ...feed.querySelectorAll('button, a'),
  ];
  targets.forEach(el => {
    if (!el) return;
    if (enabled) {
      el.style.pointerEvents = '';
      el.style.opacity = '';
    } else {
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.4';
    }
  });
}

function showConfirmModal(title, message, onConfirm) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmModal.classList.remove('hidden');
  const cleanup = () => confirmModal.classList.add('hidden');
  confirmCancel.onclick = cleanup;
  confirmOk.onclick = () => { cleanup(); onConfirm(); };
}


function updateTextSubmitState() {
  textInputSubmit.disabled = textInputArea.value.trim().length < 4;
}

function openTextInputModal() {
  textInputModal.classList.remove('hidden');
  textInputArea.value = '';
  updateTextSubmitState();
  setTimeout(() => textInputArea.focus(), 50);
}

function closeTextInputModal() {
  textInputModal.classList.add('hidden');
  textInputArea.value = '';
}

textInputBtn.addEventListener('click', openTextInputModal);
textInputCancel.addEventListener('click', closeTextInputModal);
textInputArea.addEventListener('input', updateTextSubmitState);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!textInputModal.classList.contains('hidden')) {
    closeTextInputModal();
  } else if (!confirmModal.classList.contains('hidden')) {
    confirmModal.classList.add('hidden');
  }
});

textInputSubmit.addEventListener('click', () => {
  const text = textInputArea.value.trim();
  if (!text) return;
  closeTextInputModal();
  scrollFeedToTop();
  createIncident(text, null, 0);
});

async function initMic() {
  try {
    await requestMicAccess();
    micReady = true;
  } catch (err) {
    showToast(err.message);
  }
}

function animateWaveform() {
  const dataArray = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(dataArray);
  let peak = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = Math.abs(dataArray[i] - 128);
    if (v > peak) peak = v;
  }
  const normalized = Math.min(1, peak / 15);
  const height = Math.max(3, normalized * 18);
  waveformBars.forEach(bar => bar.style.height = height + 'px');
  animFrameId = requestAnimationFrame(animateWaveform);
}

async function toggleRecording() {
  if (!micReady) {
    await initMic();
    if (!micReady) return;
  }

  if (!isRecording) {
    isRecording = true;
    textInputBtn.classList.add('hidden');
    micIcon.classList.add('hidden');
    recordingUI.classList.remove('hidden');
    startTime = Date.now();
    timerDisplay.textContent = '00:00';
    timerInterval = setInterval(() => {
      timerDisplay.textContent = formatDuration(Date.now() - startTime);
    }, 1000);

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(getStream());
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    animateWaveform();

    startTranscription((error) => {
      showToast('Error de transcripción: ' + error);
    });

    startRecording();
    scrollFeedToTop();
    recordBtn.classList.remove('bg-accent');
    recordBtn.classList.add('bg-accent-hover');
    setPageInteractive(false);
  } else {
    isRecording = false;
    setPageInteractive(true);
    textInputBtn.classList.remove('hidden');
    recordingUI.classList.add('hidden');
    micIcon.classList.remove('hidden');
    recordBtn.classList.remove('bg-accent-hover');
    recordBtn.classList.add('bg-accent');
    cancelAnimationFrame(animFrameId);
    waveformBars.forEach(bar => bar.style.height = '3px');

    clearInterval(timerInterval);
    const duration = Date.now() - startTime;

    const transcript = await stopTranscription();
    const audioBlob = await stopRecording();

    createIncident(transcript, audioBlob, duration);
  }
}

function createIncident(transcript, audioBlob, duration) {
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
      } catch { /* degradacion graceful */ }
    }
    incident.remove();
    updateEmptyState();
  });

  feed.prepend(incident);
  updateEmptyState();

  const sourceType = hasAudio ? 'audio' : 'text';
  runSummarize(incident, rawText, sourceType, duration);
}

async function persistIncident(payload) {
  try {
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.incident?.id || null;
  } catch {
    return null;
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
          } catch { /* degradacion graceful */ }
        }
      }
    });
  });
}

async function saveIncidentResult(incident, payload, sourceType, durationMs) {
  const existingId = incident.dataset.incidentId;
  if (existingId) {
    try {
      await fetch(`/api/incidents/${existingId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
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

function runSummarize(incident, rawText, sourceType, durationMs) {
  summarize(rawText).then(async (result) => {
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

  }).catch((err) => {
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
  });
}

function updateEmptyState() {
  if (feed.children.length === 0) {
    emptyState.classList.remove('hidden');
    clearAllBtn.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    clearAllBtn.classList.remove('hidden');
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 4000);
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const sec = String(totalSec % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

recordBtn.addEventListener('click', toggleRecording);

clearAllBtn.addEventListener('click', () => {
  showConfirmModal('¿Borrar todas las incidencias?', 'Esta acción no se puede deshacer', async () => {
    const incidents = feed.querySelectorAll('.incident[data-incident-id]');
    const deletePromises = Array.from(incidents).map(i =>
      fetch(`/api/incidents/${i.dataset.incidentId}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {})
    );
    await Promise.all(deletePromises);
    feed.innerHTML = '';
    updateEmptyState();
  });
});

let incidentsOffset = 0;
const INCIDENTS_LIMIT = 25;

function renderIncidentFromDB(dbIncident) {
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

  let bulletsHTML = '';
  let footerHTML = '';
  let noBugHTML = '';
  let spinnerHTML = '';

  if (isPending) {
    spinnerHTML = '<div class="incident-spinner js-spinner"></div>';
  } else if (hasBullets) {
    const parsedBullets = Array.isArray(dbIncident.bullets) ? dbIncident.bullets : (() => { try { return JSON.parse(dbIncident.bullets); } catch { return []; } })();
    bulletsHTML = `<ul class="incident-bullets">${parsedBullets.map(b => `<li>${ensurePeriod(capitalize(b))}</li>`).join('')}</ul>`;
    footerHTML = `<div class="incident-footer"><button class="btn-create-ticket">Crear ticket en ClickUp <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg></button></div>`;

    incident.dataset.summaryTitle = dbIncident.title;
    incident.dataset.summaryTranscript = dbIncident.transcript;
    incident.dataset.summaryBullets = JSON.stringify(dbIncident.bullets);
  } else {
    noBugHTML = `<p class="incident-no-bug">No hay información suficiente para generar el ticket.</p>`;
    incident.dataset.summaryTranscript = dbIncident.transcript;
  }

  if (dbIncident.clickup_task_url) {
    footerHTML = `<div class="incident-footer"><a href="${dbIncident.clickup_task_url}" target="_blank" rel="noopener" class="text-sm text-accent hover:underline">Ver ticket <svg class="w-4 h-4" style="display:inline;vertical-align:middle;margin-left:2px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg></a></div>`;
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
      ${bulletsHTML}
      ${noBugHTML}
      ${spinnerHTML}
    </div>
    ${footerHTML}
  `;
  incident.querySelector('.incident-text').textContent = displayText;

  if (hasBullets && !dbIncident.clickup_task_url) {
    const footer = incident.querySelector('.incident-footer');
    if (footer) attachTicketButton(incident, footer);
  }

  incident.querySelector('.incident-delete').addEventListener('click', async () => {
    try {
      await fetch(`/api/incidents/${incident.dataset.incidentId}`, { method: 'DELETE', headers: authHeaders() });
    } catch { /* degradacion graceful */ }
    incident.remove();
    updateEmptyState();
  });

  return incident;
}

async function loadIncidents(append = false) {
  if (!append) {
    incidentsOffset = 0;
    emptyState.classList.add('hidden');
    feed.innerHTML = '';
  }
  try {
    const res = await fetch(`/api/incidents?limit=${INCIDENTS_LIMIT}&offset=${incidentsOffset}`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const incidents = data.data?.incidents || [];
    const total = data.data?.total || 0;

    incidents.forEach(dbIncident => {
      feed.appendChild(renderIncidentFromDB(dbIncident));
    });

    incidentsOffset += incidents.length;

    const existingBtn = document.getElementById('load-more-btn');
    if (existingBtn) existingBtn.remove();

    if (incidentsOffset < total) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'load-more-btn';
      loadMoreBtn.className = 'mx-auto block py-2 px-4 text-sm text-gray-400 hover:text-accent cursor-pointer';
      loadMoreBtn.textContent = 'Cargar más';
      loadMoreBtn.addEventListener('click', () => loadIncidents(true));
      feed.appendChild(loadMoreBtn);
    }

    updateEmptyState();
  } catch {
    /* fallo silencioso */
  }
}

function handleExtensionMode() {
  const params = new URLSearchParams(location.search);
  const highlightId = params.get('highlight');

  if (highlightId) {
    history.replaceState({}, '', location.pathname);
    const target = feed.querySelector(`.incident[data-incident-id="${highlightId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('incident-highlight');
      setTimeout(() => target.classList.remove('incident-highlight'), 3000);
    }
  }
}

function resumePendingIncidents() {
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

function handleHashRegister() {
  if (location.hash === '#register') {
    history.replaceState({}, '', location.pathname);
    const session = getSession();
    if (!session?.token) {
      setLoginMode(true);
      loginScreen.classList.remove('hidden');
    }
  }
}

window.addEventListener('hashchange', handleHashRegister);

function adoptExtensionSession() {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const email = params.get('email');
  if (token && email && !getSession()?.token) {
    localStorage.setItem('bugshot_session', JSON.stringify({ token, user: { email } }));
  }
  if (token || email) {
    params.delete('token');
    params.delete('email');
    const qs = params.toString();
    history.replaceState({}, '', location.pathname + (qs ? '?' + qs : ''));
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  adoptExtensionSession();
  handleHashRegister();
  const authed = checkAuth();
  if (authed) {
    await loadIncidents();
    handleExtensionMode();
    resumePendingIncidents();
    initMic();
  }
  updateEmptyState();
});

setInterval(() => {
  document.querySelectorAll('.js-time-relative').forEach((el) => {
    const incident = el.closest('.incident');
    if (incident?.dataset.createdAt) {
      el.textContent = timeAgo(parseUTC(incident.dataset.createdAt));
    }
  });
}, 60000);
