import { authHeaders, handleExpiredSession, isUnauthorized } from './auth.js';
import { UI } from './strings.js';
import { showToast } from './toast.js';

const modal = document.getElementById('settings-modal');
const closeBtn = document.getElementById('settings-close-btn');
const cancelBtn = document.getElementById('settings-cancel-btn');
const saveBtn = document.getElementById('settings-save-btn');
const providerRadios = document.querySelectorAll('input[name="ai-provider"]');
const anthropicSection = document.getElementById('settings-anthropic-section');
const openaiSection = document.getElementById('settings-openai-section');
const anthropicKeyInput = document.getElementById('settings-anthropic-key');
const openaiKeyInput = document.getElementById('settings-openai-key');
const clickupKeyInput = document.getElementById('settings-clickup-key');
const clickupListInput = document.getElementById('settings-clickup-list');
const errorEl = document.getElementById('settings-error');

function getSelectedProvider() {
  return document.querySelector('input[name="ai-provider"]:checked')?.value || 'anthropic';
}

function updateProviderVisibility() {
  const isOpenAI = getSelectedProvider() === 'openai';
  anthropicSection.classList.toggle('hidden', isOpenAI);
  openaiSection.classList.toggle('hidden', !isOpenAI);
}

providerRadios.forEach((r) => r.addEventListener('change', updateProviderVisibility));

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

function hideError() {
  errorEl.classList.add('hidden');
}

function applyKeyField(input, meta) {
  input.value = '';
  input.placeholder = meta?.configured ? meta.hint : '';
}

async function loadSettings() {
  const res = await fetch('/api/settings', { headers: authHeaders() });
  if (isUnauthorized(res)) {
    handleExpiredSession();
    return;
  }
  if (!res.ok) return;
  const data = await res.json();
  const provider = data.ai_provider || 'anthropic';
  providerRadios.forEach((r) => {
    r.checked = r.value === provider;
  });
  applyKeyField(anthropicKeyInput, data.anthropic_api_key);
  applyKeyField(openaiKeyInput, data.openai_api_key);
  applyKeyField(clickupKeyInput, data.clickup_api_key);
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
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

saveBtn.addEventListener('click', async () => {
  hideError();
  saveBtn.disabled = true;

  const body = {
    ai_provider: getSelectedProvider(),
    clickup_list_id: clickupListInput.value.trim(),
  };
  if (anthropicKeyInput.value.trim()) body.anthropic_api_key = anthropicKeyInput.value.trim();
  if (openaiKeyInput.value.trim()) body.openai_api_key = openaiKeyInput.value.trim();
  if (clickupKeyInput.value.trim()) body.clickup_api_key = clickupKeyInput.value.trim();

  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  saveBtn.disabled = false;

  if (isUnauthorized(res)) {
    handleExpiredSession();
    return;
  }
  if (!res.ok) {
    showError(UI.SETTINGS_SAVE_ERROR);
    return;
  }

  showToast(UI.SETTINGS_SAVED);
  closeModal();
});
