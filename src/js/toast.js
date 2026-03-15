const toastContainer = document.getElementById('toast-container');

export function showToast(message, durationMs = 4000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
  scheduleRemoval(toast, durationMs);
}

export function showToastWithLink(text, linkText, linkUrl, durationMs = 6000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.append(text + ' ');
  const a = document.createElement('a');
  a.href = linkUrl;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = linkText;
  a.style.cssText = 'color:#4a9ec5;text-decoration:underline;';
  toast.appendChild(a);
  toastContainer.appendChild(toast);
  scheduleRemoval(toast, durationMs);
}

function scheduleRemoval(toast, ms) {
  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    toast.addEventListener('transitionend', () => toast.remove());
  }, ms);
}
