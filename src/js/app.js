import { requestMicAccess, getStream, startRecording, stopRecording, releaseStream } from './recorder.js';
import { startTranscription, stopTranscription } from './transcriber.js';
import { showToast } from './toast.js';
import { getSession, authHeaders } from './auth.js';
import { formatDuration, parseUTC, timeAgo } from './time.js';
import { showConfirmModal } from './confirm-modal.js';
import { createIncident, renderIncidentFromDB, updateEmptyState, resumePendingIncidents, buildOnTicketCreated } from './incident-renderer.js';
import { openTicketModal } from './ticket-modal.js';
import { UI, apiError } from './strings.js';

function scrollFeedToTop() {
  const mainEl = document.querySelector('main');
  if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
}

function hydrateStaticStrings() {
  const map = {
    'unsupported-title': UI.UNSUPPORTED_TITLE,
    'unsupported-msg': UI.UNSUPPORTED_MSG,
    'unsupported-cta': UI.UNSUPPORTED_CTA,
    'login-desc': UI.LOGIN_DESC,
    'empty-state-title': UI.EMPTY_STATE_TITLE,
    'empty-state-msg': UI.EMPTY_STATE_MSG,
    'ticket-modal-title': UI.TICKET_MODAL_TITLE,
    'ticket-modal-subtitle': UI.TICKET_MODAL_SUBTITLE,
    'missing-banner-title': UI.TICKET_MISSING_BANNER_TITLE,
    'missing-banner-msg': UI.TICKET_MISSING_BANNER_MSG,
    'missing-banner-cta': UI.TICKET_MISSING_BANNER_CTA,
    'text-input-title': UI.TEXT_INPUT_TITLE,
  };
  for (const [id, text] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  const tagline = document.getElementById('login-tagline');
  if (tagline) tagline.innerHTML = UI.LOGIN_TAGLINE;
  const textArea = document.getElementById('text-input-area');
  if (textArea) textArea.placeholder = UI.TEXT_INPUT_PLACEHOLDER;
}

hydrateStaticStrings();

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
  loginBtn.textContent = register ? UI.LOGIN_BTN_REGISTER : UI.LOGIN_BTN;
  loginToggleLink.textContent = register ? UI.LOGIN_TOGGLE_HAS_ACCOUNT : UI.LOGIN_TOGGLE_REGISTER;
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
  loginError.textContent = msg || UI.LOGIN_ERROR_DEFAULT;
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
    showLoginError(UI.LOGIN_ERROR_REQUIRED);
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
        showLoginError(UI.LOGIN_ERROR_NAME_REQUIRED);
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
      showLoginError(apiError(data.error));
      loginBtn.disabled = false;
      loginBtn.textContent = originalText;
      return;
    }

    localStorage.setItem('recup_session', JSON.stringify({ token: data.data.token, user: data.data.user }));
    loginBtn.disabled = false;
    loginBtn.textContent = originalText;
    showApp(data.data.user.email);
    await loadIncidents();
    resumePendingIncidents();
  } catch {
    showLoginError(UI.LOGIN_ERROR_NETWORK);
    loginBtn.disabled = false;
    loginBtn.textContent = originalText;
  }
});

loginPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

document.getElementById('btn-logout').addEventListener('click', () => {
  showConfirmModal(UI.LOGOUT_TITLE, UI.LOGOUT_MSG, () => {
    localStorage.removeItem('recup_session');
    location.reload();
  }, { okLabel: UI.LOGOUT_BTN, danger: false });
});

const RECORDING_TIMEOUT_MS = 5 * 60 * 1000;

let isRecording = false;
let timerInterval = null;
let startTime = null;
let analyser = null;
let animFrameId = null;
let audioCtx = null;
let recordingTimeoutId = null;

