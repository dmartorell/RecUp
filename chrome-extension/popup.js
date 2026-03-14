const BUGSHOT_URL = 'http://localhost:3000';

let mediaStream = null;
let audioContext = null;
let analyser = null;
let waveformAnimId = null;
let timerInterval = null;
let recordingStartTime = null;
let usedAudio = false;

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

function hideAllViews() {
  Object.values(views).forEach(v => v.classList.add('hidden'));
}

function showLogin() {
  hideAllViews();
  views.login.classList.remove('hidden');
  els.email.value = '';
  els.password.value = '';
  els.loginError.textContent = 'Credenciales incorrectas';
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

async function startRecording() {
  document.getElementById('mic-error').classList.add('hidden');
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    const errEl = document.getElementById('mic-error');
    errEl.textContent = err.name === 'NotAllowedError'
      ? 'Permiso de micrófono denegado.'
      : `Error micrófono: ${err.name}`;
    errEl.classList.remove('hidden');
    return;
  }

  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 64;
  audioContext.createMediaStreamSource(mediaStream).connect(analyser);

  document.getElementById('mic-idle').classList.add('hidden');
  document.getElementById('mic-recording').classList.remove('hidden');

  document.getElementById('timer-display').textContent = '00:00';
  recordingStartTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);
  animateWaveform();

  window.startTranscription(() => {});
}

async function stopRecording() {
  cancelAnimationFrame(waveformAnimId);
  clearInterval(timerInterval);

  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  if (audioContext) audioContext.close();

  document.getElementById('mic-idle').classList.remove('hidden');
  document.getElementById('mic-recording').classList.add('hidden');
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
    els.loginError.textContent = 'Introduce email y contraseña';
    els.loginError.classList.add('visible');
    return;
  }

  els.btnLogin.disabled = true;
  els.btnLogin.textContent = 'Entrando...';
  els.loginError.classList.remove('visible');

  try {
    const res = await fetch(`${BUGSHOT_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();

    if (json.success) {
      chrome.storage.local.set(
        { bugshot_token: json.data.token, bugshot_email: json.data.user.email },
        () => checkMicPermission(json.data.user.email)
      );
    } else {
      els.loginError.textContent = json.error || 'Credenciales incorrectas';
      els.loginError.classList.add('visible');
    }
  } catch {
    els.loginError.textContent = 'Error de conexión';
    els.loginError.classList.add('visible');
  } finally {
    els.btnLogin.disabled = false;
    els.btnLogin.textContent = 'Login';
  }
}

function handleLogout() {
  chrome.storage.local.remove(['bugshot_token', 'bugshot_email'], () => {
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

  chrome.storage.local.get(['bugshot_token', 'bugshot_email'], (stored) => {
    const email = stored.bugshot_email || els.userEmail.textContent || '';
    const token = stored.bugshot_token || '';
    const source = usedAudio ? 'audio' : 'text';
    const url = BUGSHOT_URL + '/?mode=extension&content=' + encodeURIComponent(content)
      + '&email=' + encodeURIComponent(email)
      + '&source=' + source
      + '&token=' + encodeURIComponent(token);
    usedAudio = false;

    chrome.tabs.query({ url: BUGSHOT_URL + '/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { url, active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.create({ url });
      }
      window.close();
    });
  });
});

document.getElementById('btn-register').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `${BUGSHOT_URL}/#register` });
  window.close();
});

document.getElementById('mic-btn').addEventListener('click', startRecording);
document.getElementById('stop-btn').addEventListener('click', stopRecording);

document.getElementById('btn-grant-mic').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    chrome.storage.local.get(['bugshot_email'], (result) => {
      showIdle(result.bugshot_email || '');
    });
  } catch {
    showMicPrompt(true);
  }
});

async function validateToken(token, email) {
  try {
    const res = await fetch(`${BUGSHOT_URL}/api/cards?limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status === 401) {
      chrome.storage.local.remove(['bugshot_token', 'bugshot_email'], () => showLogin());
    } else {
      checkMicPermission(email);
    }
  } catch {
    checkMicPermission(email);
  }
}

chrome.storage.local.get(['bugshot_token', 'bugshot_email'], (result) => {
  if (result.bugshot_token && result.bugshot_email) {
    validateToken(result.bugshot_token, result.bugshot_email);
  } else {
    showLogin();
  }
});
