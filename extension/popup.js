// popup.js
// Handles token storage, active tab capture, and POSTing to the AI Knowledge Saver backend.

const TOKEN_KEY = 'aiKnowledgeSaverAccessToken';
const API_BASE_URL = 'http://localhost:4000';
const ITEMS_ENDPOINT = '/api/items';
const DASHBOARD_URL = 'http://localhost:5173/dashboard';

const tokenInput = document.getElementById('token');
const saveTokenButton = document.getElementById('save-token');
const savePageButton = document.getElementById('save-page');
const openDashboardButton = document.getElementById('open-dashboard');
const statusEl = document.getElementById('status');
const tokenStatusEl = document.getElementById('token-status');

/**
 * Set status message in popup
 */
function setStatus(message, type = 'info') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function setTokenStatus(message) {
  if (!tokenStatusEl) return;
  tokenStatusEl.textContent = message;
}

/**
 * Load stored token
 */
function loadToken() {
  chrome.storage.local.get([TOKEN_KEY], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Storage read error:', chrome.runtime.lastError);
      setTokenStatus('Token status: error reading storage');
      return;
    }

    const token = result[TOKEN_KEY];
    if (token && tokenInput) {
      tokenInput.value = token;
      setTokenStatus('Token status: saved');
    } else {
      setTokenStatus('Token status: not set');
    }
  });
}

/**
 * Save token
 */
function saveToken() {
  const token = tokenInput.value.trim();

  if (!token) {
    setStatus('Please enter a valid token.', 'error');
    return;
  }

  chrome.storage.local.set({ [TOKEN_KEY]: token }, () => {
    if (chrome.runtime.lastError) {
      console.error('Storage save error:', chrome.runtime.lastError);
      setStatus('Failed to save token.', 'error');
      return;
    }

    setTokenStatus('Token status: saved');
    setStatus('Token saved successfully.', 'success');
  });
}

/**
 * Get active tab
 */
function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      if (!tabs || tabs.length === 0) {
        reject(new Error("No active tab found"));
        return;
      }

      resolve(tabs[0]);
    });
  });
}

/**
 * Get stored token
 */
function getStoredToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([TOKEN_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve(result[TOKEN_KEY] || null);
    });
  });
}

/**
 * Save current page
 */
async function saveCurrentPage() {
  setStatus('Saving page...', 'info');

  try {
    const token = await getStoredToken();

    if (!token) {
      setStatus('Please save token first.', 'error');
      return;
    }

    const activeTab = await getActiveTab();

    const metadata = await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        activeTab.id,
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

    // Fallback domain if content script couldn't determine it
    let domain = '';
    try {
      if (activeTab.url) {
        const parsed = new URL(activeTab.url);
        domain = parsed.hostname.replace(/^www\./i, '');
      }
    } catch {
      domain = '';
    }

    const payload = {
      title: (metadata && metadata.title) || activeTab.title || 'Untitled Page',
      url: activeTab.url,
      description: (metadata && metadata.description) ?? '',
      domain: (metadata && metadata.domain) || domain,
      favicon: (metadata && metadata.favicon) ?? '',
      previewImage: (metadata && metadata.previewImage) ?? '',
      type: (metadata && metadata.type) || undefined,
      extraMetadata: (metadata && metadata.extraMetadata) ?? {},
    };

    // Debug log to help verify what is being sent to the backend
    console.log('[AI Knowledge Saver][popup] Sending payload:', payload);
    console.log("TOKEN:", token);

    const response = await fetch(`${API_BASE_URL}${ITEMS_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error('Backend error:', errorText);
      setStatus('Failed to save page.', 'error');
      return;
    }

    setStatus('Page saved successfully!', 'success');
  } catch (err) {
    console.error('Save page error:', err);
    setStatus('Unexpected error occurred.', 'error');
  }
}

/**
 * Init
 */
document.addEventListener('DOMContentLoaded', () => {
  loadToken();

  if (saveTokenButton) {
    saveTokenButton.addEventListener('click', saveToken);
  }

  if (savePageButton) {
    savePageButton.addEventListener('click', saveCurrentPage);
  }

  if (openDashboardButton) {
    openDashboardButton.addEventListener('click', () => {
      chrome.tabs.create({ url: DASHBOARD_URL });
    });
  }
});