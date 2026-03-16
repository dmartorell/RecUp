const RECORDING_TIMEOUT_MS = 5 * 60 * 1000;

const API_ERRORS = {
  RATE_LIMITED: 'Demasiados intentos. Espera un minuto.',
  INVALID_EMAIL: 'Email inválido',
  WEAK_PASSWORD: 'Contraseña: mínimo 6 caracteres',
  INVALID_CREDENTIALS: 'Credenciales incorrectas',
  REQUIRED_FIELDS: 'Email y contraseña son obligatorios',
  UNAUTHORIZED: 'No autorizado',
  INTERNAL_ERROR: 'Error interno',
  UNKNOWN: 'Ha ocurrido un error',
};
function apiError(code) { return API_ERRORS[code] || API_ERRORS.UNKNOWN; }

const UI = {
  LOGIN_BTN: 'Entrar',
  LOGIN_BTN_LOADING: 'Entrando...',
  LOGIN_ERROR_DEFAULT: 'Credenciales incorrectas',
  LOGIN_ERROR_REQUIRED: 'Introduce email y contraseña',
  LOGIN_ERROR_NETWORK: 'Error de conexión',
  MIC_DENIED: 'Permiso de micrófono denegado.',
  MIC_ERROR_PREFIX: 'Error micrófono: ',
  RECORDING_AUTO_STOP: 'Grabación detenida (máx. 5 min)',
  SEND_BTN_LOADING: 'Enviando...',
  SEND_ERROR: 'Error al enviar. Intenta de nuevo.',
};

let mediaStream = null;
let audioContext = null;
let analyser = null;
let waveformAnimId = null;
let timerInterval = null;
let recordingStartTime = null;
let recordingTimeoutId = null;
let usedAudio = false;
let lastRecordingDuration = 0;

const views = {
  login: document.getElementById('view-login'),
  micPrompt: document.getElementById('view-mic-prompt'),
  idle: document.getElementById('view-idle'),
};

const els = {
  email: document.getElementById('login-email'),
  password: document.getElementById('login-password'),
  loginError: document.getElementById('login-error'),
  btnLogin: document.getElementById('btn-login'),
  btnLogout: document.getElementById('btn-logout'),
  userEmail: document.getElementById('user-email'),
  issueText: document.getElementById('issue-text'),
  sendBtn: document.getElementById('send-btn'),
};

const togglePasswordBtn = document.getElementById('toggle-password-btn');
const eyeIcon = document.getElementById('eye-icon');
const eyeOffIcon = document.getElementById('eye-off-icon');

togglePasswordBtn.addEventListener('click', () => {
  const isPassword = els.password.type === 'password';
  els.password.type = isPassword ? 'text' : 'password';
  eyeIcon.classList.toggle('hidden', isPassword);
  eyeOffIcon.classList.toggle('hidden', !isPassword);
});

function hideAllViews() {
  Object.values(views).forEach(v => v.classList.add('hidden'));
}

function showLogin() {
  hideAllViews();
  views.login.classList.remove('hidden');
  els.email.value = '';
  els.password.value = '';
  els.loginError.textContent = UI.LOGIN_ERROR_DEFAULT;
  els.loginError.classList.remove('visible');
}

function showMicPrompt(denied = false) {
  hideAllViews();
  views.micPrompt.classList.remove('hidden');
  document.getElementById('mic-denied-msg').classList.toggle('hidden', !denied);
  document.getElementById('btn-grant-mic').classList.toggle('hidden', denied);
}

function showIdle(email) {
  hideAllViews();
  views.idle.classList.remove('hidden');
  els.userEmail.textContent = email;
  els.issueText.value = '';
  els.sendBtn.disabled = true;
}

async function checkMicPermission(email) {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    if (result.state === 'granted') {
      showIdle(email);
    } else if (result.state === 'denied') {
      showMicPrompt(true);
    } else {
      showMicPrompt(false);
    }
  } catch {
    showIdle(email);
  }
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  document.getElementById('timer-display').textContent = mm + ':' + ss;
}

