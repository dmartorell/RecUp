import { requestMicAccess, getStream, startRecording, stopRecording } from './recorder.js';
import { startTranscription, stopTranscription } from './transcriber.js';
import { summarize } from './summarizer.js';
import { openTicketModal } from './ticket-modal.js';

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
function ensurePeriod(str) { return /[.?!]$/.test(str) ? str : str + '.'; }

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

let isRegisterMode = false;

function setLoginMode(register) {
  isRegisterMode = register;
  loginNameField.classList.toggle('hidden', !register);
  loginBtn.textContent = register ? 'Registrarse' : 'Entrar';
  loginToggleLink.textContent = register ? 'Ya tengo cuenta' : 'No tienes cuenta? Registrate';
  loginError.classList.remove('visible');
  loginError.classList.add('invisible');
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
  userAvatar.classList.remove('hidden');
}

function checkAuth() {
  const session = getSession();
  if (session?.token && session?.user) {
    showApp(session.user.email);
    loadCards();
  } else {
    loginScreen.classList.remove('hidden');
  }
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
    showLoginError('Email y contraseña son obligatorios.');
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
    loadCards();
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
  const height = Math.max(3, normalized * 26);
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
  } else {
    isRecording = false;
    recordingUI.classList.add('hidden');
    micIcon.classList.remove('hidden');
    cancelAnimationFrame(animFrameId);
    waveformBars.forEach(bar => bar.style.height = '3px');

    clearInterval(timerInterval);
    const duration = Date.now() - startTime;

    const transcript = await stopTranscription();
    const audioBlob = await stopRecording();

    createCard(transcript, audioBlob, duration);
  }
}

function createCard(transcript, audioBlob, duration) {
  const card = document.createElement('div');
  card.className = 'card';

  const rawText = transcript.trim();
  const durationStr = formatDuration(duration);
  const createdAt = new Date();

  const hasAudio = !!audioBlob;
  if (audioBlob && audioBlob instanceof Blob) {
    card.dataset.audioBlobUrl = URL.createObjectURL(audioBlob);
  }
  card.dataset.createdAt = createdAt.toISOString();

  const typeBadgeClass = hasAudio ? 'badge-audio' : 'badge-text';
  const typeBadgeLabel = hasAudio ? 'Audio' : 'Texto';

  if (!rawText) {
    card.innerHTML = `
      <div class="card-header">
        <div class="card-badges">
          <span class="badge ${typeBadgeClass}">${typeBadgeLabel}</span>
          <span class="badge badge-duration">${durationStr}</span>
        </div>
        <div style="display:flex;align-items:center;gap:16px">
          <span class="card-time js-time-relative">${timeAgo(createdAt)}</span>
          <button class="card-delete" aria-label="Eliminar"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg></button>
        </div>
      </div>
      <div class="card-body">
        <p class="card-text">No se detecto voz. Intenta grabar de nuevo.</p>
      </div>
    `;
    card.querySelector('.card-delete').addEventListener('click', () => {
      card.remove();
      updateEmptyState();
    });
    feed.prepend(card);
    updateEmptyState();
    return;
  }

  let displayText = ensurePeriod(capitalize(rawText));

  card.innerHTML = `
    <div class="card-header">
      <div class="card-badges">
        <span class="badge ${typeBadgeClass}">${typeBadgeLabel}</span>
        <span class="badge badge-processing js-status-badge">Procesando</span>
        <span class="badge badge-duration">${durationStr}</span>
      </div>
      <div style="display:flex;align-items:center;gap:16px">
        <span class="card-time js-time-relative">${timeAgo(createdAt)}</span>
        <button class="card-delete" aria-label="Eliminar"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg></button>
      </div>
    </div>
    <div class="card-body">
      <p class="card-text"></p>
      <div class="card-spinner js-spinner"></div>
    </div>
  `;
  card.querySelector('.card-text').textContent = displayText;

  card.querySelector('.card-delete').addEventListener('click', async () => {
    const cardId = card.dataset.cardId;
    if (cardId) {
      try {
        await fetch(`/api/cards/${cardId}`, { method: 'DELETE', headers: authHeaders() });
      } catch { /* degradacion graceful */ }
    }
    card.remove();
    updateEmptyState();
  });

  feed.prepend(card);
  updateEmptyState();

  const sourceType = hasAudio ? 'audio' : 'text';
  runSummarize(card, rawText, sourceType, duration);
}

async function persistCard(payload) {
  try {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.card?.id || null;
  } catch {
    return null;
  }
}

