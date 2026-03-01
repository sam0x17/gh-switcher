const statusContainer = document.getElementById('status-container');
const messageEl = document.getElementById('message');
const currentUserEl = document.getElementById('current-user');
const matchedPatternEl = document.getElementById('matched-pattern');
const expectedUserEl = document.getElementById('expected-user');
const statusIndicatorEl = document.getElementById('status-indicator');
const settingsBtn = document.getElementById('settings-btn');

function showMessage(text) {
  statusContainer.style.display = 'none';
  messageEl.style.display = 'block';
  messageEl.textContent = text;
}

function showStatus(response) {
  statusContainer.style.display = 'block';
  messageEl.style.display = 'none';

  currentUserEl.textContent = response.currentUser || '(not logged in)';

  if (response.matchedPattern) {
    matchedPatternEl.textContent = response.matchedPattern;
    expectedUserEl.textContent = response.expectedUser;

    if (response.isCorrect) {
      statusIndicatorEl.textContent = 'Correct account';
      statusIndicatorEl.className = 'status-value correct';
    } else {
      statusIndicatorEl.textContent = 'Wrong account';
      statusIndicatorEl.className = 'status-value mismatch';
    }
  } else {
    matchedPatternEl.textContent = '(no match)';
    matchedPatternEl.className = 'status-value none';
    expectedUserEl.textContent = '--';
    expectedUserEl.className = 'status-value none';
    statusIndicatorEl.textContent = 'No rule or default';
    statusIndicatorEl.className = 'status-value none';
  }
}

// Query the active tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];

  if (!tab?.url?.match(/^https?:\/\/([\w.-]+\.)?github\.com\//)) {
    showMessage('Not a GitHub page.');
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      showMessage('Could not connect to page. Try refreshing.');
      return;
    }
    showStatus(response);
  });
});

settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