function animateWaveform() {
  if (!analyser) return;
  const dataArray = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(dataArray);
  let peak = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = Math.abs(dataArray[i] - 128);
    if (v > peak) peak = v;
  }
  const height = Math.max(3, Math.min(1, peak / 15) * 26);
  document.querySelectorAll('.waveform-bar').forEach(bar => {
    bar.style.height = height + 'px';
  });
  waveformAnimId = requestAnimationFrame(animateWaveform);
}

function forceCleanup() {
  cancelAnimationFrame(waveformAnimId);
  clearInterval(timerInterval);
  clearTimeout(recordingTimeoutId);
  recordingTimeoutId = null;
  recordingStartTime = null;
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
  if (audioContext) { audioContext.close(); audioContext = null; analyser = null; }
  document.getElementById('mic-idle').classList.remove('hidden');
  document.getElementById('mic-recording').classList.add('hidden');
  document.querySelectorAll('.waveform-bar').forEach(bar => { bar.style.height = '3px'; });
  window.stopTranscription?.().catch?.(() => {});
}

async function startRecording() {
  document.getElementById('mic-error').classList.add('hidden');
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    const errEl = document.getElementById('mic-error');
    errEl.textContent = err.name === 'NotAllowedError'
      ? UI.MIC_DENIED
      : UI.MIC_ERROR_PREFIX + err.name;
    errEl.classList.remove('hidden');
    return;
  }

  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 64;
  audioContext.createMediaStreamSource(mediaStream).connect(analyser);

  document.getElementById('mic-idle').classList.add('hidden');
  const stopBtn = document.getElementById('stop-btn');
  stopBtn.style.transition = 'none';
  stopBtn.style.background = 'var(--accent-hover)';
  document.getElementById('mic-recording').classList.remove('hidden');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      stopBtn.style.transition = '';
      stopBtn.style.background = '';
    });
  });

  document.getElementById('timer-display').textContent = '00:00';
  recordingStartTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);
  animateWaveform();

  window.startTranscription((error, isFatal) => {
    if (isFatal) {
      const errEl = document.getElementById('mic-error');
      errEl.textContent = UI.MIC_ERROR_PREFIX + error;
      errEl.classList.remove('hidden');
      forceCleanup();
    }
  });

  recordingTimeoutId = setTimeout(() => {
    const errEl = document.getElementById('mic-error');
    errEl.textContent = UI.RECORDING_AUTO_STOP;
    errEl.classList.remove('hidden');
    forceCleanup();
  }, RECORDING_TIMEOUT_MS);
}

async function stopRecording() {
  clearTimeout(recordingTimeoutId);
  recordingTimeoutId = null;
  cancelAnimationFrame(waveformAnimId);
  clearInterval(timerInterval);

  lastRecordingDuration = recordingStartTime ? Date.now() - recordingStartTime : 0;
  recordingStartTime = null;

  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  if (audioContext) audioContext.close();

  const micBtn = document.getElementById('mic-btn');
  micBtn.style.transition = 'none';
  document.getElementById('mic-idle').classList.remove('hidden');
  document.getElementById('mic-recording').classList.add('hidden');
  requestAnimationFrame(() => { micBtn.style.transition = ''; });
  document.querySelectorAll('.waveform-bar').forEach(bar => { bar.style.height = '3px'; });

  const transcript = await window.stopTranscription();
  if (transcript) {
    els.issueText.value = transcript;
    els.issueText.dispatchEvent(new Event('input'));
    usedAudio = true;
  }

  mediaStream = null;
  audioContext = null;
  analyser = null;
}

