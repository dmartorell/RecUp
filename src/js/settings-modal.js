import { authHeaders, handleExpiredSession, isUnauthorized } from './auth.js';
import { showToast } from './toast.js';
import { UI } from './strings.js';

const modal = document.getElementById('settings-modal');
const closeBtn = document.getElementById('settings-close-btn');
const cancelBtn = document.getElementById('settings-cancel-btn');
const saveBtn = document.getElementById('settings-save-btn');
const providerSelect = document.getElementById('settings-ai-provider');
const anthropicSection = document.getElementById('settings-anthropic-section');
const openaiSection = document.getElementById('settings-openai-section');
const anthropicKeyInput = document.getElementById('settings-anthropic-key');
const openaiKeyInput = document.getElementById('settings-openai-key');
const clickupKeyInput = document.getElementById('settings-clickup-key');
const clickupListInput = document.getElementById('settings-clickup-list');
const errorEl = document.getElementById('settings-error');

function updateProviderVisibility() {
  const isOpenAI = providerSelect.value === 'openai';
  anthropicSection.classList.toggle('hidden', isOpenAI);
  openaiSection.classList.toggle('hidden', !isOpenAI);
}

providerSelect.addEventListener('change', updateProviderVisibility);

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

function hideError() {
  errorEl.classList.add('hidden');
}

async function loadSettings() {
  const res = await fetch('/api/settings', { headers: authHeaders() });
  if (isUnauthorized(res)) { handleExpiredSession(); return; }
  if (!res.ok) return;
  const data = await res.json();
  providerSelect.value = data.ai_provider || 'anthropic';
  anthropicKeyInput.value = data.anthropic_api_key || '';
  openaiKeyInput.value = data.openai_api_key || '';
  clickupKeyInput.value = data.clickup_api_key || '';
  clickupListInput.value = data.clickup_list_id || '';
  updateProviderVisibility();
}

export function openSettingsModal() {
  hideError();
  modal.classList.remove('hidden');
  loadSettings();
}

function closeModal() {
  modal.classList.add('hidden');
}

closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

saveBtn.addEventListener('click', async () => {
  hideError();
  saveBtn.disabled = true;

  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      ai_provider: providerSelect.value,
      anthropic_api_key: anthropicKeyInput.value.trim(),
      openai_api_key: openaiKeyInput.value.trim(),
      clickup_api_key: clickupKeyInput.value.trim(),
      clickup_list_id: clickupListInput.value.trim(),
    }),
  });

  saveBtn.disabled = false;

  if (isUnauthorized(res)) { handleExpiredSession(); return; }
  if (!res.ok) { showError(UI.SETTINGS_SAVE_ERROR); return; }

  showToast(UI.SETTINGS_SAVED);
  closeModal();
});
