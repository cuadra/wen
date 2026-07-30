/**
 * AEM Model JSON Checker
 * Chrome Extension Popup Logic (Manifest V3)
 * Top-level utility functions are exported for Node.js automated testing
 */

/**
 * Generate candidate `.model.json` URLs from an active tab URL
 */
function generateCandidateUrls(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const origin = u.origin;
    let path = u.pathname;

    const candidates = [];

    // 1) If URL ends with a trailing slash e.g. /content/site/page/
    //    Example: https://example.com/content/site/page/ -> https://example.com/content/site/page/.model.json
    if (path.endsWith('/')) {
      candidates.push(`${origin}${path}.model.json`);
      const trimmed = path.slice(0, -1);
      if (trimmed) {
        candidates.push(`${origin}${trimmed}.model.json`);
      }
    }
    // 2) If URL ends with .html e.g. /content/site/page.html
    else if (path.endsWith('.html')) {
      const base = path.slice(0, -5);
      candidates.push(`${origin}${base}.model.json`);
      candidates.push(`${origin}${base}/.model.json`);
    }
    // 3) If URL has no trailing slash or extension e.g. /content/site/page
    else {
      candidates.push(`${origin}${path}.model.json`);
      candidates.push(`${origin}${path}/.model.json`);
    }

    // Deduplicate while preserving order
    return [...new Set(candidates)];
  } catch (e) {
    return [];
  }
}

/**
 * Convert timestamp values (1780045190002, seconds, ISO strings) to Date object
 */
function parseTimestamp(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    // Milliseconds epoch (e.g., 1780045190002) vs seconds epoch
    if (value > 1000000000000) {
      return new Date(value);
    }
    return new Date(value * 1000);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Check if pure numeric string
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      if (num > 1000000000000) {
        return new Date(num);
      }
      return new Date(num * 1000);
    }
    // Try standard date parser (ISO strings)
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }

  return null;
}

/**
 * Recursively search a JSON tree for lastModifiedDate or similar keys
 */
function findLastModifiedOccurrences(obj, path = 'root', results = []) {
  if (!obj || typeof obj !== 'object') {
    return results;
  }

  const keys = Object.keys(obj);
  for (const key of keys) {
    const lower = key.toLowerCase();
    const isTargetKey = 
      lower === 'lastmodifieddate' || 
      lower === 'lastmodified' || 
      lower === 'cq:lastmodified';

    if (isTargetKey) {
      const rawValue = obj[key];
      const parsedDate = parseTimestamp(rawValue);
      if (parsedDate) {
        results.push({
          key,
          path: `${path} > ${key}`,
          rawValue,
          date: parsedDate,
          priority: lower === 'lastmodifieddate' ? 1 : 2
        });
      }
    }

    const val = obj[key];
    if (val && typeof val === 'object') {
      findLastModifiedOccurrences(val, `${path} > ${key}`, results);
    }
  }

  // Sort by priority first (lastModifiedDate > other), then newest date first
  results.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.date.getTime() - a.date.getTime();
  });

  return results;
}

/**
 * Helper to format relative time (e.g. "2 hours ago", "in 3 days")
 */
function getRelativeTimeString(date) {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (absSec < 60) {
    return rtf.format(diffSec, 'second');
  }
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, 'minute');
  }
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) {
    return rtf.format(diffHour, 'hour');
  }
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) {
    return rtf.format(diffDay, 'day');
  }
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) {
    return rtf.format(diffMonth, 'month');
  }
  const diffYear = Math.round(diffDay / 365);
  return rtf.format(diffYear, 'year');
}

