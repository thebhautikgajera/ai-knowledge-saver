// background.js (service worker)
// Handles context menu "Save to Knowledge Saver" and saving pages in the background.

const TOKEN_KEY = 'aiKnowledgeSaverAccessToken';
const API_BASE_URL = 'http://localhost:4000';
const ITEMS_ENDPOINT = '/api/items';

const KS_NOTIFICATION_ID = 'ai-knowledge-saver-notification';

const ksGetStoredToken = () =>
  new Promise((resolve, reject) => {
    chrome.storage.local.get([TOKEN_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(result[TOKEN_KEY] || null);
    });
  });

const ksShowNotification = (message, type = 'info') => {
  const iconUrl =
    type === 'success'
      ? 'icons/success-128.png'
      : type === 'error'
      ? 'icons/error-128.png'
      : 'icons/info-128.png';

  // Fallback to default icon if custom icons are not present
  chrome.notifications.create(KS_NOTIFICATION_ID, {
    type: 'basic',
    iconUrl,
    title: 'AI Knowledge Saver',
    message,
    priority: 1,
  });
};

const ksRequestPageMetadata = (tabId) =>
  new Promise((resolve) => {
    if (!tabId) {
      resolve(null);
      return;
    }

    chrome.tabs.sendMessage(
      tabId,
      { type: 'GET_PAGE_METADATA' },
      (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) {
          resolve(null);
          return;
        }
        resolve(response.data || null);
      }
    );
  });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save_to_ai_knowledge_saver',
    title: 'Save to Knowledge Saver',
    contexts: ['page'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'save_to_ai_knowledge_saver') {
    return;
  }

  try {
    const token = await ksGetStoredToken();
    if (!token) {
      ksShowNotification('Token not set in extension popup.', 'error');
      return;
    }

    const pageUrl = info.pageUrl || tab?.url;
    const pageTitle = tab?.title || 'Untitled Page';
    const metadata = await ksRequestPageMetadata(tab?.id ?? null);

    // Fallback domain if content script couldn't determine it
    let domain = '';
    try {
      if (pageUrl) {
        const parsed = new URL(pageUrl);
        domain = parsed.hostname.replace(/^www\./i, '');
      }
    } catch {
      domain = '';
    }

    const payload = {
      title: metadata?.title || pageTitle,
      url: pageUrl,
      description: metadata?.description ?? '',
      domain: metadata?.domain || domain,
      favicon: metadata?.favicon ?? '',
      previewImage: metadata?.previewImage ?? '',
      type: metadata?.type || undefined,
      extraMetadata: metadata?.extraMetadata ?? {},
    };

    // Debug log to help verify what is being sent to the backend
    console.log('[AI Knowledge Saver][background] Sending payload:', payload);

    const response = await fetch(`${API_BASE_URL}${ITEMS_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      ksShowNotification('Failed to save page.', 'error');
      return;
    }

    ksShowNotification('Page saved to Knowledge Saver.', 'success');
  } catch (error) {
    console.error('Context menu save error:', error);
    ksShowNotification('Unexpected error while saving page.', 'error');
  }
});

