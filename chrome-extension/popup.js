const PASSWORD = '1234';
const BUGSHOT_URL = 'http://localhost:3000';

let mediaStream = null;
let audioContext = null;
let analyser = null;
let waveformAnimId = null;
let timerInterval = null;
let recordingStartTime = null;

const views = {
  login: document.getElementById('view-login'),
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

function showLogin() {
  views.idle.classList.add('hidden');
  views.login.classList.remove('hidden');
  els.email.value = '';
  els.password.value = '';
  els.loginError.classList.add('hidden');
}

function showIdle(email) {
  views.login.classList.add('hidden');
  views.idle.classList.remove('hidden');
  els.userEmail.textContent = email;
  els.issueText.value = '';
  els.sendBtn.disabled = true;
  initWaveformBars();
}

function initWaveformBars() {
  const waveformEl = document.getElementById('waveform');
  if (waveformEl.children.length > 0) return;
  const NUM_BARS = 5;
  for (let i = 0; i < NUM_BARS; i++) {
    const bar = document.createElement('div');
    bar.className = 'waveform-bar';
    bar.style.height = '4px';
    waveformEl.appendChild(bar);
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
  const bars = document.querySelectorAll('.waveform-bar');
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  const step = Math.floor(dataArray.length / bars.length);
  bars.forEach((bar, i) => {
    const value = dataArray[i * step] || 0;
    const height = Math.max(4, Math.round((value / 255) * 40));
    bar.style.height = height + 'px';
  });
  waveformAnimId = requestAnimationFrame(animateWaveform);
}

async function startRecording() {
  document.getElementById('mic-error').classList.add('hidden');
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (_) {
    const errEl = document.getElementById('mic-error');
    errEl.textContent = 'Acceso al micrófono denegado.';
    errEl.classList.remove('hidden');
    return;
  }

  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  const source = audioContext.createMediaStreamSource(mediaStream);
  source.connect(analyser);

  document.getElementById('mic-idle').classList.add('hidden');
  document.getElementById('mic-recording').classList.remove('hidden');

  recordingStartTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);

  animateWaveform();

  window.startTranscription((err) => {});
}

async function stopRecording() {
  clearInterval(timerInterval);
  cancelAnimationFrame(waveformAnimId);

  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
  }
  if (audioContext) {
    audioContext.close();
  }

  document.getElementById('mic-idle').classList.remove('hidden');
  document.getElementById('mic-recording').classList.add('hidden');

  document.querySelectorAll('.waveform-bar').forEach(bar => {
    bar.style.height = '4px';
  });

  const transcript = await window.stopTranscription();
  if (transcript) {
    els.issueText.value = transcript;
    els.issueText.dispatchEvent(new Event('input'));
  }

  mediaStream = null;
  audioContext = null;
  analyser = null;
}

function handleLogin() {
  const email = els.email.value.trim();
  const password = els.password.value;

  if (!email) {
    els.loginError.textContent = 'Introduce tu email.';
    els.loginError.classList.remove('hidden');
    return;
  }

  if (password !== PASSWORD) {
    els.loginError.textContent = 'Credenciales incorrectas.';
    els.loginError.classList.remove('hidden');
    return;
  }

  chrome.storage.local.set({ bugshot_token: 'local', bugshot_email: email }, () => {
    showIdle(email);
  });
}

function handleLogout() {
  chrome.storage.local.remove(['bugshot_token', 'bugshot_email'], () => {
    showLogin();
  });
}

els.btnLogin.addEventListener('click', handleLogin);
els.btnLogout.addEventListener('click', handleLogout);

els.password.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});

els.issueText.addEventListener('input', () => {
  els.sendBtn.disabled = els.issueText.value.trim().length === 0;
});

els.sendBtn.addEventListener('click', () => {
  const content = els.issueText.value.trim();
  if (!content) return;

  chrome.storage.local.get(['bugshot_token'], (result) => {
    const token = result.bugshot_token || 'local';
    chrome.storage.session.set({ bugshot_content: content, bugshot_token: token }, () => {
      chrome.tabs.create({ url: BUGSHOT_URL + '/?mode=extension' });
      window.close();
    });
  });
});

document.getElementById('mic-btn').addEventListener('click', startRecording);
document.getElementById('stop-btn').addEventListener('click', stopRecording);

chrome.storage.local.get(['bugshot_token', 'bugshot_email'], (result) => {
  if (result.bugshot_token && result.bugshot_email) {
    showIdle(result.bugshot_email);
  } else {
    showLogin();
  }
});
