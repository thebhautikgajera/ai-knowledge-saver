// background.js (service worker)
// Handles context menu "Save to Knowledge Saver" and saving pages using
// cookie-based sessions (no manual access tokens).

const API_BASE_URL = 'http://localhost:4000';
const SAVE_ENDPOINT = '/save';

const KS_NOTIFICATION_ID = 'ai-knowledge-saver-notification';

const ksShowNotification = (message, type = 'info') => {
  const iconUrl =
    type === 'success'
      ? 'icons/success-128.png'
      : type === 'error'
      ? 'icons/error-128.png'
      : 'icons/info-128.png';

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
    const pageUrl = info.pageUrl || tab?.url;
    const pageTitle = tab?.title || 'Untitled Page';
    const metadata = await ksRequestPageMetadata(tab?.id ?? null);

    // Fallback platform detection based on URL if content script didn't set it
    let platform = metadata?.platform || 'website';
    try {
      if (!metadata?.platform && pageUrl) {
        const lower = pageUrl.toLowerCase();
        if (lower.includes('twitter.com') || lower.includes('x.com')) {
          platform = 'twitter';
        } else if (
          lower.includes('youtube.com') ||
          lower.includes('youtu.be')
        ) {
          platform = 'youtube';
        } else if (lower.includes('linkedin.com')) {
          platform = 'linkedin';
        } else {
          platform = 'website';
        }
      }
    } catch {
      // ignore
    }

    const extensionMetadata = metadata || {
      source: 'extension_dom',
      url: pageUrl,
      title: pageTitle,
      platform,
    };

    console.log(
      '[AI Knowledge Saver][background] Sending extension metadata:',
      extensionMetadata
    );

    const response = await fetch(`${API_BASE_URL}${SAVE_ENDPOINT}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ extensionMetadata }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        ksShowNotification(
          'Please login to the Knowledge Saver dashboard first.',
          'error'
        );
        return;
      }

      ksShowNotification('Failed to save page.', 'error');
      return;
    }

    ksShowNotification('Page saved to Knowledge Saver.', 'success');
  } catch (error) {
    console.error('Context menu save error:', error);
    ksShowNotification('Unexpected error while saving page.', 'error');
  }
});

