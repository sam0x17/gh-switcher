const mappingList = document.getElementById('mapping-list');
const emptyState = document.getElementById('empty-state');
const patternInput = document.getElementById('pattern-input');
const usernameInput = document.getElementById('username-input');
const addBtn = document.getElementById('add-btn');
const defaultUsernameInput = document.getElementById('default-username-input');
const saveDefaultBtn = document.getElementById('save-default-btn');
const defaultSavedMsg = document.getElementById('default-saved-msg');

// ── Default Account ─────────────────────────────────────────────────────────

function loadDefaultAccount() {
  chrome.storage.sync.get('defaultUsername', ({ defaultUsername = '' }) => {
    defaultUsernameInput.value = defaultUsername;
  });
}

saveDefaultBtn.addEventListener('click', () => {
  const defaultUsername = defaultUsernameInput.value.trim();
  chrome.storage.sync.set({ defaultUsername }, () => {
    defaultSavedMsg.style.display = 'block';
    setTimeout(() => { defaultSavedMsg.style.display = 'none'; }, 2000);
  });
});

defaultUsernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveDefaultBtn.click();
});

// ── Mappings ────────────────────────────────────────────────────────────────

function loadMappings() {
  chrome.storage.sync.get('mappings', ({ mappings = [] }) => {
    renderMappings(mappings);
  });
}

function renderMappings(mappings) {
  mappingList.innerHTML = '';

  if (mappings.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  mappings.forEach((mapping, index) => {
    const li = document.createElement('li');
    li.className = 'mapping-item';
    li.innerHTML = `
      <span class="pattern">${escapeHtml(mapping.pattern)}</span>
      <span class="arrow">\u2192</span>
      <span class="username">${escapeHtml(mapping.username)}</span>
      <div class="actions">
        <button class="btn btn-small btn-move-up" data-index="${index}"
                ${index === 0 ? 'disabled' : ''} title="Move up">\u2191</button>
        <button class="btn btn-small btn-move-down" data-index="${index}"
                ${index === mappings.length - 1 ? 'disabled' : ''} title="Move down">\u2193</button>
        <button class="btn btn-small btn-danger btn-delete" data-index="${index}"
                title="Delete">\u2715</button>
      </div>
    `;
    mappingList.appendChild(li);
  });
}

addBtn.addEventListener('click', () => {
  const pattern = patternInput.value.trim();
  const username = usernameInput.value.trim();

  if (!pattern || !username) return;

  if (!isValidPattern(pattern)) {
    alert('Invalid pattern. Use patterns like: github.com/org-name/**');
    return;
  }

  chrome.storage.sync.get('mappings', ({ mappings = [] }) => {
    mappings.push({ pattern, username });
    chrome.storage.sync.set({ mappings }, () => {
      patternInput.value = '';
      usernameInput.value = '';
      renderMappings(mappings);
    });
  });
});

// Allow Enter key to add mapping
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addBtn.click();
});
patternInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') usernameInput.focus();
});

// Event delegation for delete and reorder
mappingList.addEventListener('click', (e) => {
  const deleteBtn = e.target.closest('.btn-delete');
  const moveUpBtn = e.target.closest('.btn-move-up');
  const moveDownBtn = e.target.closest('.btn-move-down');

  if (deleteBtn) {
    const index = parseInt(deleteBtn.dataset.index, 10);
    chrome.storage.sync.get('mappings', ({ mappings = [] }) => {
      mappings.splice(index, 1);
      chrome.storage.sync.set({ mappings }, () => renderMappings(mappings));
    });
  } else if (moveUpBtn && !moveUpBtn.disabled) {
    const index = parseInt(moveUpBtn.dataset.index, 10);
    chrome.storage.sync.get('mappings', ({ mappings = [] }) => {
      [mappings[index - 1], mappings[index]] = [mappings[index], mappings[index - 1]];
      chrome.storage.sync.set({ mappings }, () => renderMappings(mappings));
    });
  } else if (moveDownBtn && !moveDownBtn.disabled) {
    const index = parseInt(moveDownBtn.dataset.index, 10);
    chrome.storage.sync.get('mappings', ({ mappings = [] }) => {
      [mappings[index], mappings[index + 1]] = [mappings[index + 1], mappings[index]];
      chrome.storage.sync.set({ mappings }, () => renderMappings(mappings));
    });
  }
});

function isValidPattern(pattern) {
  const stripped = pattern.replace(/^https?:\/\//, '');
  return /^([\w.-]+\.)?github\.com\/.+$/.test(stripped);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

loadDefaultAccount();
loadMappings();
