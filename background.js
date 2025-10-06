let spotifyTabId = null;
let lastTrackUrl = null;
let keepAlive = false;

async function openOrReuseSpotify(url){
  lastTrackUrl = url;
  // Try to find an existing open.spotify.com tab first
  const tabs = await chrome.tabs.query({ url: 'https://open.spotify.com/*' });
  if (tabs && tabs.length){
    spotifyTabId = tabs[0].id;
    await chrome.tabs.update(spotifyTabId, { active: false, url: appendAutoplay(url) });
    await armPlaybackOnReady(spotifyTabId);
    return spotifyTabId;
  }
  const created = await chrome.tabs.create({ url: appendAutoplay(url), active: false, pinned: true });
  spotifyTabId = created.id;
  await armPlaybackOnReady(spotifyTabId);
  return spotifyTabId;
}

function toSpotifyUri(openUrl){
  try {
    const u = new URL(openUrl);
    if (u.hostname !== 'open.spotify.com') return null;
    const parts = u.pathname.split('/').filter(Boolean); // [type, id]
    if (parts.length < 2) return null;
    const type = parts[0];
    const id = parts[1].split('?')[0];
    const valid = new Set(['track','album','playlist','artist','episode','show']);
    if (!valid.has(type)) return null;
    return `spotify:${type}:${id}`;
  } catch { return null; }
}

async function tryOpenDesktopApp(openUrl){
  const uri = toSpotifyUri(openUrl);
  if (!uri) return false;
  try {
    await chrome.tabs.create({ url: uri, active: false });
    return true;
  } catch {
    return false;
  }
}

function appendAutoplay(url){
  try {
    const u = new URL(url);
    if (!u.searchParams.has('autoplay')) u.searchParams.set('autoplay', '1');
    return u.toString();
  } catch {
    return url;
  }
}

async function armPlaybackOnReady(tabId){
  // When the tab finishes loading, try to click play
  const handler = async (id, info, tab) => {
    if (id !== tabId) return;
    if (info.status === 'complete'){
      try {
        await clickPlay(tabId);
      } catch {}
    }
  };
  chrome.tabs.onUpdated.addListener(handler);
  // Remove listener after 20s to avoid leaks
  setTimeout(() => chrome.tabs.onUpdated.removeListener(handler), 20000);
}

async function clickPlay(tabId){
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const btn = document.querySelector('[data-testid="control-button-playpause"], button[aria-label="Play"], button[title="Play"]');
        if (btn) {
          // If button indicates paused state, click to play
          const label = btn.getAttribute('aria-label') || btn.title || btn.textContent || '';
          const needsPlay = /play/i.test(label);
          if (needsPlay) btn.click();
        }
      }
    });
  } catch (e) {
    // ignore
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'focusai-keepalive' && keepAlive && spotifyTabId != null){
    await clickPlay(spotifyTabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message && message.type === 'PLAY_TRACK') {
      if (message.track && message.track.url){
        // Prefer desktop app via uri, fallback to web
        const openedDesktop = await tryOpenDesktopApp(message.track.url);
        if (!openedDesktop){
          await openOrReuseSpotify(message.track.url);
        }
      }
      keepAlive = true;
      chrome.alarms.clear('focusai-keepalive', () => {
        chrome.alarms.create('focusai-keepalive', { periodInMinutes: 0.5 });
      });
      sendResponse({ ok: true });
    } else if (message && message.type === 'STOP') {
      if (spotifyTabId != null){
        try { await chrome.tabs.remove(spotifyTabId); } catch (e) {}
        spotifyTabId = null;
      }
      keepAlive = false;
      chrome.alarms.clear('focusai-keepalive');
      sendResponse({ ok: true });
    }
  })();
  return true; // keep channel open for async
});


