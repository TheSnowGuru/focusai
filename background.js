let keepAlive = false;
// Spotify OAuth settings
const SPOTIFY_CLIENT_ID = '13b4d04efb374d83892efa41680c4a3b';
const SPOTIFY_SCOPES = ['streaming','user-read-email','user-read-private','user-modify-playback-state'];

function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const hashed = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hashed)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function spotifyAuth() {
  // MUST match what's in Spotify Dashboard exactly
  // Use the current extension's redirect URL to avoid hardcoding the ID
  const redirectUri = chrome.identity.getRedirectURL('callback');
  
  // Generate PKCE code verifier and challenge
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  await chrome.storage.local.set({ spotifyCodeVerifier: codeVerifier });
  
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  }).toString();
  const url = `https://accounts.spotify.com/authorize?${params}`;
  
  console.log('Background auth - Extension ID:', chrome.runtime.id);
  console.log('Background auth - Redirect URI:', redirectUri);
  
  const redirectUrl = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  const urlObj = new URL(redirectUrl);
  const code = urlObj.searchParams.get('code');
  
  if (!code) return false;
  
  // Exchange code for token
  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })
  });
  
  if (!tokenResponse.ok) return false;
  
  const tokenData = await tokenResponse.json();
  await chrome.storage.local.set({ 
    spotifyToken: tokenData.access_token, 
    tokenTimestamp: Date.now(),
    spotifyRefreshToken: tokenData.refresh_token 
  });
  return true;
}

// Intercept redirects to the chromiumapp.org redirect URI before DNS
try {
  const dynamicRedirect = chrome.identity.getRedirectURL('callback');
  chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    try {
      if (!details || !details.url) return;
      const url = details.url;
      if (!url.startsWith(dynamicRedirect)) return;
      
      // Parse code and exchange immediately
      const u = new URL(url);
      const code = u.searchParams.get('code');
      if (!code) return;
      
      const { spotifyCodeVerifier } = await chrome.storage.local.get({ spotifyCodeVerifier: '' });
      if (!spotifyCodeVerifier) return;
      
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: dynamicRedirect,
          code_verifier: spotifyCodeVerifier
        })
      });
      if (!tokenResponse.ok) {
        let errText = '';
        try { errText = await tokenResponse.text(); } catch {}
        console.error('Token exchange failed in background intercept:', tokenResponse.status, errText);
        // Clear verifier so a new attempt can generate a fresh one
        try { await chrome.storage.local.remove(['spotifyCodeVerifier']); } catch {}
        return;
      }
      const tokenData = await tokenResponse.json();
      await chrome.storage.local.set({
        spotifyToken: tokenData.access_token,
        tokenTimestamp: Date.now(),
        spotifyRefreshToken: tokenData.refresh_token || ''
      });
      console.log('✅ Token stored from background intercept');
      
      // Close the navigating tab to avoid DNS error
      try { await chrome.tabs.remove(details.tabId); } catch {}
    } catch (e) {
      console.error('webNavigation intercept error:', e);
    }
  });
} catch {}

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
  if (alarm.name === 'focus-end') {
    console.log('⏰ Timer completed - focus-end alarm triggered');
    
    // Clear timer state
    await chrome.storage.local.set({ 
      isRunning: false, 
      startTime: null, 
      track: null 
    });

    // Play completion sound by creating an offscreen document
    try {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: 'Play timer completion sound'
      });
      
      // Send message to play the sound
      chrome.runtime.sendMessage({ 
        type: 'PLAY_COMPLETION_SOUND'
      }).catch(e => console.log('Sound message error:', e));
    } catch (e) {
      console.log('Offscreen document error:', e);
    }
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'FocusAI',
      message: 'Times up! Great work. Take 5-10 and come back 💪'
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message && message.type === 'PLAY_SPOTIFY') {
      console.log('🎧 Background received PLAY_SPOTIFY:', message.track?.name);
      if (message.track){
        await ensureOffscreen();
        console.log('✅ Offscreen ensured');
        
        // Get token and send it with the message
        const { spotifyToken } = await chrome.storage.local.get({ spotifyToken:'' });
        console.log('🔑 Token retrieved:', spotifyToken ? 'Yes' : 'No');
        
        chrome.runtime.sendMessage({ 
          type: 'PLAY_SPOTIFY', 
          track: message.track,
          token: spotifyToken 
        }).catch((e) => {
          console.error('❌ Error sending to offscreen:', e);
        });
        console.log('📤 Sent PLAY_SPOTIFY to offscreen with token');
      }
      keepAlive = true;
      sendResponse({ ok: true });
    } else if (message && message.type === 'STOP_SPOTIFY') {
      keepAlive = false;
      chrome.runtime.sendMessage({ type: 'STOP_SPOTIFY' }).catch(() => {});
      sendResponse({ ok: true });
    } else if (message && message.type === 'LOGIN_SPOTIFY') {
      const ok = await spotifyAuth().catch(e => {
        console.error('Auth error:', e);
        return false;
      });
      sendResponse({ ok, type: 'LOGIN_RESULT' });
    } else if (message && message.type === 'IS_AUTHENTICATED') {
      const { spotifyToken, tokenTimestamp } = await chrome.storage.local.get({ spotifyToken:'', tokenTimestamp:0 });
      const ok = !!spotifyToken && (Date.now() - tokenTimestamp) < 3600000;
      sendResponse({ ok, type: 'AUTH_STATUS' });
    }
  })();
  return true; // keep channel open for async
});


