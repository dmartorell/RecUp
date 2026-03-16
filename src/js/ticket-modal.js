import { AttachmentManager } from './attachments.js';
import { capitalize, ensurePeriod } from './utils.js';
import { showToast, showToastWithLink } from './toast.js';
import { getSession } from './auth.js';
import { UI, apiError } from './strings.js';

const modal = document.getElementById('ticket-modal');
const titleInput = document.getElementById('ticket-title');
const descriptionEl = document.getElementById('ticket-description');
const assetIdInput = document.getElementById('ticket-asset-id');
const appVersionInput = document.getElementById('ticket-app-version');
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
const platformBadges = document.querySelectorAll('#platform-badges .badge-platform');
const missingBanner = document.getElementById('missing-fields-banner');
const missingList = document.getElementById('missing-fields-list');
const missingCompleteBtn = document.getElementById('missing-fields-complete-btn');
let selectedApp = 'alfred';
let selectedPlatform = 'iOS';

appBadges.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('selected')) return;
    appBadges.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedApp = btn.dataset.app;
    const webProducts = ['dkey', 'assets', 'assets-beta'];
    if (webProducts.includes(selectedApp)) {
      platformBadges.forEach(b => b.classList.toggle('selected', b.dataset.platform === 'Web'));
      selectedPlatform = 'Web';
    }
  });
});

platformBadges.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('selected')) return;
    platformBadges.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedPlatform = btn.dataset.platform;
  });
});

let attachments = null;
let currentIncidentElement = null;
let currentTranscript = '';
let createdTaskId = null;
let onTicketCreatedCallback = null;

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
  modalError.classList.remove('invisible');
}

function hideModalError() {
  modalError.classList.add('invisible');
  modalError.textContent = '';
}

function closeModal() {
  if (submitting) return;
  closeCamera();
  modal.classList.add('hidden');
  if (attachments) {
    attachments.clear();
    attachments = null;
  }
  titleInput.value = '';
  descriptionEl.value = '';
  assetIdInput.value = '';
  appVersionInput.value = '';
  setSubmitting(false);
  submitBtn.textContent = UI.TICKET_BTN;
  resetProgress();
  hideModalError();
  attachmentError.classList.add('invisible');
  appBadges.forEach(b => b.classList.remove('selected'));
  platformBadges.forEach(b => b.classList.remove('selected'));
  selectedApp = '';
  selectedPlatform = '';
  currentIncidentElement = null;
  currentTranscript = '';
  createdTaskId = null;
  onTicketCreatedCallback = null;
  hideMissingBanner();
  bannerShown = false;

  const retryBtn = modal.querySelector('.btn-retry-attachments');
  if (retryBtn) retryBtn.remove();
}

export function openTicketModal(incidentData) {
  currentIncidentElement = incidentData.incidentElement;
  currentTranscript = incidentData.transcript || '';
  createdTaskId = null;
  onTicketCreatedCallback = incidentData.onTicketCreated || null;

  titleInput.value = incidentData.title || '';

  const bulletsText = (incidentData.bullets || []).map(b => '- ' + ensurePeriod(capitalize(b))).join('\n');
  descriptionEl.value = bulletsText;

  selectedApp = 'alfred';
  selectedPlatform = 'iOS';
  appBadges.forEach(b => b.classList.toggle('selected', b.dataset.app === 'alfred'));
  platformBadges.forEach(b => b.classList.toggle('selected', b.dataset.platform === 'iOS'));

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
    showAttachmentError(UI.TICKET_CAMERA_DENIED);
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
      showAttachmentError(UI.TICKET_PHOTO_ERROR);
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

modal.addEventListener('focusin', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    if (bannerShown) {
      hideMissingBanner();
      bannerShown = false;
    }
    hideModalError();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!cameraOverlay.classList.contains('hidden')) {
    closeCamera();
  } else if (!modal.classList.contains('hidden')) {
    closeModal();
  }
});


async function uploadAttachments(taskId, files) {
  const formData = new FormData();
  formData.append('taskId', taskId);
  files.forEach(f => formData.append('attachment', f));

  const session = getSession();
  const res = await fetch('/api/attachment', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + (session?.token || '') },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw { partial: data.uploaded.length > 0, data };
  return data;
}

function getLoggedEmail() {
  return getSession()?.user?.email || '';
}

function getMissingFields() {
  const missing = [];
  if (!selectedApp) missing.push(UI.TICKET_MISSING_APP);
  if (!selectedPlatform) missing.push(UI.TICKET_MISSING_PLATFORM);
  if (!appVersionInput.value.trim()) missing.push(UI.TICKET_MISSING_APP_VERSION);
  if (!assetIdInput.value.trim()) missing.push(UI.TICKET_MISSING_ASSET_ID);
  return missing;
}

function showMissingBanner(fields) {
  missingList.innerHTML = '';
  fields.forEach(f => {
    const li = document.createElement('li');
    li.textContent = f;
    missingList.appendChild(li);
  });
  missingBanner.classList.remove('hidden');
  const panel = modal.querySelector('.modal-panel');
  panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
  submitBtn.textContent = UI.TICKET_BTN;
  submitBtn.classList.remove('bg-accent', 'hover:bg-accent-hover');
  submitBtn.classList.add('bg-amber-500', 'hover:bg-amber-600');
}

