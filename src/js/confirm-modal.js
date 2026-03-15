const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-modal-title');
const confirmMessage = document.getElementById('confirm-modal-message');
const confirmOk = document.getElementById('confirm-modal-ok');
const confirmCancel = document.getElementById('confirm-modal-cancel');

import { UI } from './strings.js';

let confirmAbort = null;

const RED_CLASSES = ['bg-red-500', 'hover:bg-red-600'];
const BLUE_CLASSES = ['bg-accent', 'hover:bg-accent-hover'];

export function showConfirmModal(title, message, onConfirm, { okLabel = UI.CONFIRM_DELETE, danger = true } = {}) {
  if (confirmAbort) confirmAbort.abort();
  confirmAbort = new AbortController();
  const { signal } = confirmAbort;

  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmOk.textContent = okLabel;
  confirmOk.classList.remove(...RED_CLASSES, ...BLUE_CLASSES);
  confirmOk.classList.add(...(danger ? RED_CLASSES : BLUE_CLASSES));
  confirmModal.classList.remove('hidden');
  const cleanup = () => { confirmModal.classList.add('hidden'); confirmAbort.abort(); };
  confirmCancel.addEventListener('click', cleanup, { signal });
  confirmOk.addEventListener('click', () => { cleanup(); onConfirm(); }, { signal });
}

export function hideConfirmModal() {
  confirmModal.classList.add('hidden');
  if (confirmAbort) confirmAbort.abort();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !confirmModal.classList.contains('hidden')) {
    hideConfirmModal();
  }
});
