const DURATION_MINUTES = 25; // Change here if you want 15/45 minutes
const $time = document.getElementById('time');
const $bubble = document.getElementById('bubble');
const $status = document.getElementById('status-dot');
const $card = document.getElementById('track-card');
const $freq = document.getElementById('track-frequency');
const $name = document.getElementById('track-name');
// Playback moved to offscreen; we keep iframe ref for UI only (hidden/unused)
const $player = document.getElementById('player');
const $viz = document.getElementById('viz');
let vizCtx = $viz ? $viz.getContext('2d') : null;
let vizId = null;
const SEGMENTS = 60; // fewer segments to reduce CPU
const angles = new Float32Array(SEGMENTS + 1);
for (let i=0;i<=SEGMENTS;i++) angles[i] = (Math.PI*2/SEGMENTS)*i;
const $open = document.getElementById('open-spotify');
const $skip = document.getElementById('skip');

let tracks = [];
let ticking = null;
let sdkPlayer = null;
let sdkDeviceId = null;

async function loadTracks(){
  // Load tracks.json from the extension
  const res = await fetch(chrome.runtime.getURL('tracks.json'));
  tracks = await res.json();
  if (!Array.isArray(tracks) || tracks.length === 0) {
    console.warn('tracks.json empty or invalid');
    tracks = [];
  }
}

function pad(n){ return n.toString().padStart(2,'0'); }
function formatTimeLeft(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const m = Math.floor(s/60);
  const r = s % 60;
  return `${pad(m)}:${pad(r)}`;
}
function pickRandomTrack(){
  if (!tracks.length) return null;
  return tracks[Math.floor(Math.random()*tracks.length)];
}
function setRunningUI(isRunning){
  $status.classList.toggle('running', isRunning);
  $status.classList.toggle('stopped', !isRunning);
  $card.classList.toggle('hidden', !isRunning);
  $bubble.setAttribute('aria-pressed', String(isRunning));
}
function showTrack(track){
  if (!track){ // Guard
    if ($player) $player.src = 'about:blank';
    $freq.textContent = '— Hz';
    $name.textContent = '—';
    $open.removeAttribute('href');
    return;
  }
  $freq.textContent = `${track.frequency} Hz`;
  $name.textContent = track.name;
  // Offscreen handles playback; keep embed for reference if needed
  if ($player) $player.src = track.embedUrl;
  $open.href = track.url;
}

async function restoreState(){
  const defaults = {
    startTime: null,
    durationMs: DURATION_MINUTES*60*1000,
    isRunning: false,
    track: null
  };
  const state = await chrome.storage.local.get(defaults);
  const { startTime, durationMs, isRunning, track } = state;

  if (isRunning && startTime){
    const elapsed = Date.now() - startTime;
    const left = Math.max(0, durationMs - elapsed);
    $time.textContent = formatTimeLeft(left);

    if (left <= 0){
      await stopTimer(true);
    } else {
      setRunningUI(true);
      if (track) showTrack(track);
      tick(left, startTime, durationMs);
    }
  } else {
    $time.textContent = `${pad(DURATION_MINUTES)}:00`;
    setRunningUI(false);
  }
}

async function startTimer(){
  const chosen = pickRandomTrack();
  showTrack(chosen);

  const durationMs = DURATION_MINUTES*60*1000;
  const startTime = Date.now();
  await chrome.storage.local.set({ startTime, durationMs, isRunning: true, track: chosen });

  // Create an alarm for the end — used for notification
  chrome.alarms.clear('focus-end', () => {
    chrome.alarms.create('focus-end', { when: startTime + durationMs });
  });

  setRunningUI(true);
  tick(durationMs, startTime, durationMs);
  // Try SDK playback first; fallback to background tab
  const ok = await playViaSdk(chosen).catch(() => false);
  if (!ok) {
    await chrome.runtime.sendMessage({ type: 'PLAY_TRACK', track: chosen });
  }
}

async function stopTimer(silent=false){
  clearInterval(ticking);
  ticking = null;
  if ($player) $player.src = 'about:blank';

  await chrome.storage.local.set({ isRunning:false, startTime:null, track:null });
  chrome.alarms.clear('focus-end');

  setRunningUI(false);
  $time.textContent = `${pad(DURATION_MINUTES)}:00`;

  // Stop offscreen playback
  await chrome.runtime.sendMessage({ type: 'STOP' });

  if (!silent){
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'FocusAI',
      message: 'Timer stopped.'
    });
  }
}

function tick(leftInitial, startTime, durationMs){
  clearInterval(ticking);
  let left = leftInitial;

  ticking = setInterval(async () => {
    left = Math.max(0, durationMs - (Date.now() - startTime));
    $time.textContent = formatTimeLeft(left);

    if (left <= 0){
      clearInterval(ticking);
      ticking = null;
      await stopTimer(true);

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'FocusAI',
        message: 'Time’s up! Great work. Take 5–10 and come back 💪'
      });
    }
  }, 250);
}

