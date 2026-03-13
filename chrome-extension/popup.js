const PASSWORD = '1234';
const BUGSHOT_URL = 'http://localhost:3000';

let transcriptionRunning = false;
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
  for (let i = 0; i < 5; i++) {
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
  if (!transcriptionRunning) return;
  const bars = document.querySelectorAll('.waveform-bar');
  const baseHeights = [8, 20, 32, 20, 8];
  bars.forEach((bar, i) => {
    const h = Math.max(4, baseHeights[i] + (Math.random() - 0.5) * 24);
    bar.style.height = Math.round(h) + 'px';
  });
  waveformAnimId = setTimeout(animateWaveform, 120);
}

function startRecording() {
  document.getElementById('mic-error').classList.add('hidden');
  document.getElementById('mic-idle').classList.add('hidden');
  document.getElementById('mic-recording').classList.remove('hidden');

  transcriptionRunning = true;
  recordingStartTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);
  animateWaveform();

  window.startTranscription((err) => {
    if (err) {
      const errEl = document.getElementById('mic-error');
      errEl.textContent = `Error: ${err}`;
      errEl.classList.remove('hidden');
      stopRecording();
    }
  });
}

async function stopRecording() {
  transcriptionRunning = false;
  clearInterval(timerInterval);
  clearTimeout(waveformAnimId);

  document.getElementById('mic-idle').classList.remove('hidden');
  document.getElementById('mic-recording').classList.add('hidden');
  document.querySelectorAll('.waveform-bar').forEach(bar => { bar.style.height = '4px'; });

  const transcript = await window.stopTranscription();
  if (transcript) {
    els.issueText.value = transcript;
    els.issueText.dispatchEvent(new Event('input'));
  }
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

  const url = BUGSHOT_URL + '/?mode=extension&content=' + encodeURIComponent(content);
  chrome.tabs.create({ url });
  window.close();
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
