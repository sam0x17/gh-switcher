// ── Helpers ──────────────────────────────────────────────────────────────────

function waitForElement(selector, timeout = 3000) {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

// ── Current User Detection ──────────────────────────────────────────────────

function getCurrentUser() {
  const meta = document.querySelector('meta[name="user-login"]');
  return meta ? meta.getAttribute('content') || null : null;
}

// ── URL Pattern Matching ────────────────────────────────────────────────────

function globToRegex(pattern) {
  // Strip protocol if user included it
  let normalized = pattern.replace(/^https?:\/\//, '');

  // Escape regex special chars (except *)
  let regexStr = normalized
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\0DOUBLESTAR\0')
    .replace(/\*/g, '[^/]+')
    .replace(/\0DOUBLESTAR\0/g, '.*');

  // Match with or without trailing path segments
  return new RegExp('^https?://' + regexStr + '(/.*)?$', 'i');
}

function findMatchingMapping(url, mappings) {
  for (const mapping of mappings) {
    const regex = globToRegex(mapping.pattern);
    if (regex.test(url)) {
      return mapping;
    }
  }
  return null;
}

// ── Account Switching ───────────────────────────────────────────────────────

async function switchToAccount(targetUsername) {
  const targetLower = targetUsername.toLowerCase();

  // Step 1: Open the user avatar menu
  const avatarImg = document.querySelector('img[data-testid="github-avatar"]');
  const avatarButton = avatarImg
    ? avatarImg.closest('button')
    : document.querySelector(
        'button[data-login], button[aria-haspopup="menu"][data-login]'
      );

  if (!avatarButton) {
    console.warn('[gh-switcher] Could not find avatar button');
    return { success: false, reason: 'avatar-not-found' };
  }

  avatarButton.click();

  // Step 2: Wait for the avatar dialog to open (retry click if needed)
  let dialog = await waitForElement('[role="dialog"][data-component="AnchoredOverlay"]', 2000);
  if (!dialog) {
    // Page may not have been interactive yet — retry the click
    avatarButton.click();
    dialog = await waitForElement('[role="dialog"][data-component="AnchoredOverlay"]', 3000);
  }
  if (!dialog) {
    console.warn('[gh-switcher] Avatar dialog did not open');
    return { success: false, reason: 'menu-not-found' };
  }

  // Step 3: Click the "Account switcher" IconButton in the dialog header
  const switcherBtn = dialog.querySelector('svg.octicon-arrow-switch')?.closest('button');
  if (!switcherBtn) {
    console.warn('[gh-switcher] Could not find account switcher button');
    closeMenu();
    return { success: false, reason: 'switch-option-not-found' };
  }
  switcherBtn.click();

  // Step 4: Wait for the account list sub-view to appear
  const accountList = await waitForElement(
    '[role="menu"] [aria-label="Switch account"], ' +
    '[role="menu"] .prc-ActionList-GroupHeading-STzxi',
    3000
  );
  if (!accountList) {
    console.warn('[gh-switcher] Account list did not appear');
    closeMenu();
    return { success: false, reason: 'account-list-not-found' };
  }

  // Wait for any include-fragments to finish loading
  await waitForIncludeFragments(2000);

  // Step 5: Find and click the target account
  const targetItem = findAccountItem(targetLower);
  if (!targetItem) {
    console.warn('[gh-switcher] Account not found:', targetUsername);
    closeMenu();
    return { success: false, reason: 'account-not-available' };
  }
  targetItem.click();
  return { success: true };
}

function findAccountItem(targetLower) {
  // Strategy 1: Find by Primer ItemLabel text (exact match on username)
  const labels = document.querySelectorAll(
    '[role="menu"] .prc-ActionList-ItemLabel-81ohH, ' +
    '[role="menu"] [class*="ItemLabel"]'
  );
  for (const label of labels) {
    if (label.textContent.trim().toLowerCase() === targetLower) {
      return label.closest('[role="menuitem"]') || label.closest('li');
    }
  }

  // Strategy 2: Find by data-login attribute
  const byLogin = document.querySelector(
    `[role="menu"] [data-login="${CSS.escape(targetLower)}"], ` +
    `[role="menu"] [data-login="${CSS.escape(targetLower[0].toUpperCase() + targetLower.slice(1))}"]`
  );
  if (byLogin) return byLogin.closest('[role="menuitem"]') || byLogin;

  // Strategy 3: Broader text search across all visible menuitems
  const items = document.querySelectorAll('[role="menuitem"]');
  for (const item of items) {
    const text = item.textContent.trim().toLowerCase();
    // Check if this item's text starts with the username
    // (account items contain "username\nFull Name")
    if (text === targetLower || text.startsWith(targetLower + '\n') || text.startsWith(targetLower + ' ')) {
      return item;
    }
  }

  return null;
}

function waitForIncludeFragments(timeout = 3000) {
  return new Promise((resolve) => {
    const fragments = document.querySelectorAll('include-fragment');
    if (fragments.length === 0) return resolve();
    const observer = new MutationObserver(() => {
      if (document.querySelectorAll('include-fragment').length === 0) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, timeout);
  });
}

function closeMenu() {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  );
}

// ── Main Logic ──────────────────────────────────────────────────────────────

// Paths where account switching should never trigger (account-level pages)
const IGNORED_PATHS = [
  '/settings',
  '/login',
  '/logout',
  '/sessions',
  '/password_reset',
  '/join',
  '/signup',
  '/account',
  '/sponsors',
  '/notifications',
  '/new',
  '/codespaces',
  '/explore',
  '/trending',
  '/collections',
  '/events',
  '/stars',
  '/marketplace',
  '/pricing',
  '/features',
  '/security',
  '/dashboard',
];

function isIgnoredPath(url) {
  const path = new URL(url).pathname;
  if (path === '/' || path === '') return true;
  return IGNORED_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

const COOLDOWN_KEY = 'gh-switcher-last-switch';
const COOLDOWN_MS = 5000;

async function main() {
  const currentUser = getCurrentUser();
  if (!currentUser) return; // Not logged in

  const currentUrl = window.location.href;
  if (isIgnoredPath(currentUrl)) return;

  // Prevent switch loops
  const lastSwitch = sessionStorage.getItem(COOLDOWN_KEY);
  if (lastSwitch && Date.now() - parseInt(lastSwitch, 10) < COOLDOWN_MS) return;

  const { mappings = [], defaultUsername = '' } = await chrome.storage.sync.get([
    'mappings',
    'defaultUsername',
  ]);

  const match = findMatchingMapping(currentUrl, mappings);

  // Determine expected username: pattern match wins, then default
  let expectedUsername = null;
  let matchSource = null;

  if (match) {
    expectedUsername = match.username;
    matchSource = match.pattern;
  } else if (defaultUsername) {
    expectedUsername = defaultUsername;
    matchSource = '(default)';
  }

  if (!expectedUsername) return;
  if (expectedUsername.toLowerCase() === currentUser.toLowerCase()) return;

  console.log(
    `[gh-switcher] Rule: ${matchSource}. ` +
    `Current: ${currentUser}, expected: ${expectedUsername}. Switching...`
  );

  sessionStorage.setItem(COOLDOWN_KEY, Date.now().toString());
  const result = await switchToAccount(expectedUsername);

  if (!result.success) {
    chrome.runtime.sendMessage({
      type: 'SWITCH_FAILED',
      reason: result.reason,
      targetUsername: expectedUsername,
      currentUsername: currentUser,
      url: currentUrl,
      pattern: matchSource,
    });
  }
}

// Run on initial load
main();

// Re-run on GitHub's SPA navigation (Turbo Drive)
document.addEventListener('turbo:load', main);

// Re-run when the tab becomes visible (e.g. user switches tabs)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') main();
});

// ── Message Handler (for popup status queries) ──────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    const currentUser = getCurrentUser();
    chrome.storage.sync.get(['mappings', 'defaultUsername'], ({ mappings = [], defaultUsername = '' }) => {
      const match = findMatchingMapping(window.location.href, mappings);

      let expectedUser = null;
      let matchedPattern = null;

      if (match) {
        expectedUser = match.username;
        matchedPattern = match.pattern;
      } else if (defaultUsername) {
        expectedUser = defaultUsername;
        matchedPattern = '(default)';
      }

      sendResponse({
        currentUser,
        currentUrl: window.location.href,
        matchedPattern,
        expectedUser,
        isCorrect: expectedUser
          ? expectedUser.toLowerCase() === (currentUser || '').toLowerCase()
          : null,
      });
    });
    return true; // Async response
  }
});
