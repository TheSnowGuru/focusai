let currentIframe = null;

async function getStoredToken(){
  const { spotifyToken, tokenTimestamp } = await chrome.storage.local.get({ spotifyToken:'', tokenTimestamp:0 });
  if (!spotifyToken) return '';
  const expired = (Date.now() - tokenTimestamp) >= 3600000;
  return expired ? '' : spotifyToken;
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

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'PLAY_SPOTIFY') {
    // Try Web API first for full playback; fallback to embed
    const ok = await playViaWebApi(msg.track);
    if (!ok) playTrack(msg.track);
  }
  if (msg.type === 'STOP_SPOTIFY') {
    stop();
  }
  if (msg.type === 'LOGIN_SPOTIFY'){
    const access = await getToken();
    chrome.runtime.sendMessage({ type: 'LOGIN_RESULT', ok: !!access });
  }
  if (msg.type === 'IS_AUTHENTICATED'){
    const { spotifyToken, tokenTimestamp } = await chrome.storage.local.get({ spotifyToken:'', tokenTimestamp: 0 });
    const ok = !!spotifyToken && (Date.now() - tokenTimestamp) < 3600000;
    chrome.runtime.sendMessage({ type: 'AUTH_STATUS', ok });
  }
});


