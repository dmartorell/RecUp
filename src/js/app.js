import { requestMicAccess, getStream, startRecording, stopRecording } from './recorder.js';
import { startTranscription, stopTranscription } from './transcriber.js';
import { initVisualizer, startVisualization, stopVisualization } from './visualizer.js';
import { summarize } from './summarizer.js';

function isBrowserCompatible() {
  return !!window.chrome;
}

if (!isBrowserCompatible()) {
  document.getElementById('app').style.display = 'none';
  document.getElementById('unsupported').style.display = 'flex';
}

let isRecording = false;
let timerInterval = null;
let startTime = null;
let micReady = false;

const recordBtn = document.getElementById('record-btn');
const recordingIndicator = document.getElementById('recording-indicator');
const timerDisplay = document.getElementById('timer');
const waveform = document.getElementById('waveform');
const feed = document.getElementById('feed');
const emptyState = document.getElementById('empty-state');
const clearAllBtn = document.getElementById('clear-all-btn');
const toastContainer = document.getElementById('toast-container');

const micIcon = `<svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"/></svg>`;
const stopIcon = `<svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;

async function initMic() {
  try {
    await requestMicAccess();
    micReady = true;
  } catch (err) {
    showToast(err.message);
  }
}

async function toggleRecording() {
  if (!micReady) {
    await initMic();
    if (!micReady) return;
  }

  if (!isRecording) {
    isRecording = true;
    recordBtn.innerHTML = stopIcon;
    recordBtn.classList.add('animate-pulse-recording');

    recordingIndicator.classList.remove('hidden');
    recordingIndicator.classList.add('opacity-100');
    recordingIndicator.classList.remove('opacity-0');

    startTime = Date.now();
    timerDisplay.textContent = '00:00';
    timerInterval = setInterval(() => {
      timerDisplay.textContent = formatDuration(Date.now() - startTime);
    }, 1000);

    initVisualizer(getStream());
    startVisualization(waveform);

    startTranscription((error) => {
      showToast('Error de transcripcion: ' + error);
    });

    startRecording();
  } else {
    isRecording = false;
    recordBtn.innerHTML = micIcon;
    recordBtn.classList.remove('animate-pulse-recording');

    recordingIndicator.classList.remove('opacity-100');
    recordingIndicator.classList.add('opacity-0');
    setTimeout(() => {
      recordingIndicator.classList.add('hidden');
    }, 300);

    clearInterval(timerInterval);
    const duration = Date.now() - startTime;

    stopVisualization();
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
  const timestamp = new Date().toLocaleTimeString('es-ES');

  card.dataset.audioBlobUrl = URL.createObjectURL(audioBlob);

  if (!rawText) {
    card.innerHTML = `
      <div class="card-header">
        <div class="card-badges">
          <span class="badge badge-audio">Audio</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="card-time">${timestamp} · ${durationStr}</span>
          <button class="card-delete" aria-label="Eliminar">&times;</button>
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

  let displayText = rawText;
  if (!displayText.endsWith('.') && !displayText.endsWith('?') && !displayText.endsWith('!')) {
    displayText += '.';
  }

  card.innerHTML = `
    <div class="card-header">
      <div class="card-badges">
        <span class="badge badge-audio">Audio</span>
        <span class="badge badge-processing js-status-badge">Processing</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="card-time">${timestamp} · ${durationStr}</span>
        <button class="card-delete" aria-label="Eliminar">&times;</button>
      </div>
    </div>
    <div class="card-body">
      <p class="card-text">${displayText}</p>
      <div class="card-spinner js-spinner"></div>
    </div>
  `;

  card.querySelector('.card-delete').addEventListener('click', () => {
    card.remove();
    updateEmptyState();
  });

  feed.prepend(card);
  updateEmptyState();

  runSummarize(card, rawText);
}

function runSummarize(card, rawText) {
  summarize(rawText).then((result) => {
    const badge = card.querySelector('.js-status-badge');
    badge.textContent = 'Completed';
    badge.className = 'badge badge-completed js-status-badge';

    const spinner = card.querySelector('.js-spinner');
    if (spinner) spinner.remove();

    const body = card.querySelector('.card-body');

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = result.title;
    body.insertBefore(title, body.firstChild);

    const textEl = card.querySelector('.card-text');
    textEl.textContent = result.transcript;

    const bullets = document.createElement('ul');
    bullets.className = 'card-bullets';
    result.bullets.forEach((b) => {
      const li = document.createElement('li');
      li.textContent = b;
      bullets.appendChild(li);
    });
    body.appendChild(bullets);

    const footer = document.createElement('div');
    footer.className = 'card-footer';
    footer.innerHTML = `<button class="btn-create-ticket" disabled>Crear Ticket</button>`;
    card.appendChild(footer);

    card.dataset.summaryTitle = result.title;
    card.dataset.summaryTranscript = result.transcript;
    card.dataset.summaryBullets = JSON.stringify(result.bullets);
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
      badge.textContent = 'Processing';
      badge.className = 'badge badge-processing js-status-badge';

      const newSpinner = document.createElement('div');
      newSpinner.className = 'card-spinner js-spinner';
      body.appendChild(newSpinner);

      retryBtn.remove();
      runSummarize(card, rawText);
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
  feed.innerHTML = '';
  updateEmptyState();
});

document.addEventListener('DOMContentLoaded', initMic);