$bubble.addEventListener('click', async () => {
  const { isRunning } = await chrome.storage.local.get({ isRunning:false });
  if (isRunning) await stopTimer(); else await startTimer();
});

$skip.addEventListener('click', async () => {
  const { isRunning } = await chrome.storage.local.get({ isRunning:false });
  if (!isRunning) return;
  const t = pickRandomTrack();
  await chrome.storage.local.set({ track: t });
  showTrack(t);
});

(async function init(){
  await loadTracks();
  await restoreState();
  startViz();
  await initSpotifySdk();
})();

async function initSpotifySdk(){
  // Load Spotify SDK dynamically
  if (!window.Spotify) {
    try {
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.onload = () => initSpotifySdk();
      document.head.appendChild(script);
      return;
    } catch (err) {
      console.log('Spotify SDK not available, using fallback');
      return;
    }
  }
  
  // Check if we have a valid token
  const { spotifyToken, tokenTimestamp } = await chrome.storage.local.get({ 
    spotifyToken: '', 
    tokenTimestamp: 0 
  });
  
  // Token expires in 1 hour, refresh if needed
  const now = Date.now();
  const tokenAge = now - tokenTimestamp;
  const TOKEN_EXPIRY = 3600000; // 1 hour in ms
  
  if (!spotifyToken || tokenAge > TOKEN_EXPIRY) {
    // Need to authenticate
    await authenticateSpotify();
    return;
  }
  
  sdkPlayer = new Spotify.Player({
    name: 'FocusAI',
    getOAuthToken: cb => cb(spotifyToken),
    volume: 0.5
  });
  sdkPlayer.addListener('ready', ({ device_id }) => {
    sdkDeviceId = device_id;
  });
  sdkPlayer.addListener('not_ready', () => {
    sdkDeviceId = null;
  });
  sdkPlayer.addListener('authentication_error', () => {
    // Token expired, re-authenticate
    authenticateSpotify();
  });
  await sdkPlayer.connect();
}

async function authenticateSpotify(){
  try {
    await chrome.tabs.create({ 
      url: chrome.runtime.getURL('oauth.html'),
      active: true 
    });
  } catch (err) {
    console.error('Failed to open auth page:', err);
  }
}

async function playViaSdk(track){
  if (!sdkDeviceId || !track) return false;
  const uri = toSpotifyUri(track.url);
  if (!uri) return false;
  
  const { spotifyToken } = await chrome.storage.local.get({ spotifyToken: '' });
  if (!spotifyToken) {
    await authenticateSpotify();
    return false;
  }
  
  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/play?device_id='+encodeURIComponent(sdkDeviceId),{
      method:'PUT',
      headers:{
        'Authorization': 'Bearer '+spotifyToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: [uri] })
    });
    
    if (res.status === 401) {
      // Token expired, re-authenticate
      await authenticateSpotify();
      return false;
    }
    
    return res.status === 204;
  } catch { 
    return false; 
  }
}

function toSpotifyUri(openUrl){
  try {
    const u = new URL(openUrl);
    if (u.hostname !== 'open.spotify.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const type = parts[0];
    const id = parts[1].split('?')[0];
    const valid = new Set(['track','album','playlist','artist','episode','show']);
    if (!valid.has(type)) return null;
    return `spotify:${type}:${id}`;
  } catch { return null; }
}

function startViz(){
  if (!vizCtx) return;
  const w = $viz.width, h = $viz.height;
  let t = 0;
  cancelAnimationFrame(vizId);
  function draw(){
    t += 0.033; // ~30fps
    vizCtx.clearRect(0,0,w,h);
    // Radial waves
    for (let i=0;i<3;i++){
      const r = 60 + i*22 + Math.sin(t + i)*8;
      vizCtx.beginPath();
      for (let k=0;k<=SEGMENTS;k++){
        const a = angles[k];
        const jitter = Math.sin(k*4*(Math.PI/SEGMENTS) + t*2 + i)*3;
        const ca = Math.cos(a), sa = Math.sin(a);
        const x = w/2 + (r + jitter) * ca;
        const y = h/2 + (r + jitter) * sa;
        if (k===0) vizCtx.moveTo(x,y); else vizCtx.lineTo(x,y);
      }
      const g = vizCtx.createLinearGradient(0,0,w,h);
      g.addColorStop(0, 'rgba(122,224,255,0.35)');
      g.addColorStop(1, 'rgba(158,255,161,0.28)');
      vizCtx.strokeStyle = g;
      vizCtx.lineWidth = 2;
      vizCtx.stroke();
    }
    vizId = requestAnimationFrame(draw);
  }
  draw();
}

window.addEventListener('beforeunload', () => {
  if (vizId) cancelAnimationFrame(vizId);
  // If timer is running and SDK would unload, hand off playback to background tab
  (async () => {
    try {
      const { isRunning, track } = await chrome.storage.local.get({ isRunning:false, track:null });
      if (isRunning && track) {
        await chrome.runtime.sendMessage({ type: 'PLAY_TRACK', track });
      }
    } catch {}
  })();
});


