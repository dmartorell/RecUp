const RECUP_URL = 'http://localhost:3000';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-recup',
    title: 'Enviar a RecUp',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'send-to-recup') return;

  const selectionText = info.selectionText || '';
  const contextText = encodeURIComponent(selectionText);

  chrome.storage.local.get(['recup_token', 'recup_email', 'recup_name'], (stored) => {
    const token = stored.recup_token || '';
    const email = stored.recup_email || '';
    const name = stored.recup_name || '';

    let url = `${RECUP_URL}/?contextText=${contextText}`;
    if (token && email) {
      url += `&token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;
    }

    chrome.tabs.query({ url: `${RECUP_URL}/*` }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { url, active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.create({ url });
      }
    });
  });
});