function hideMissingBanner() {
  missingBanner.classList.add('hidden');
  submitBtn.textContent = UI.TICKET_BTN;
  submitBtn.classList.remove('bg-amber-500', 'hover:bg-amber-600');
  submitBtn.classList.add('bg-accent', 'hover:bg-accent-hover');
}

let submitting = false;

function setSubmitting(active) {
  submitting = active;
  submitBtn.disabled = active;
  cancelBtn.disabled = active;
  closeBtn.disabled = active;
  cancelBtn.classList.toggle('opacity-40', active);
  closeBtn.classList.toggle('opacity-40', active);
  attachFileBtn.disabled = active;
  attachCameraBtn.disabled = active;
}

async function executeSubmit() {
  hideMissingBanner();
  bannerShown = false;
  const name = titleInput.value.trim();
  setSubmitting(true);
  hideModalError();
  setProgress(10);

  const selectedBadge = modal.querySelector('#app-badges .badge-app.selected');
  const selectedAppLabel = selectedBadge ? selectedBadge.textContent.trim() : '';
  const bullets = descriptionEl.value;
  let markdownDescription = '**Resumen de la incidencia:**\n\n' + bullets;
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
        reporterEmail: getLoggedEmail(),
        assetId: assetIdInput.value.trim(),
        platform: selectedPlatform,
        appVersion: [appVersionInput.value.trim(), selectedAppLabel].filter(Boolean).join(' ')
      })
    });

    if (!ticketRes.ok) {
      const err = await ticketRes.json().catch(() => ({}));
      if (err.error === 'NO_MEMBER') {
        submitting = false;
        closeModal();
        showToast(UI.TICKET_NO_MEMBER);
        return;
      }
      throw new Error(apiError(typeof err.error === 'string' ? err.error : 'UNKNOWN'));
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
        markCardAsSent(ticket.url, ticket.id);
        showModalError(UI.TICKET_ATTACHMENTS_PARTIAL);

        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn-retry-attachments text-sm px-3 py-1.5 border border-accent text-accent rounded-lg hover:bg-accent/5 cursor-pointer mt-2';
        retryBtn.textContent = UI.TICKET_ATTACHMENTS_RETRY;
        retryBtn.addEventListener('click', async () => {
          retryBtn.disabled = true;
          hideModalError();
          setProgress(60);
          try {
            await uploadAttachments(createdTaskId, attachments.getFiles());
            setProgress(100);
            setTimeout(() => {
              submitting = false;
              closeModal();
              showToast(UI.TICKET_ATTACHMENTS_OK);
            }, 400);
          } catch {
            setProgress(90);
            retryBtn.disabled = false;
            showModalError(UI.TICKET_ATTACHMENTS_FAIL);
          }
        });
        modalError.after(retryBtn);

        setSubmitting(false);
        submitBtn.textContent = UI.TICKET_BTN;
        return;
      }
    }

    setProgress(100);
    markCardAsSent(ticket.url, ticket.id);

    setTimeout(() => {
      submitting = false;
      closeModal();
      showToastWithLink(UI.TICKET_CREATED, UI.TICKET_VIEW_CLICKUP, ticket.url);
    }, 400);

  } catch (err) {
    showModalError(err.message || apiError('UNKNOWN'));
    setSubmitting(false);
    resetProgress();
  }
}

let bannerShown = false;

submitBtn.addEventListener('click', () => {
  const name = titleInput.value.trim();
  if (!name) {
    showModalError(UI.TICKET_TITLE_REQUIRED);
    return;
  }

  const missingFields = getMissingFields();
  if (missingFields.length > 0 && !bannerShown) {
    showMissingBanner(missingFields);
    bannerShown = true;
    return;
  }

  executeSubmit();
});

missingCompleteBtn.addEventListener('click', () => {
  hideMissingBanner();
  bannerShown = false;
  const firstEmpty = !selectedApp ? appBadges[0]
    : !selectedPlatform ? platformBadges[0]
    : !appVersionInput.value.trim() ? appVersionInput
    : assetIdInput;
  firstEmpty.focus();
  firstEmpty.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

function markCardAsSent(ticketUrl, taskId) {
  if (onTicketCreatedCallback && taskId) {
    onTicketCreatedCallback(taskId, ticketUrl).catch(() => {});
  }
  if (!currentIncidentElement) return;

  const badge = currentIncidentElement.querySelector('.js-status-badge');
  if (badge) {
    badge.textContent = UI.STATUS_SENT;
    badge.className = 'badge badge-sent js-status-badge';
  }

  const footer = currentIncidentElement.querySelector('.incident-footer');
  if (footer) {
    footer.textContent = '';
    const link = document.createElement('a');
    link.href = ticketUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'text-sm text-accent hover:underline';
    link.innerHTML = `Ver ticket <svg class="w-4 h-4" style="display:inline;vertical-align:middle;margin-left:2px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>`;
    footer.appendChild(link);
  }
}

