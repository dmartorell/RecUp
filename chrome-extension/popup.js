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
  els.loginError.classList.remove('visible');
}

function showIdle(email) {
  views.login.classList.add('hidden');
  views.idle.classList.remove('hidden');
  els.userEmail.textContent = email;
  els.issueText.value = '';
  els.sendBtn.disabled = true;
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
  }

  mediaStream = null;
  audioContext = null;
  analyser = null;
}

function handleLogin() {
  const email = els.email.value.trim();
  const password = els.password.value;

  if (!email || password !== PASSWORD) {
    els.loginError.classList.add('visible');
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

[els.email, els.password].forEach(input => {
  input.addEventListener('focus', () => els.loginError.classList.remove('visible'));
});

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
