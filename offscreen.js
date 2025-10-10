let currentIframe = null;
let sdkPlayer = null;
let sdkDeviceId = null;

async function getStoredToken(){
  try {
    const result = await chrome.storage.local.get({ spotifyToken:'', tokenTimestamp:0 });
    const { spotifyToken, tokenTimestamp } = result;
    if (!spotifyToken) return '';
    const expired = (Date.now() - tokenTimestamp) >= 3600000;
    return expired ? '' : spotifyToken;
  } catch (e) {
    console.error('Error getting stored token:', e);
    return '';
  }
}

// OAuth handled by background.js via chrome.identity

// Offscreen document doesn't need to create itself

function removeIframe(){
  if (currentIframe && currentIframe.parentNode){
    currentIframe.parentNode.removeChild(currentIframe);
  }
  currentIframe = null;
}

function playTrack(track){
  removeIframe();
  if (!track || !track.url) return;
  const id = (track.url.match(/track\/([A-Za-z0-9]+)/) || [])[1];
  const iframe = document.createElement('iframe');
  iframe.width = '100%';
  iframe.height = '80';
  iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  iframe.style.border = '0';
  iframe.src = `https://open.spotify.com/embed/track/${id}`;
  document.body.appendChild(iframe);
  currentIframe = iframe;
}

function stop(){ removeIframe(); }

async function playViaWebApi(track){
  if (!track || !track.url) return false;
  const id = (track.url.match(/track\/([A-Za-z0-9]+)/) || [])[1];
  if (!id) return false;
  let token = await getStoredToken();
  if (!token){
    // ask background to authenticate on demand
    await new Promise((resolve) => {
      const handler = (msg) => { if (msg && msg.type === 'LOGIN_RESULT'){ chrome.runtime.onMessage.removeListener(handler); resolve(); } };
      chrome.runtime.onMessage.addListener(handler);
      chrome.runtime.sendMessage({ type: 'LOGIN_SPOTIFY' });
    });
    token = await getStoredToken();
    if (!token) return false;
  }
  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/play',{
      method:'PUT',
      headers:{
        'Authorization': 'Bearer '+token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: [`spotify:track:${id}`] })
    });
    return res.status === 204;
  } catch {
    return false;
  }
}

// Initialize SDK when ready
window.onSpotifyWebPlaybackSDKReady = async () => {
  let token = await getStoredToken();
  if (!token){
    await new Promise((resolve) => {
      const handler = (msg) => { if (msg && msg.type === 'LOGIN_RESULT'){ chrome.runtime.onMessage.removeListener(handler); resolve(); } };
      chrome.runtime.onMessage.addListener(handler);
      chrome.runtime.sendMessage({ type: 'LOGIN_SPOTIFY' });
    });
    token = await getStoredToken();
    if (!token) return;
  }
  
  sdkPlayer = new Spotify.Player({
    name: 'Spotify on Chrome',
    getOAuthToken: async cb => {
      const t = await getStoredToken();
      cb(t);
    },
    volume: 0.7
  });

  // Error handling
  sdkPlayer.addListener('initialization_error', ({ message }) => {
    console.error('Failed to initialize', message);
  });
  sdkPlayer.addListener('authentication_error', ({ message }) => {
    console.error('Failed to authenticate', message);
    sdkDeviceId = null;
  });
  sdkPlayer.addListener('account_error', ({ message }) => {
    console.error('Failed to validate Spotify account', message);
  });
  sdkPlayer.addListener('playback_error', ({ message }) => {
    console.error('Failed to perform playback', message);
  });

  // Ready
  sdkPlayer.addListener('ready', ({ device_id }) => {
    console.log('Ready with Device ID', device_id);
    sdkDeviceId = device_id;
  });

  // Not Ready
  sdkPlayer.addListener('not_ready', ({ device_id }) => {
    console.log('Device ID has gone offline', device_id);
    sdkDeviceId = null;
  });

  // Connect to the player
  const connected = await sdkPlayer.connect();
  if (connected) {
    console.log('The Web Playback SDK successfully connected to Spotify!');
  }
};

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'PLAY_SPOTIFY') {
    // If SDK device is ready, transfer playback and play via Web API
    if (sdkDeviceId && msg.track && msg.track.url){
      const token = await getStoredToken();
      const id = (msg.track.url.match(/track\/([A-Za-z0-9]+)/) || [])[1];
      if (token && id){
        try {
          // Transfer playback to SDK device
          await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer '+token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_ids: [sdkDeviceId], play: false })
          });
          // Play track on SDK device
          const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(sdkDeviceId)}`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer '+token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ uris: [`spotify:track:${id}`] })
          });
          if (res.status === 204) return; // Success
        } catch (e) {
          console.error('SDK playback failed', e);
        }
      }
    }
    // Fallback: try Web API on active device, then embed
    const ok = await playViaWebApi(msg.track);
    if (!ok) playTrack(msg.track);
  }
  if (msg.type === 'STOP_SPOTIFY') {
    stop();
    if (sdkPlayer) {
      sdkPlayer.pause();
    }
  }
  if (msg.type === 'LOGIN_SPOTIFY'){
    // Handled by background
  }
  if (msg.type === 'IS_AUTHENTICATED'){
    const { spotifyToken, tokenTimestamp } = await chrome.storage.local.get({ spotifyToken:'', tokenTimestamp: 0 });
    const ok = !!spotifyToken && (Date.now() - tokenTimestamp) < 3600000;
    chrome.runtime.sendMessage({ type: 'AUTH_STATUS', ok });
  }
});


