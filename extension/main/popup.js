// popup.js
// Handles active tab capture and POSTing to the AI Knowledge Saver backend
// using cookie-based session authentication (no manual tokens).

const API_BASE_URL = 'http://localhost:4000';
const SAVE_ENDPOINT = '/save';
const DASHBOARD_URL = 'http://localhost:5173/dashboard';

const connectExtensionButton = document.getElementById('connect-extension');
const savePageButton = document.getElementById('save-page');
const openDashboardButton = document.getElementById('open-dashboard');
const statusEl = document.getElementById('status');

function setStatus(message, type = 'info') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

async function checkConnectionStatus() {
  if (!connectExtensionButton) return;

  try {
    const res = await fetch(`${API_BASE_URL}${SAVE_ENDPOINT}/status`, {
      method: 'GET',
      credentials: 'include',
    });

    if (res.ok) {
      connectExtensionButton.textContent = 'Connected';
      connectExtensionButton.classList.add('connected');
      connectExtensionButton.disabled = true;
    } else {
      connectExtensionButton.textContent = 'Connect Extension with Website';
      connectExtensionButton.disabled = false;
    }
  } catch {
    // On network error, leave button as connect
    connectExtensionButton.textContent = 'Connect Extension with Website';
    connectExtensionButton.disabled = false;
  }
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      if (!tabs || tabs.length === 0) {
        reject(new Error('No active tab found'));
        return;
      }

      resolve(tabs[0]);
    });
  });
}

async function saveCurrentPage() {
  setStatus('Saving page...', 'info');

  try {
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

    const extensionMetadata = metadata || {
      source: 'extension_dom',
      url: activeTab.url,
      title: activeTab.title || 'Untitled Page',
    };

    console.log(
      '[AI Knowledge Saver][popup] Sending extension metadata:',
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
        setStatus(
          'Please login to the dashboard first, then try again.',
          'error'
        );
        return;
      }

      const errorText = await response.text().catch(() => '');
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

document.addEventListener('DOMContentLoaded', () => {
  if (connectExtensionButton) {
    connectExtensionButton.addEventListener('click', () => {
      // Open the dashboard so the user can log in; once logged in,
      // the backend will set the session cookie that the extension uses.
      chrome.tabs.create({ url: DASHBOARD_URL });
    });
  }

  // On popup open, check whether extension is already connected (session cookie valid)
  checkConnectionStatus();

  if (savePageButton) {
    savePageButton.addEventListener('click', saveCurrentPage);
  }

  if (openDashboardButton) {
    openDashboardButton.addEventListener('click', () => {
      chrome.tabs.create({ url: DASHBOARD_URL });
    });
  }
});

