const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');

async function ensureOffscreenDocument() {
  if (!chrome.runtime.getContexts) {
    // Fallback: attempt to create blindly
    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Keep Spotify playback running while popup is closed'
      });
    } catch (e) {
      // ignore if already exists
    }
    return;
  }
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [OFFSCREEN_URL]
  });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Keep Spotify playback running while popup is closed'
    });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message && message.type === 'PLAY_TRACK') {
      await ensureOffscreenDocument();
      await chrome.runtime.sendMessage({ type: 'OFFSCREEN_PLAY', track: message.track });
      sendResponse({ ok: true });
    } else if (message && message.type === 'STOP') {
      await ensureOffscreenDocument();
      await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' });
      sendResponse({ ok: true });
    }
  })();
  return true; // keep channel open for async
});


