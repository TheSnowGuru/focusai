let keepAlive = false;
// Spotify OAuth settings
const SPOTIFY_CLIENT_ID = '13b4d04efb374d83892efa41680c4a3b';
const SPOTIFY_REDIRECT_URI = 'https://fcebfginidcappmbokiokjpgjfbmadbj.chromiumapp.org/callback';
const SPOTIFY_SCOPES = ['streaming','user-read-email','user-read-private','user-modify-playback-state'];

async function spotifyAuth() {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'token',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES.join(' ')
  }).toString();
  const url = `https://accounts.spotify.com/authorize?${params}`;
  const redirectUrl = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  const hash = new URL(redirectUrl).hash.slice(1);
  const data = new URLSearchParams(hash);
  const access = data.get('access_token');
  if (access){
    await chrome.storage.local.set({ spotifyToken: access, tokenTimestamp: Date.now() });
    return true;
  }
  return false;
}

async function ensureOffscreen(){
  const has = await chrome.offscreen.hasDocument?.().catch(() => false);
  if (has) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: 'Play Spotify embed while popup closed'
  });
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

// Do not open desktop app. We always use offscreen iframe or SDK from popup.

function appendAutoplay(url){
  try {
    const u = new URL(url);
    if (!u.searchParams.has('autoplay')) u.searchParams.set('autoplay', '1');
    return u.toString();
  } catch {
    return url;
  }
}

// No longer manipulating tabs.

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
  // Left in case we need periodic checks later
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message && message.type === 'PLAY_SPOTIFY') {
      if (message.track){
        await ensureOffscreen();
        chrome.runtime.sendMessage({ type: 'PLAY_SPOTIFY', track: message.track });
      }
      keepAlive = true;
      sendResponse({ ok: true });
    } else if (message && message.type === 'STOP_SPOTIFY') {
      keepAlive = false;
      chrome.runtime.sendMessage({ type: 'STOP_SPOTIFY' });
      sendResponse({ ok: true });
    } else if (message && message.type === 'LOGIN_SPOTIFY') {
      const ok = await spotifyAuth().catch(() => false);
      chrome.runtime.sendMessage({ type: 'LOGIN_RESULT', ok });
      sendResponse({ ok });
    } else if (message && message.type === 'IS_AUTHENTICATED') {
      const { spotifyToken, tokenTimestamp } = await chrome.storage.local.get({ spotifyToken:'', tokenTimestamp:0 });
      const ok = !!spotifyToken && (Date.now() - tokenTimestamp) < 3600000;
      chrome.runtime.sendMessage({ type: 'AUTH_STATUS', ok });
      sendResponse({ ok });
    }
  })();
  return true; // keep channel open for async
});