function attachTicketButton(card, footer) {
  const ticketBtn = footer.querySelector('.btn-create-ticket');
  ticketBtn.addEventListener('click', async () => {
    if (card.querySelector('.badge-sent')) return;
    openTicketModal({
      title: card.dataset.summaryTitle,
      transcript: card.dataset.summaryTranscript,
      bullets: JSON.parse(card.dataset.summaryBullets),
      cardElement: card,
      onTicketCreated: async (taskId, taskUrl) => {
        const cardId = card.dataset.cardId;
        if (cardId) {
          try {
            await fetch(`/api/cards/${cardId}`, {
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

function runSummarize(card, rawText, sourceType, durationMs) {
  summarize(rawText).then(async (result) => {
    const badge = card.querySelector('.js-status-badge');
    const spinner = card.querySelector('.js-spinner');
    if (spinner) spinner.remove();

    const body = card.querySelector('.card-body');

    if (!result.is_bug) {
      badge.textContent = 'Completado';
      badge.className = 'badge badge-completed js-status-badge';

      const msg = document.createElement('p');
      msg.className = 'card-no-bug';
      msg.textContent = 'No hay información suficiente para generar el ticket.';
      body.appendChild(msg);

      card.dataset.summaryTranscript = rawText;

      const cardId = await persistCard({
        transcript: rawText,
        status: 'completado',
        source_type: sourceType || 'audio',
        duration_ms: durationMs || 0
      });
      if (cardId) card.dataset.cardId = cardId;
      return;
    }

    badge.textContent = 'Completado';
    badge.className = 'badge badge-completed js-status-badge';

    card.dataset.summaryTitle = result.title;

    const bullets = document.createElement('ul');
    bullets.className = 'card-bullets';
    result.bullets.forEach((b) => {
      const li = document.createElement('li');
      li.textContent = ensurePeriod(capitalize(b));
      bullets.appendChild(li);
    });
    body.appendChild(bullets);

    const footer = document.createElement('div');
    footer.className = 'card-footer';
    footer.innerHTML = `<button class="btn-create-ticket">Crear ticket en ClickUp <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg></button>`;
    card.appendChild(footer);

    card.dataset.summaryTranscript = result.transcript;
    card.dataset.summaryBullets = JSON.stringify(result.bullets);

    attachTicketButton(card, footer);

    const cardId = await persistCard({
      transcript: rawText,
      title: result.title,
      bullets: JSON.stringify(result.bullets),
      status: 'completado',
      source_type: sourceType || 'audio',
      duration_ms: durationMs || 0
    });
    if (cardId) card.dataset.cardId = cardId;

  }).catch((err) => {
    const badge = card.querySelector('.js-status-badge');
    badge.textContent = 'Error';
    badge.className = 'badge badge-error js-status-badge';

    const spinner = card.querySelector('.js-spinner');
    if (spinner) spinner.remove();

    const body = card.querySelector('.card-body');
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-retry';
    retryBtn.textContent = 'Reintentar';
    retryBtn.addEventListener('click', () => {
      badge.textContent = 'Procesando';
      badge.className = 'badge badge-processing js-status-badge';

      const newSpinner = document.createElement('div');
      newSpinner.className = 'card-spinner js-spinner';
      body.appendChild(newSpinner);

      retryBtn.remove();
      runSummarize(card, rawText, sourceType, durationMs);
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

clearAllBtn.addEventListener('click', async () => {
  const cards = feed.querySelectorAll('.card[data-card-id]');
  const deletePromises = Array.from(cards).map(c =>
    fetch(`/api/cards/${c.dataset.cardId}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {})
  );
  await Promise.all(deletePromises);
  feed.innerHTML = '';
  updateEmptyState();
});

let cardsOffset = 0;
const CARDS_LIMIT = 20;

function renderCardFromDB(dbCard) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.cardId = dbCard.id;
  card.dataset.createdAt = dbCard.created_at;

  const createdAt = new Date(dbCard.created_at);
  const durationStr = formatDuration(dbCard.duration_ms || 0);
  const sourceType = dbCard.source_type || 'audio';
  const typeBadgeClass = sourceType === 'audio' ? 'badge-audio' : 'badge-text';
  const typeBadgeLabel = sourceType === 'audio' ? 'Audio' : 'Texto';
  const statusBadgeClass = dbCard.status === 'error' ? 'badge-error' : 'badge-completed';
  const statusLabel = dbCard.status === 'error' ? 'Error' : 'Completado';

  const hasBullets = dbCard.bullets && dbCard.title;
  const displayText = capitalize(dbCard.transcript || '');

  let bulletsHTML = '';
  let footerHTML = '';
  let noBugHTML = '';

  if (hasBullets) {
    let parsedBullets = [];
    try { parsedBullets = JSON.parse(dbCard.bullets); } catch { parsedBullets = []; }
    bulletsHTML = `<ul class="card-bullets">${parsedBullets.map(b => `<li>${ensurePeriod(capitalize(b))}</li>`).join('')}</ul>`;
    footerHTML = `<div class="card-footer"><button class="btn-create-ticket">Crear ticket en ClickUp <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg></button></div>`;

    card.dataset.summaryTitle = dbCard.title;
    card.dataset.summaryTranscript = dbCard.transcript;
    card.dataset.summaryBullets = dbCard.bullets;
  } else {
    noBugHTML = `<p class="card-no-bug">No hay información suficiente para generar el ticket.</p>`;
    card.dataset.summaryTranscript = dbCard.transcript;
  }

  let ticketLinkHTML = '';
  if (dbCard.clickup_task_url) {
    footerHTML = `<div class="card-footer"><a href="${dbCard.clickup_task_url}" target="_blank" rel="noopener" class="text-sm text-accent hover:underline">Ver ticket <svg class="w-4 h-4" style="display:inline;vertical-align:middle;margin-left:2px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg></a></div>`;
  }

  const sentBadge = dbCard.clickup_task_id
    ? `<span class="badge badge-sent js-status-badge">Enviado</span>`
    : `<span class="badge ${statusBadgeClass} js-status-badge">${statusLabel}</span>`;

  card.innerHTML = `
    <div class="card-header">
      <div class="card-badges">
        <span class="badge ${typeBadgeClass}">${typeBadgeLabel}</span>
        ${sentBadge}
        <span class="badge badge-duration">${durationStr}</span>
      </div>
      <div style="display:flex;align-items:center;gap:16px">
        <span class="card-time js-time-relative">${timeAgo(createdAt)}</span>
        <button class="card-delete" aria-label="Eliminar"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg></button>
      </div>
    </div>
    <div class="card-body">
      <p class="card-text"></p>
      ${bulletsHTML}
      ${noBugHTML}
    </div>
    ${footerHTML}
  `;
  card.querySelector('.card-text').textContent = displayText;

  if (hasBullets && !dbCard.clickup_task_url) {
    const footer = card.querySelector('.card-footer');
    if (footer) attachTicketButton(card, footer);
  }

  card.querySelector('.card-delete').addEventListener('click', async () => {
    try {
      await fetch(`/api/cards/${card.dataset.cardId}`, { method: 'DELETE', headers: authHeaders() });
    } catch { /* degradacion graceful */ }
    card.remove();
    updateEmptyState();
  });

  return card;
}

async function loadCards(append = false) {
  if (!append) {
    cardsOffset = 0;
    feed.innerHTML = '';
  }
  try {
    const res = await fetch(`/api/cards?limit=${CARDS_LIMIT}&offset=${cardsOffset}`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const cards = data.data?.cards || [];
    const total = data.data?.total || 0;

    cards.forEach(dbCard => {
      feed.appendChild(renderCardFromDB(dbCard));
    });

    cardsOffset += cards.length;

    const existingBtn = document.getElementById('load-more-btn');
    if (existingBtn) existingBtn.remove();

    if (cardsOffset < total) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'load-more-btn';
      loadMoreBtn.className = 'w-full py-2 text-sm text-gray-400 hover:text-accent cursor-pointer';
      loadMoreBtn.textContent = 'Cargar más';
      loadMoreBtn.addEventListener('click', () => loadCards(true));
      feed.appendChild(loadMoreBtn);
    }

    updateEmptyState();
  } catch {
    /* fallo silencioso */
  }
}

function handleExtensionMode() {
  const params = new URLSearchParams(location.search);
  if (params.get('mode') !== 'extension') return;

  const content = params.get('content');
  if (!content) return;

  const source = params.get('source') || 'text';

  history.replaceState({}, '', location.pathname);

  const session = getSession();
  if (!session?.token) {
    const token = params.get('token') || 'local';
    localStorage.setItem('bugshot_session', JSON.stringify({ token, user: { id: null, name: 'Extension', email: params.get('email') || 'extension@bugshot' } }));
    showApp(params.get('email') || 'extension@bugshot');
  }

  createCard(content, source === 'audio' ? 'ext-audio' : null, 0);
}

document.addEventListener('DOMContentLoaded', () => {
  handleExtensionMode();
  checkAuth();
  initMic();
  updateEmptyState();
});

setInterval(() => {
  document.querySelectorAll('.js-time-relative').forEach((el) => {
    const card = el.closest('.card');
    if (card?.dataset.createdAt) {
      el.textContent = timeAgo(new Date(card.dataset.createdAt));
    }
  });
}, 60000);
