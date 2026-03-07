import { AttachmentManager } from './attachments.js';

const modal = document.getElementById('ticket-modal');
const titleInput = document.getElementById('ticket-title');
const descriptionEl = document.getElementById('ticket-description');
const reportedByInput = document.getElementById('ticket-reported-by');
const affectedUserInput = document.getElementById('ticket-affected-user');
const projectIdInput = document.getElementById('ticket-project-id');
const assetIdInput = document.getElementById('ticket-asset-id');
const submitBtn = document.getElementById('ticket-submit-btn');
const cancelBtn = document.getElementById('ticket-cancel-btn');
const closeBtn = document.getElementById('ticket-close-btn');
const progressContainer = document.getElementById('ticket-progress');
const progressBar = document.getElementById('ticket-progress-bar');
const attachFileBtn = document.getElementById('attach-file-btn');
const attachCameraBtn = document.getElementById('attach-camera-btn');
const fileInput = document.getElementById('attach-file-input');
const cameraOverlay = document.getElementById('camera-overlay');
const cameraViewfinder = document.getElementById('camera-viewfinder');
const cameraCanvas = document.getElementById('camera-canvas');
const cameraCaptureBtn = document.getElementById('camera-capture-btn');
const cameraCancelBtn = document.getElementById('camera-cancel-btn');
let cameraStream = null;
const previewsContainer = document.getElementById('attachment-previews');
const attachmentError = document.getElementById('attachment-error');
const modalError = document.getElementById('ticket-modal-error');
const appBadges = document.querySelectorAll('#app-badges .badge-app');
let selectedApp = '';

appBadges.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('selected')) {
      btn.classList.remove('selected');
      selectedApp = '';
    } else {
      appBadges.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedApp = btn.dataset.app;
    }
  });
});

let attachments = null;
let currentCardElement = null;
let currentTranscript = '';
let createdTaskId = null;

function setProgress(percent) {
  progressContainer.classList.remove('hidden');
  progressBar.style.width = percent + '%';
}

function resetProgress() {
  progressContainer.classList.add('hidden');
  progressBar.style.width = '0%';
}

function showAttachmentError(msg) {
  attachmentError.textContent = msg;
  attachmentError.classList.remove('invisible');
  setTimeout(() => attachmentError.classList.add('invisible'), 4000);
}

function showModalError(msg) {
  modalError.textContent = msg;
  modalError.classList.remove('hidden');
}

function hideModalError() {
  modalError.classList.add('hidden');
  modalError.textContent = '';
}

function closeModal() {
  closeCamera();
  modal.classList.add('hidden');
  if (attachments) {
    attachments.clear();
    attachments = null;
  }
  titleInput.value = '';
  descriptionEl.value = '';
  reportedByInput.value = '';
  affectedUserInput.value = '';
  projectIdInput.value = '';
  assetIdInput.value = '';
  submitBtn.disabled = false;
  submitBtn.textContent = 'Crear Ticket';
  resetProgress();
  hideModalError();
  attachmentError.classList.add('invisible');
  appBadges.forEach(b => b.classList.remove('selected'));
  selectedApp = '';
  currentCardElement = null;
  currentTranscript = '';
  createdTaskId = null;

  const retryBtn = modal.querySelector('.btn-retry-attachments');
  if (retryBtn) retryBtn.remove();
}

export function openTicketModal(cardData) {
  currentCardElement = cardData.cardElement;
  currentTranscript = cardData.transcript || '';
  createdTaskId = null;

  titleInput.value = cardData.title || '';

  const ensurePeriod = s => s && /[.!?]$/.test(s.trim()) ? s.trim() : s.trim() + '.';
  const capitalize = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const bulletsText = (cardData.bullets || []).map(b => '- ' + ensurePeriod(capitalize(b))).join('\n');
  descriptionEl.value = bulletsText;

  attachments = new AttachmentManager(previewsContainer);

  modal.classList.remove('hidden');
  modal.querySelector('.modal-panel').scrollTop = 0;
}

attachFileBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) {
    const err = attachments.addFiles(fileInput.files);
    if (err) showAttachmentError(err);
    fileInput.value = '';
  }
});

async function openCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    cameraViewfinder.srcObject = cameraStream;
    cameraOverlay.classList.remove('hidden');
  } catch {
    showAttachmentError('Cámara sin permisos.');
  }
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  cameraViewfinder.srcObject = null;
  cameraOverlay.classList.add('hidden');
}

