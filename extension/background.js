// XPRTY Interview Guardian — Chrome Extension (Manifest V3)
// Supported Domain Monitoring & Declarative Enforcement

let activeSessionId = null;
let allowedDomains = ['localhost', 'xprty.io', 'meet.jit.si'];
let serverUrl = 'http://localhost:5000';
let candidateToken = null;

// Lifecycle Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START_PROCTORING_SESSION') {
    activeSessionId = request.sessionId;
    candidateToken = request.token;
    allowedDomains = request.allowedDomains || allowedDomains;
    sendResponse({ status: 'ACTIVE', sessionId: activeSessionId });
  } else if (request.type === 'UPDATE_ALLOWLIST') {
    allowedDomains = request.allowedDomains || [];
    sendResponse({ status: 'UPDATED', allowedDomains });
  } else if (request.type === 'STOP_PROCTORING_SESSION') {
    activeSessionId = null;
    candidateToken = null;
    sendResponse({ status: 'STOPPED' });
  }
});

// Monitor Tab Switching
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!activeSessionId) return;

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      const url = new URL(tab.url);
      const hostname = url.hostname;

      // Ignore internal browser tabs
      if (hostname === 'newtab' || hostname === 'extensions') return;

      const isAllowed = allowedDomains.some(allowed => 
        hostname === allowed || hostname.endsWith('.' + allowed)
      );

      // Report tab switch or unauthorized domain attempt
      fetch(`${serverUrl}/api/interviews/${activeSessionId}/proctoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(candidateToken ? { Authorization: `Bearer ${candidateToken}` } : {})
        },
        body: JSON.stringify({
          user_id: 'candidate_extension_agent',
          event_type: isAllowed ? 'TAB_VISIBILITY_CHANGED' : 'UNAUTHORIZED_DOMAIN_ATTEMPT',
          severity: isAllowed ? 'medium' : 'high',
          metadata: {
            tabTitle: tab.title,
            tabUrl: tab.url,
            domain: hostname,
            isAllowed
          }
        })
      }).catch(err => console.error('[XPRTY Guardian] Telemetry failed:', err));
    }
  } catch (err) {}
});
