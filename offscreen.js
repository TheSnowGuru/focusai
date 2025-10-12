console.log('🎬 Offscreen document loading...');

let currentIframe = null;
let cachedToken = ''; // Cache token received via messages

// No need to access chrome.storage - we'll receive token via messages

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

async function playViaWebApi(track, token){
  if (!track || !track.url || !token) return false;
  const id = (track.url.match(/track\/([A-Za-z0-9]+)/) || [])[1];
  if (!id) return false;
  
  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/play',{
      method:'PUT',
      headers:{
        'Authorization': 'Bearer '+token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: [`spotify:track:${id}`] })
    });
    
    if (res.status === 204) {
      console.log('✅ Web API playback started');
      return true;
    } else {
      const errorText = await res.text();
      console.log('⚠️ Web API playback failed:', res.status, errorText);
      return false;
    }
  } catch (e) {
    console.error('❌ Web API playback error:', e);
    return false;
  }
}

chrome.runtime.onMessage.addListener(async (msg) => {
  console.log('📨 Offscreen received message:', msg.type);
  
  if (msg.type === 'SET_TOKEN') {
    // Cache the token sent from popup/background
    cachedToken = msg.token || '';
    console.log('🔑 Token cached:', cachedToken ? 'Yes' : 'No');
  }
  
  if (msg.type === 'PLAY_SPOTIFY') {
    console.log('▶️ PLAY_SPOTIFY received');
    
    // Update token if provided
    if (msg.token) {
      cachedToken = msg.token;
    }
    
    // Try Web API first with cached token, then fall back to embed
    if (cachedToken && msg.track) {
      const ok = await playViaWebApi(msg.track, cachedToken);
      if (ok) {
        console.log('✅ Playback via Web API successful');
        return;
      }
    }
    
    // Fallback to iframe embed (no auth needed, but 30s previews only)
    console.log('🎵 Falling back to iframe embed');
    playTrack(msg.track);
  }
  
  if (msg.type === 'STOP_SPOTIFY') {
    console.log('⏹️ STOP_SPOTIFY received');
    stop();
  }
});

console.log('✅ Offscreen document ready and listening for messages');