async function handleLogin() {
  const email = els.email.value.trim();
  const password = els.password.value;

  if (!email || !password) {
    els.loginError.textContent = UI.LOGIN_ERROR_REQUIRED;
    els.loginError.classList.add('visible');
    return;
  }

  els.btnLogin.disabled = true;
  els.btnLogin.textContent = UI.LOGIN_BTN_LOADING;
  els.loginError.classList.remove('visible');

  try {
    const res = await fetch(`${RECUP_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();

    if (json.success) {
      chrome.storage.local.set(
        { recup_token: json.data.token, recup_email: json.data.user.email, recup_name: json.data.user.name || '' },
        () => checkMicPermission(json.data.user.email)
      );
    } else {
      els.loginError.textContent = apiError(json.error);
      els.loginError.classList.add('visible');
    }
  } catch {
    els.loginError.textContent = UI.LOGIN_ERROR_NETWORK;
    els.loginError.classList.add('visible');
  } finally {
    els.btnLogin.disabled = false;
    els.btnLogin.textContent = UI.LOGIN_BTN;
  }
}

function handleLogout() {
  chrome.storage.local.remove(['recup_token', 'recup_email', 'recup_name'], () => {
    showLogin();
  });
}

els.btnLogin.addEventListener('click', handleLogin);
els.btnLogout.addEventListener('click', handleLogout);

[els.email, els.password].forEach(input => {
  input.addEventListener('focus', () => els.loginError.classList.remove('visible'));
});

els.password.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});

els.issueText.addEventListener('input', () => {
  els.sendBtn.disabled = els.issueText.value.trim().length === 0;
  if (usedAudio && els.issueText.value.trim().length === 0) {
    usedAudio = false;
  }
});

els.sendBtn.addEventListener('click', () => {
  const content = els.issueText.value.trim();
  if (!content) return;

  chrome.storage.local.get(['recup_token', 'recup_email', 'recup_name'], async (stored) => {
    const token = stored.recup_token || '';
    const sourceType = usedAudio ? 'audio' : 'text';
    const durationMs = usedAudio ? lastRecordingDuration : 0;
    usedAudio = false;
    lastRecordingDuration = 0;

    els.sendBtn.disabled = true;
    const originalText = els.sendBtn.textContent;
    els.sendBtn.textContent = UI.SEND_BTN_LOADING;

    try {
      const res = await fetch(`${RECUP_URL}/api/incidents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: content,
          status: 'procesando',
          source_type: sourceType,
          duration_ms: durationMs,
        }),
      });

      if (!res.ok) throw new Error(UI.SEND_ERROR);
      const data = await res.json();
      const incidentId = data.data?.incident?.id;

      const email = stored.recup_email || '';
      const name = stored.recup_name || '';
      const url = RECUP_URL + '/?highlight=' + (incidentId || '') + '&token=' + encodeURIComponent(token) + '&email=' + encodeURIComponent(email) + '&name=' + encodeURIComponent(name);
      chrome.tabs.query({ url: RECUP_URL + '/*' }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.update(tabs[0].id, { url, active: true });
          chrome.windows.update(tabs[0].windowId, { focused: true });
        } else {
          chrome.tabs.create({ url });
        }
        window.close();
      });
    } catch {
      els.sendBtn.disabled = false;
      els.sendBtn.textContent = originalText;
      const errEl = document.getElementById('mic-error');
      errEl.textContent = UI.SEND_ERROR;
      errEl.classList.remove('hidden');
    }
  });
});

document.getElementById('btn-register').addEventListener('click', (e) => {
  e.preventDefault();
  const registerUrl = `${RECUP_URL}/#register`;
  chrome.tabs.query({ url: `${RECUP_URL}/*` }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { url: registerUrl, active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: registerUrl });
    }
    window.close();
  });
});

document.getElementById('mic-btn').addEventListener('click', startRecording);
document.getElementById('stop-btn').addEventListener('click', stopRecording);

document.getElementById('btn-grant-mic').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    chrome.storage.local.get(['recup_email'], (result) => {
      showIdle(result.recup_email || '');
    });
  } catch {
    showMicPrompt(true);
  }
});

async function validateToken(token, email) {
  try {
    const res = await fetch(`${RECUP_URL}/api/incidents?limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status === 401) {
      chrome.storage.local.remove(['recup_token', 'recup_email'], () => showLogin());
    } else {
      checkMicPermission(email);
    }
  } catch {
    checkMicPermission(email);
  }
}

chrome.storage.local.get(['recup_token', 'recup_email'], (result) => {
  if (result.recup_token && result.recup_email) {
    checkMicPermission(result.recup_email);
    validateToken(result.recup_token, result.recup_email);
  } else {
    showLogin();
  }
});