const recordBtn = document.getElementById('record-btn');
const micIcon = document.getElementById('mic-icon');
const recordingUI = document.getElementById('recording-ui');
const timerDisplay = document.getElementById('timer');
const waveformBars = document.querySelectorAll('.waveform-bar');
const feed = document.getElementById('feed');
const clearAllBtn = document.getElementById('clear-all-btn');
const textInputBtn = document.getElementById('text-input-btn');
const textInputModal = document.getElementById('text-input-modal');
const textInputArea = document.getElementById('text-input-area');
const textInputSubmit = document.getElementById('text-input-submit');
const textInputCancel = document.getElementById('text-input-cancel');
const modeToggleBtn = document.getElementById('mode-toggle-btn');
const modeIconKeyboard = document.getElementById('mode-icon-keyboard');
const modeIconMic = document.getElementById('mode-icon-mic');
let inputMode = localStorage.getItem('recup_input_mode') || 'mic';

function setPageInteractive(enabled) {
  const targets = [
    modeToggleBtn,
    clearAllBtn,
    userAvatar,
    ...feed.querySelectorAll('button, a'),
  ];
  targets.forEach(el => {
    if (!el) return;
    el.classList.toggle('ui-disabled', !enabled);
  });
}

const MIN_TEXT_INPUT_LENGTH = 4;

function updateTextSubmitState() {
  textInputSubmit.disabled = textInputArea.value.trim().length < MIN_TEXT_INPUT_LENGTH;
}

function openTextInputModal() {
  textInputModal.classList.remove('hidden');
  textInputArea.value = '';
  updateTextSubmitState();
  requestAnimationFrame(() => textInputArea.focus());
}

function closeTextInputModal() {
  textInputModal.classList.add('hidden');
  textInputArea.value = '';
}

textInputBtn.addEventListener('click', openTextInputModal);
textInputCancel.addEventListener('click', closeTextInputModal);
textInputArea.addEventListener('input', updateTextSubmitState);

function applyInputMode(mode) {
  inputMode = mode;
  if (mode === 'keyboard') {
    recordBtn.classList.add('hidden');
    textInputBtn.classList.remove('hidden');
    modeIconKeyboard.classList.add('hidden');
    modeIconMic.classList.remove('hidden');
  } else {
    textInputBtn.classList.add('hidden');
    recordBtn.classList.remove('hidden');
    modeIconMic.classList.add('hidden');
    modeIconKeyboard.classList.remove('hidden');
  }
}

function toggleInputMode() {
  if (isRecording) return;
  const newMode = inputMode === 'mic' ? 'keyboard' : 'mic';
  applyInputMode(newMode);
  localStorage.setItem('recup_input_mode', newMode);
}

modeToggleBtn.addEventListener('click', toggleInputMode);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !textInputModal.classList.contains('hidden')) {
    closeTextInputModal();
  }
});

textInputSubmit.addEventListener('click', () => {
  const text = textInputArea.value.trim();
  if (!text) return;
  closeTextInputModal();
  scrollFeedToTop();
  createIncident(text, null, 0);
});

function animateWaveform() {
  const dataArray = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(dataArray);
  let peak = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = Math.abs(dataArray[i] - 128);
    if (v > peak) peak = v;
  }
  const WAVEFORM_PEAK_DIVISOR = 15;
  const WAVEFORM_MAX_HEIGHT = 18;
  const WAVEFORM_MIN_HEIGHT = 3;
  const normalized = Math.min(1, peak / WAVEFORM_PEAK_DIVISOR);
  const height = Math.max(WAVEFORM_MIN_HEIGHT, normalized * WAVEFORM_MAX_HEIGHT);
  waveformBars.forEach(bar => bar.style.height = height + 'px');
  animFrameId = requestAnimationFrame(animateWaveform);
}

function forceCleanup() {
  isRecording = false;
  setPageInteractive(true);
  modeToggleBtn.classList.remove('pointer-events-none', 'opacity-40');
  recordingUI.classList.add('hidden');
  micIcon.classList.remove('hidden');
  recordBtn.classList.remove('bg-accent-hover');
  recordBtn.classList.add('bg-accent');
  cancelAnimationFrame(animFrameId);
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  waveformBars.forEach(bar => bar.style.height = '3px');
  clearInterval(timerInterval);
  clearTimeout(recordingTimeoutId);
  recordingTimeoutId = null;
  stopTranscription().catch(() => {});
  stopRecording().catch(() => {});
  releaseStream();
}

