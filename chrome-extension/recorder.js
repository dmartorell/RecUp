const BUGSHOT_URL = 'http://localhost:3000';

let mediaStream = null;
let audioContext = null;
let analyser = null;
let waveformAnimId = null;
let timerInterval = null;
let recordingStartTime = null;

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
  if (!analyser) return;
  const bars = document.querySelectorAll('.waveform-bar');
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  const step = Math.floor(dataArray.length / bars.length);
  bars.forEach((bar, i) => {
    const value = dataArray[i * step] || 0;
    bar.style.height = Math.max(4, Math.round((value / 255) * 40)) + 'px';
  });
  waveformAnimId = requestAnimationFrame(animateWaveform);
}

async function startRecording() {
  document.getElementById('mic-error').classList.add('hidden');
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    const errEl = document.getElementById('mic-error');
    errEl.textContent = `Error micrófono: ${err.name} — ${err.message}`;
    errEl.classList.remove('hidden');
    return;
  }

  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  audioContext.createMediaStreamSource(mediaStream).connect(analyser);

  document.getElementById('mic-idle').classList.add('hidden');
  document.getElementById('mic-recording').classList.remove('hidden');

  recordingStartTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);
  animateWaveform();

  window.startTranscription(() => {});
}

async function stopRecording() {
  clearInterval(timerInterval);
  cancelAnimationFrame(waveformAnimId);

  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  if (audioContext) audioContext.close();

  document.getElementById('mic-idle').classList.remove('hidden');
  document.getElementById('mic-recording').classList.add('hidden');
  document.querySelectorAll('.waveform-bar').forEach(bar => { bar.style.height = '4px'; });

  const transcript = await window.stopTranscription();
  const issueText = document.getElementById('issue-text');
  if (transcript) issueText.value = transcript;

  const transcriptSection = document.getElementById('transcript-section');
  transcriptSection.style.display = 'flex';
  transcriptSection.classList.remove('hidden');

  mediaStream = null;
  audioContext = null;
  analyser = null;
}

document.getElementById('mic-btn').addEventListener('click', () => {
  initWaveformBars();
  startRecording();
});

document.getElementById('stop-btn').addEventListener('click', stopRecording);

document.getElementById('send-btn').addEventListener('click', () => {
  const content = document.getElementById('issue-text').value.trim();
  if (!content) return;
  const url = BUGSHOT_URL + '/?mode=extension&content=' + encodeURIComponent(content);
  chrome.tabs.create({ url });
  window.close();
});
