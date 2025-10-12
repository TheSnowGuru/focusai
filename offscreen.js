console.log('🎬 Offscreen document loading...');

let currentIframe = null;
let currentAudio = null;
let cachedToken = ''; // Cache token received via messages

// No need to access chrome.storage - we'll receive token via messages

function removeIframe(){
  if (currentIframe && currentIframe.parentNode){
    currentIframe.parentNode.removeChild(currentIframe);
  }
  currentIframe = null;
}

function stopAudio(){
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
}

function playTrack(track){
  removeIframe();
  stopAudio();
  
  if (!track || !track.url) return;
  
  const id = (track.url.match(/track\/([A-Za-z0-9]+)/) || [])[1];
  if (!id) return;
  
  console.log('🎵 Playing track via iframe embed (fallback)');
  
  // Create iframe embed as fallback
  const iframe = document.createElement('iframe');
  iframe.width = '100%';
  iframe.height = '80';
  iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  iframe.style.border = '0';
  iframe.src = `https://open.spotify.com/embed/track/${id}?autoplay=1`;
  document.body.appendChild(iframe);
  currentIframe = iframe;
  
  // Also try to get preview URL and play via Audio API (continues in background)
  fetch(`https://api.spotify.com/v1/tracks/${id}`, {
    headers: cachedToken ? { 'Authorization': 'Bearer ' + cachedToken } : {}
  })
  .then(res => res.json())
  .then(data => {
    if (data.preview_url) {
      console.log('🎧 Found preview URL, playing via Audio API');
      currentAudio = new Audio(data.preview_url);
      currentAudio.loop = true; // Loop the 30s preview
      currentAudio.volume = 0.7;
      currentAudio.play().catch(e => {
        console.log('Audio API play failed:', e);
      });
    }
  })
  .catch(e => {
    console.log('Could not fetch preview URL:', e);
  });
}

function stop(){ 
  removeIframe();
  stopAudio();
}

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
      console.log('🔑 Token updated from message');
    }
    
    // Priority 1: Try Web API (full tracks, requires Premium + active device)
    if (cachedToken && msg.track) {
      const ok = await playViaWebApi(msg.track, cachedToken);
      if (ok) {
        console.log('✅ Playback via Web API successful (full track)');
        return;
      }
      console.log('⚠️ Web API failed, trying fallback methods...');
    }
    
    // Priority 2: Fallback to iframe embed + Audio API preview
    // This will play 30s previews via Audio API which continues in background
    console.log('🎵 Using fallback: iframe embed + Audio API preview');
    playTrack(msg.track);
  }
  
  if (msg.type === 'STOP_SPOTIFY') {
    console.log('⏹️ STOP_SPOTIFY received');
    stop();
  }
});

console.log('✅ Offscreen document ready and listening for messages');