async function toggleRecording() {
  if (!isRecording) {
    if (!getStream()) {
      try {
        await requestMicAccess();
      } catch (err) {
        showToast(err.message);
        return;
      }
    }
    isRecording = true;
    modeToggleBtn.classList.add('pointer-events-none', 'opacity-40');
    micIcon.classList.add('hidden');
    recordingUI.classList.remove('hidden');
    startTime = Date.now();
    timerDisplay.textContent = '00:00';
    timerInterval = setInterval(() => {
      timerDisplay.textContent = formatDuration(Date.now() - startTime);
    }, 1000);

    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(getStream());
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    animateWaveform();

    startTranscription((error, isFatal) => {
      showToast(UI.TRANSCRIPTION_ERROR_PREFIX + error);
      if (isFatal) forceCleanup();
    });

    recordingTimeoutId = setTimeout(() => {
      showToast(UI.RECORDING_AUTO_STOP);
      forceCleanup();
    }, RECORDING_TIMEOUT_MS);

    startRecording();
    scrollFeedToTop();
    recordBtn.classList.remove('bg-accent');
    recordBtn.classList.add('bg-accent-hover');
    setPageInteractive(false);
  } else {
    clearTimeout(recordingTimeoutId);
    recordingTimeoutId = null;
    isRecording = false;
    setPageInteractive(true);
    modeToggleBtn.classList.remove('pointer-events-none', 'opacity-40');
    recordingUI.classList.add('hidden');
    micIcon.classList.remove('hidden');
    recordBtn.classList.remove('bg-accent-hover');
    recordBtn.classList.add('bg-accent');
    cancelAnimationFrame(animFrameId);
    if (audioCtx) { audioCtx.close(); audioCtx = null; }
    waveformBars.forEach(bar => bar.style.height = '3px');

    clearInterval(timerInterval);
    const duration = Date.now() - startTime;

    const transcript = await stopTranscription();
    const audioBlob = await stopRecording();
    releaseStream();

    createIncident(transcript, audioBlob, duration);
  }
}

recordBtn.addEventListener('click', toggleRecording);

clearAllBtn.addEventListener('click', () => {
  showConfirmModal(UI.CLEAR_ALL_TITLE, UI.CLEAR_ALL_MSG, async () => {
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

async function loadIncidents(append = false) {
  if (!append) {
    incidentsOffset = 0;
    document.getElementById('empty-state').classList.add('hidden');
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
      loadMoreBtn.textContent = UI.LOAD_MORE;
      loadMoreBtn.addEventListener('click', () => loadIncidents(true));
      feed.appendChild(loadMoreBtn);
    }

    updateEmptyState();
  } catch (e) {
    console.warn('loadIncidents:', e);
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

      if (target.dataset.summaryTitle && !target.querySelector('.badge-sent')) {
        openTicketModal({
          title: target.dataset.summaryTitle,
          transcript: target.dataset.summaryTranscript,
          bullets: JSON.parse(target.dataset.summaryBullets),
          incidentElement: target,
          onTicketCreated: buildOnTicketCreated(target)
        });
      }
    }
  }
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
  const name = params.get('name');
  if (token && email && !getSession()?.token) {
    localStorage.setItem('recup_session', JSON.stringify({ token, user: { email, ...(name && { name }) } }));
  }
  if (token || email) {
    params.delete('token');
    params.delete('email');
    params.delete('name');
    const qs = params.toString();
    history.replaceState({}, '', location.pathname + (qs ? '?' + qs : ''));
  }
}

async function handleExternalText() {
  const params = new URLSearchParams(location.search);
  const contextText = params.get('contextText');
  if (contextText) {
    params.delete('contextText');
    const qs = params.toString();
    history.replaceState({}, '', location.pathname + (qs ? '?' + qs : ''));
    createIncident(contextText, null, 0);
    scrollFeedToTop();
    return true;
  }

  return false;
}

document.addEventListener('DOMContentLoaded', async () => {
  adoptExtensionSession();
  handleHashRegister();
  if (inputMode !== 'mic') applyInputMode(inputMode);
  const authed = checkAuth();
  if (authed) {
    await loadIncidents();
    const handledExternal = await handleExternalText();
    if (!handledExternal) {
      handleExtensionMode();
    }
    resumePendingIncidents();
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
