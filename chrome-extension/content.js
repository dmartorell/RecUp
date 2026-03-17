window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'recup:logout') {
    chrome.runtime.sendMessage({ type: 'recup:logout' });
  }
});