// Ensure DOM logic only runs when in a browser environment
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    const elements = {
      httpStatusBadge: document.getElementById('http-status-badge'),
      modelUrlInput: document.getElementById('model-url-input'),
      copyUrlBtn: document.getElementById('copy-url-btn'),
      openTabBtn: document.getElementById('open-tab-btn'),
      altUrlsContainer: document.getElementById('alt-urls-container'),
      altUrlsSelect: document.getElementById('alt-urls-select'),
      
      loadingState: document.getElementById('loading-state'),
      successState: document.getElementById('success-state'),
      noDateState: document.getElementById('no-date-state'),
      errorState: document.getElementById('error-state'),
      
      relativeTimeBadge: document.getElementById('relative-time-badge'),
      localTimeDisplay: document.getElementById('local-time-display'),
      localSubDisplay: document.getElementById('local-sub-display'),
      utcTimeDisplay: document.getElementById('utc-time-display'),
      rawTimeDisplay: document.getElementById('raw-time-display'),
      copyRawBtn: document.getElementById('copy-raw-btn'),
      
      occurrencesSection: document.getElementById('occurrences-section'),
      toggleOccurrencesBtn: document.getElementById('toggle-occurrences-btn'),
      occurrencesCount: document.getElementById('occurrences-count'),
      occurrencesList: document.getElementById('occurrences-list'),
      
      inspectNoDateBtn: document.getElementById('inspect-no-date-btn'),
      errorTitle: document.getElementById('error-title'),
      errorSubtitle: document.getElementById('error-subtitle'),
      errorDetail: document.getElementById('error-detail'),
      retryBtn: document.getElementById('retry-btn'),
      refreshBtn: document.getElementById('refresh-btn'),
      toastMessage: document.getElementById('toast-message')
    };

    let currentCandidateUrl = null;
    let latestJsonData = null;

    // Setup Event Listeners
    elements.refreshBtn.addEventListener('click', () => init());
    elements.retryBtn.addEventListener('click', () => init());
    
    elements.copyUrlBtn.addEventListener('click', () => {
      if (currentCandidateUrl) {
        navigator.clipboard.writeText(currentCandidateUrl);
        showToast('URL copied to clipboard!');
      }
    });

    elements.copyRawBtn.addEventListener('click', () => {
      const rawText = elements.rawTimeDisplay.textContent;
      if (rawText && rawText !== '--') {
        navigator.clipboard.writeText(rawText);
        showToast('Timestamp copied!');
      }
    });

    elements.openTabBtn.addEventListener('click', () => {
      if (currentCandidateUrl) {
        chrome.tabs.create({ url: currentCandidateUrl });
      }
    });

    elements.inspectNoDateBtn.addEventListener('click', () => {
      if (currentCandidateUrl) {
        chrome.tabs.create({ url: currentCandidateUrl });
      }
    });

    elements.toggleOccurrencesBtn.addEventListener('click', () => {
      elements.toggleOccurrencesBtn.classList.toggle('open');
      elements.occurrencesList.classList.toggle('hidden');
    });

    elements.altUrlsSelect.addEventListener('change', (e) => {
      const selectedUrl = e.target.value;
      if (selectedUrl && selectedUrl !== currentCandidateUrl) {
        checkEndpoint(selectedUrl);
      }
    });

    // Start Checking on load
    await init();

    async function init() {
      showState('loading');
      elements.httpStatusBadge.classList.add('hidden');
      elements.altUrlsContainer.classList.add('hidden');

      try {
        const activeTab = await getActiveTab();
        if (!activeTab || !activeTab.url) {
          showError('No Active Page URL', 'Cannot inspect URL', 'Please open a valid web page to check its .model.json endpoint.');
          return;
        }

        const pageUrl = activeTab.url;
        if (pageUrl.startsWith('chrome://') || pageUrl.startsWith('edge://') || pageUrl.startsWith('about:')) {
          showError('Unsupported URL Scheme', 'Browser Internal Page', 'Chrome internal pages do not have .model.json endpoints.');
          return;
        }

        const candidates = generateCandidateUrls(pageUrl);
        if (candidates.length === 0) {
          showError('Invalid Page URL', 'Could not parse URL', 'Unable to generate .model.json candidates for this URL.');
          return;
        }

        // Populate candidates selector if multiple
        if (candidates.length > 1) {
          elements.altUrlsSelect.innerHTML = candidates.map((c, idx) => 
            `<option value="${c}">${idx === 0 ? 'Primary: ' : 'Alt: '}${new URL(c).pathname}</option>`
          ).join('');
          elements.altUrlsContainer.classList.remove('hidden');
        }

        // Try primary candidate URL first
        await checkEndpoint(candidates[0], activeTab.id, candidates);
      } catch (err) {
        console.error('Initialization error:', err);
        showError('Error Checking Model', 'Unexpected Exception', err.message || 'Failed to check endpoint.');
      }
    }

    /**
     * Check a specific candidate endpoint URL
     */
    async function checkEndpoint(targetUrl, tabId = null, allCandidates = []) {
      currentCandidateUrl = targetUrl;
      elements.modelUrlInput.value = targetUrl;
      showState('loading');

      let responseResult = null;

      // Try fetching via tab executeScript first (to bypass CORS & include page cookies)
      if (tabId) {
        try {
          responseResult = await fetchFromTab(tabId, targetUrl);
        } catch (e) {
          console.warn('Tab script fetch failed, falling back to direct popup fetch:', e);
        }
      }

      // Fallback to direct fetch if tab script wasn't available
      if (!responseResult) {
        try {
          const res = await fetch(targetUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
          const text = await res.text();
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (err) {
            // not JSON
          }
          responseResult = {
            status: res.status,
            ok: res.ok,
            isJson: !!json,
            data: json
          };
        } catch (err) {
          responseResult = {
            status: 0,
            ok: false,
            error: err.message
          };
        }
      }

      // If primary failed with 404/403 and there are other candidates, try next candidate
      if ((!responseResult.ok || !responseResult.isJson) && allCandidates.length > 1 && targetUrl === allCandidates[0]) {
        console.log('Primary candidate failed, trying secondary candidate:', allCandidates[1]);
        elements.altUrlsSelect.value = allCandidates[1];
        return checkEndpoint(allCandidates[1], tabId, []);
      }

      // Update HTTP status pill
      updateStatusBadge(responseResult.status, responseResult.ok && responseResult.isJson);

      if (!responseResult.ok) {
        const statusText = responseResult.status ? `HTTP ${responseResult.status}` : 'Network / Connection Error';
        showError(
          'Model JSON Not Found',
          statusText,
          `The URL ${targetUrl} did not return a valid HTTP 200 JSON model.`
        );
        return;
      }

      if (!responseResult.isJson || !responseResult.data) {
        showError(
          'Invalid Model Format',
          'Response is not valid JSON',
          'The endpoint returned HTTP 200, but the payload is not a valid JSON structure.'
        );
        return;
      }

      latestJsonData = responseResult.data;

      // Search recursively for lastModifiedDate
      const occurrences = findLastModifiedOccurrences(latestJsonData);

      if (occurrences.length === 0) {
        showState('no-date');
        return;
      }

      // Render results
      renderLastModifiedData(occurrences);
      showState('success');
    }

    /**
     * Fetch from active tab using chrome.scripting to share origin & cookies
     */
    async function fetchFromTab(tabId, url) {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: async (fetchUrl) => {
          try {
            const res = await fetch(fetchUrl, {
              method: 'GET',
              headers: { 'Accept': 'application/json' }
            });
            const text = await res.text();
            let json = null;
            try {
              json = JSON.parse(text);
            } catch (e) {}
            return {
              status: res.status,
              ok: res.ok,
              isJson: !!json,
              data: json
            };
          } catch (err) {
            return {
              status: 0,
              ok: false,
              error: err.message
            };
          }
        },
        args: [url]
      });

      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
      return null;
    }

    /**
     * Render primary and all occurrences of lastModifiedDate
     */
    function renderLastModifiedData(occurrences) {
      const primary = occurrences[0];
      const dateObj = primary.date;

      // Local formatted date/time
      const localFormatter = new Intl.DateTimeFormat(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });

      const dayFormatter = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      elements.localTimeDisplay.textContent = localFormatter.format(dateObj);
      elements.localSubDisplay.textContent = `${dayFormatter.format(dateObj)} (Local Time)`;

      // Relative time pill
      elements.relativeTimeBadge.textContent = getRelativeTimeString(dateObj);

      // UTC Time
      const utcFormatted = dateObj.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      elements.utcTimeDisplay.textContent = utcFormatted;

      // Raw value
      elements.rawTimeDisplay.textContent = String(primary.rawValue);

      // Render occurrences accordion
      if (occurrences.length > 1) {
        elements.occurrencesCount.textContent = occurrences.length;
        elements.occurrencesList.innerHTML = occurrences.map(occ => {
          const occDateStr = localFormatter.format(occ.date);
          return `
            <div class="occurrence-item">
              <span class="occ-path">${occ.path}</span>
              <span class="occ-date">${occDateStr} (${String(occ.rawValue)})</span>
            </div>
          `;
        }).join('');
        elements.occurrencesSection.classList.remove('hidden');
      } else {
        elements.occurrencesSection.classList.add('hidden');
      }
    }

    /**
     * Update status badge
     */
    function updateStatusBadge(status, isSuccess) {
      elements.httpStatusBadge.textContent = status ? `HTTP ${status}` : 'ERR';
      elements.httpStatusBadge.className = `status-pill ${isSuccess ? 'success' : 'error'}`;
      elements.httpStatusBadge.classList.remove('hidden');
    }

    /**
     * State switcher
     */
    function showState(stateName) {
      elements.loadingState.classList.add('hidden');
      elements.successState.classList.add('hidden');
      elements.noDateState.classList.add('hidden');
      elements.errorState.classList.add('hidden');

      if (stateName === 'loading') {
        elements.loadingState.classList.remove('hidden');
      } else if (stateName === 'success') {
        elements.successState.classList.remove('hidden');
      } else if (stateName === 'no-date') {
        elements.noDateState.classList.remove('hidden');
      } else if (stateName === 'error') {
        elements.errorState.classList.remove('hidden');
      }
    }

    function showError(title, subtitle, detail) {
      elements.errorTitle.textContent = title;
      elements.errorSubtitle.textContent = subtitle;
      elements.errorDetail.textContent = detail;
      showState('error');
    }

    function showToast(msg) {
      elements.toastMessage.textContent = msg;
      elements.toastMessage.classList.remove('hidden');
      setTimeout(() => {
        elements.toastMessage.classList.add('hidden');
      }, 2500);
    }

    async function getActiveTab() {
      return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve(tabs && tabs[0] ? tabs[0] : null);
        });
      });
    }
  });
}

// Expose helpers for Node unit testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateCandidateUrls,
    findLastModifiedOccurrences,
    parseTimestamp,
    getRelativeTimeString
  };
}
