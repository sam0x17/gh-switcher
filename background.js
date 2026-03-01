// Initialize default storage on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('mappings', (result) => {
    if (!result.mappings) {
      chrome.storage.sync.set({ mappings: [] });
    }
  });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SWITCH_FAILED') {
    let notificationMessage;
    switch (message.reason) {
      case 'avatar-not-found':
        notificationMessage =
          'Could not find the GitHub user menu. The page may not be fully loaded.';
        break;
      case 'switch-option-not-found':
        notificationMessage =
          'Could not find "Switch account" option. You may not have multiple accounts logged in.';
        break;
      case 'account-not-available':
        notificationMessage =
          `Account "${message.targetUsername}" is not available in the account switcher. Please log in to that account first.`;
        break;
      default:
        notificationMessage = `Failed to switch to ${message.targetUsername}.`;
    }

    chrome.notifications.create({
      type: 'basic',
      title: 'GitHub Account Switcher',
      message: notificationMessage,
      iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
        '<rect width="48" height="48" rx="8" fill="#24292f"/>' +
        '<text x="24" y="32" text-anchor="middle" font-size="24" fill="white">GH</text>' +
        '</svg>'
      )
    });
  }
});
