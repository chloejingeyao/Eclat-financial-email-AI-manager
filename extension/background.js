import { scanEmailsStreaming } from './services/api-client.js';

const CACHE_KEY = 'eclat_last_scan';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'SCAN') {
    const tabId = sender.tab?.id;
    handleScan(msg.startDate, msg.endDate, tabId)
      .then(sendResponse)
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (msg.action === 'GET_CACHED_SCAN') {
    chrome.storage.local.get(CACHE_KEY, d => sendResponse(d[CACHE_KEY] ?? null));
    return true;
  }
});

async function handleScan(startDate, endDate, tabId) {
  const result = await scanEmailsStreaming(startDate, endDate, (progress) => {
    if (tabId != null) {
      chrome.tabs.sendMessage(tabId, { action: 'SCAN_PROGRESS', ...progress }).catch(() => {});
    }
  });
  await new Promise(r => chrome.storage.local.set({
    [CACHE_KEY]: { ...result, startDate, endDate, cachedAt: Date.now() }
  }, r));
  return result;
}