function capturePhoto() {
  const video = cameraViewfinder;
  cameraCanvas.width = video.videoWidth;
  cameraCanvas.height = video.videoHeight;
  const ctx = cameraCanvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  cameraCanvas.toBlob((blob) => {
    if (!blob) {
      showAttachmentError('Error al capturar la foto.');
      closeCamera();
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = new File([blob], `foto-${timestamp}.jpg`, { type: 'image/jpeg' });
    const err = attachments.addFiles([file]);
    if (err) showAttachmentError(err);
    closeCamera();
  }, 'image/jpeg', 0.92);
}

attachCameraBtn.addEventListener('click', openCamera);
cameraCaptureBtn.addEventListener('click', capturePhoto);
cameraCancelBtn.addEventListener('click', closeCamera);

closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);


async function uploadAttachments(taskId, files) {
  const formData = new FormData();
  formData.append('taskId', taskId);
  files.forEach(f => formData.append('attachment', f));

  const res = await fetch('/api/attachment', { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw { partial: data.uploaded > 0, data };
  return data;
}

submitBtn.addEventListener('click', async () => {
  const name = titleInput.value.trim();
  if (!name) {
    showModalError('El título es obligatorio.');
    return;
  }

  submitBtn.disabled = true;
  hideModalError();
  setProgress(10);

  const bullets = descriptionEl.value;
  let markdownDescription = bullets;
  if (currentTranscript) {
    markdownDescription += '\n\n---\n\n**Transcripción completa:**\n\n' + currentTranscript;
  }

  try {
    const ticketRes = await fetch('/api/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        markdown_description: markdownDescription,
        reportedBy: reportedByInput.value.trim(),
        affectedUser: affectedUserInput.value.trim(),
        projectId: projectIdInput.value.trim(),
        assetId: assetIdInput.value.trim()
      })
    });

    if (!ticketRes.ok) {
      const err = await ticketRes.json().catch(() => ({}));
      const msg = typeof err.error === 'string' ? err.error : JSON.stringify(err.error || 'Error al crear el ticket');
      throw new Error(msg);
    }

    const ticket = await ticketRes.json();
    createdTaskId = ticket.id;
    setProgress(50);

    const files = attachments ? attachments.getFiles() : [];
    if (files.length > 0) {
      try {
        await uploadAttachments(ticket.id, files);
        setProgress(90);
      } catch (attErr) {
        setProgress(90);
        markCardAsSent(ticket.url);
        showModalError('Ticket creado pero algunos adjuntos fallaron.');

        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn-retry-attachments text-sm px-3 py-1.5 border border-accent text-accent rounded-lg hover:bg-accent/5 cursor-pointer mt-2';
        retryBtn.textContent = 'Reintentar adjuntos';
        retryBtn.addEventListener('click', async () => {
          retryBtn.disabled = true;
          hideModalError();
          setProgress(60);
          try {
            await uploadAttachments(createdTaskId, attachments.getFiles());
            setProgress(100);
            setTimeout(() => {
              closeModal();
              showToast('Adjuntos subidos correctamente.');
            }, 400);
          } catch {
            setProgress(90);
            retryBtn.disabled = false;
            showModalError('Los adjuntos siguen fallando. Intenta de nuevo.');
          }
        });
        modalError.after(retryBtn);

        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear Ticket';
        return;
      }
    }

    setProgress(100);
    markCardAsSent(ticket.url);

    setTimeout(() => {
      closeModal();
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `Ticket creado. <a href="${ticket.url}" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:underline;">Ver en ClickUp</a>`;
      document.getElementById('toast-container').appendChild(toast);
      setTimeout(() => {
        toast.classList.add('toast-fade-out');
        toast.addEventListener('transitionend', () => toast.remove());
      }, 6000);
    }, 400);

  } catch (err) {
    showModalError(err.message || 'Error inesperado');
    submitBtn.disabled = false;
    resetProgress();
  }
});

function markCardAsSent(ticketUrl) {
  if (!currentCardElement) return;

  const badge = currentCardElement.querySelector('.js-status-badge');
  if (badge) {
    badge.textContent = 'Enviada';
    badge.className = 'badge badge-sent js-status-badge';
  }

  const footer = currentCardElement.querySelector('.card-footer');
  if (footer) {
    footer.innerHTML = `
      <a href="${ticketUrl}" target="_blank" rel="noopener" class="text-sm text-accent hover:underline">Ver ticket en ClickUp</a>
    `;
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 4000);
}
