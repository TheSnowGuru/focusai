let DURATION_MINUTES = 25; // user selectable 5-30
const $time = document.getElementById('time');
const $bubble = document.getElementById('bubble');
const $status = document.getElementById('status-dot');
const $card = document.getElementById('track-card');
const $freq = document.getElementById('track-frequency');
const $name = document.getElementById('track-name');
// UI elements for progress and duration
const $player = document.getElementById('player');
const $progress = document.getElementById('progress');
const $duration = document.getElementById('duration');
const $durationValue = document.getElementById('duration-value');
const $open = document.getElementById('open-spotify');
const $skip = document.getElementById('skip');
const $viewTimer = document.getElementById('view-timer');
const $viewLogin = document.getElementById('view-login');
const $loginBtn = document.getElementById('login-spotify');
// Tasks
const $taskInput = document.getElementById('new-task');
const $taskList = document.getElementById('task-list');
const $clearDone = document.getElementById('clear-done');
const $confetti = document.getElementById('confetti');

let tracks = [];
let ticking = null;

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
function getNextTrack(current){
  if (!tracks.length) return null;
  const idx = current ? tracks.findIndex(t => t.url === current.url) : -1;
  const nextIdx = (idx >= 0 ? idx + 1 : 0) % tracks.length;
  return tracks[nextIdx];
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
  // Playback happens in offscreen; keep popup iframe blank so closing popup won't stop audio
  if ($player) $player.src = 'about:blank';
  $open.href = track.url;
  // ask offscreen to play
  chrome.runtime.sendMessage({ type: 'PLAY_SPOTIFY', track });
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

  // Check for existing session first
  await checkExistingSession();

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
  // Playback handled by showTrack() via offscreen
}

async function stopTimer(silent=false){
  clearInterval(ticking);
  ticking = null;
  if ($player) $player.src = 'about:blank';

  await chrome.storage.local.set({ isRunning:false, startTime:null, track:null });
  chrome.alarms.clear('focus-end');

  setRunningUI(false);
  $time.textContent = `${pad(DURATION_MINUTES)}:00`;
  updateProgress(0);

  // Stop offscreen playback
  chrome.runtime.sendMessage({ type: 'STOP_SPOTIFY' });

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
    updateProgress(1 - (left / durationMs));

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
  await initDurationSelector();
  await initTasks();
  initAuthHandlers();
})();


function startViz(){
  // removed
}

window.addEventListener('beforeunload', () => {
  // If timer is running, hand off playback to offscreen
  (async () => {
    try {
      const { isRunning, track } = await chrome.storage.local.get({ isRunning:false, track:null });
      if (isRunning && track) {
        chrome.runtime.sendMessage({ type: 'PLAY_SPOTIFY', track });
      }
    } catch {}
  })();
});
function updateProgress(ratio){
  if (!$progress) return;
  const deg = Math.max(0, Math.min(1, ratio)) * 360;
  $progress.style.background = `conic-gradient(var(--accent) ${deg}deg, rgba(255,255,255,0.08) 0deg)`;
}

async function initDurationSelector(){
  if (!$duration) return;
  const { durationMs } = await chrome.storage.local.get({ durationMs: DURATION_MINUTES*60*1000 });
  const minutes = Math.round((durationMs/60000));
  DURATION_MINUTES = Math.max(5, Math.min(30, minutes - (minutes % 5) || minutes));
  $duration.value = String(DURATION_MINUTES);
  $durationValue.textContent = String(DURATION_MINUTES);
  $duration.addEventListener('input', () => {
    $durationValue.textContent = $duration.value;
  });
  $duration.addEventListener('change', async () => {
    DURATION_MINUTES = parseInt($duration.value, 10);
    const { isRunning, startTime } = await chrome.storage.local.get({ isRunning:false, startTime:null });
    const durationMsNew = DURATION_MINUTES*60*1000;
    await chrome.storage.local.set({ durationMs: durationMsNew });
    if (isRunning && startTime){
      // Restart countdown with new duration from now
      await startTimer();
    } else {
      $time.textContent = `${pad(DURATION_MINUTES)}:00`;
      updateProgress(0);
    }
  });
}

function renderTasks(items){
  $taskList.innerHTML = '';
  for (const it of items){
    const li = document.createElement('li');
    if (it.done) li.classList.add('done');
    const check = document.createElement('div');
    check.className = 'check';
    check.innerHTML = '✏️';
    check.title = 'Edit task';
    check.addEventListener('click', async () => {
      // Turn text into an input for editing
      const input = document.createElement('input');
      input.type = 'text';
      input.value = it.text;
      input.style.flex = '1';
      input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter'){
          const val = input.value.trim();
          it.text = val || it.text;
          await saveTasks(items);
          renderTasks(items);
        }
      });
      input.addEventListener('blur', async () => {
        const val = input.value.trim();
        it.text = val || it.text;
        await saveTasks(items);
        renderTasks(items);
      });
      li.replaceChild(input, span);
      input.focus();
    });
    const span = document.createElement('div');
    span.className = 'task';
    span.textContent = it.text;
    const action = document.createElement('button');
    action.className = 'ghost';
    action.textContent = 'Mark As Done ✅';
    action.addEventListener('click', async () => {
      // Remove task upon completion
      celebrate();
      const idx = items.indexOf(it);
      if (idx >= 0) items.splice(idx,1);
      await saveTasks(items);
      renderTasks(items);
    });
    li.appendChild(check);
    li.appendChild(span);
    li.appendChild(action);
    $taskList.appendChild(li);
  }
}

async function saveTasks(items){
  await chrome.storage.local.set({ tasks: items });
}

async function initTasks(){
  const { tasks } = await chrome.storage.local.get({ tasks: [] });
  const items = Array.isArray(tasks) ? tasks : [];
  renderTasks(items);
  $taskInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter'){
      const text = $taskInput.value.trim();
      if (!text) return;
      items.push({ text, done:false });
      $taskInput.value = '';
      await saveTasks(items);
      renderTasks(items);
    }
  });
  $clearDone.addEventListener('click', async () => {
    for (let i=items.length-1;i>=0;i--){ if (items[i].done) items.splice(i,1); }
    await saveTasks(items);
    renderTasks(items);
  });
}

function celebrate(){
  if (!$confetti) return;
  
  // Play explosion sound with proper volume
  try {
    const url = chrome.runtime.getURL('explosion-01.mp3');
    const audio = new Audio(url);
    audio.volume = 0.8;
    audio.play().catch(e => console.log('Audio play failed:', e));
  } catch (e) {
    console.log('Audio error:', e);
  }
  
  // Create canvas for particle explosion
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 300;
  canvas.style.position = 'absolute';
  canvas.style.left = '50%';
  canvas.style.top = '-150px';
  canvas.style.transform = 'translateX(-50%)';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '1000';
  $confetti.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // Create particles
  const particles = [];
  const particleCount = 80;
  const colors = ['#7ae0ff', '#9effa1', '#ffd700', '#ff6b6b', '#ff9efb', '#fff'];
  
  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
    const velocity = 3 + Math.random() * 4;
    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      radius: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: 0.015 + Math.random() * 0.01
    });
  }
  
  // Animate explosion
  let frame = 0;
  function animate() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let alive = 0;
    particles.forEach(p => {
      if (p.life <= 0) return;
      alive++;
      
      // Update position
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.vx *= 0.98; // air resistance
      p.life -= p.decay;
      
      // Draw particle with glow
      ctx.globalAlpha = p.life;
      ctx.shadowBlur = 15;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Add trail
      ctx.shadowBlur = 5;
      ctx.globalAlpha = p.life * 0.5;
      ctx.beginPath();
      ctx.arc(p.x - p.vx * 0.5, p.y - p.vy * 0.5, p.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    });
    
    if (alive > 0 && frame < 120) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }
  
  animate();
}

function initAuthHandlers(){
  // Display redirect URI
  const extensionId = chrome.runtime.id;
  const redirectUri = `https://${extensionId}.chromiumapp.org/callback`;
  const redirectDisplay = document.getElementById('redirect-uri-display');
  const copyBtn = document.getElementById('copy-redirect-uri');
  
  if (redirectDisplay) {
    redirectDisplay.textContent = redirectUri;
  }
  
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(redirectUri);
        copyBtn.textContent = '✅ Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy Redirect URI';
        }, 2000);
      } catch (e) {
        alert('Failed to copy. URI: ' + redirectUri);
      }
    });
  }
  
  if ($loginBtn){
    $loginBtn.addEventListener('click', async () => {
      try {
        await loginWithSpotify();
      } catch (e) {
        // fallback: ask background (in case of policies)
        chrome.runtime.sendMessage({ type: 'LOGIN_SPOTIFY' });
      }
    });
  }
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'LOGIN_RESULT'){
      checkExistingSession();
    }
    if (msg && msg.type === 'AUTH_STATUS'){
      toggleViews(msg.ok);
    }
  });
}

async function checkExistingSession(){
  // Check if we have a valid token
  const { spotifyToken, tokenTimestamp } = await chrome.storage.local.get({ spotifyToken:'', tokenTimestamp: 0 });
  const hasToken = !!spotifyToken && (Date.now() - tokenTimestamp) < 3600000;
  
  if (hasToken) {
    // Verify token is still valid by making a test API call
    try {
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': 'Bearer ' + spotifyToken }
      });
      if (res.ok) {
        toggleViews(true);
        return;
      }
    } catch (e) {
      console.log('Token validation failed, need re-auth');
    }
  }
  
  toggleViews(false);
}

function toggleViews(isAuthed){
  if ($viewLogin){
    $viewLogin.classList.toggle('hidden', !!isAuthed);
  }
}

async function loginWithSpotify(){
  const clientId = '13b4d04efb374d83892efa41680c4a3b';
  const extensionId = chrome.runtime.id;
  const redirectUri = `https://${extensionId}.chromiumapp.org/callback`;
  const scopes = ['streaming','user-read-email','user-read-private','user-modify-playback-state'];
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: redirectUri,
    scope: scopes.join(' ')
  }).toString();
  const url = `https://accounts.spotify.com/authorize?${params}`;
  
  console.log('Extension ID:', extensionId);
  console.log('Redirect URI:', redirectUri);
  console.log('Starting Spotify auth with URL:', url);
  
  try {
    const redirectUrl = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
    console.log('Received redirect URL:', redirectUrl);
    
    // Parse the URL to check for error or access token
    const urlObj = new URL(redirectUrl);
    console.log('URL pathname:', urlObj.pathname);
    console.log('URL hash:', urlObj.hash);
    console.log('URL search:', urlObj.search);
    
    // Check if there's an error in the URL
    const errorParam = urlObj.searchParams.get('error');
    if (errorParam) {
      console.error('Spotify returned error:', errorParam);
      throw new Error(`Spotify error: ${errorParam}`);
    }
    
    const hash = urlObj.hash.slice(1);
    console.log('Hash after slice:', hash);
    const data = new URLSearchParams(hash);
    const access = data.get('access_token');
    
    console.log('Parsed access token:', access ? 'Found (length: ' + access.length + ')' : 'NOT FOUND');
    console.log('All hash params:', Array.from(data.entries()));
    
    if (!access) {
      console.error('No access token in redirect');
      console.error('Full redirect URL:', redirectUrl);
      throw new Error('No access token received from Spotify. Check console for details.');
    }
    
    console.log('Successfully received access token');
    await chrome.storage.local.set({ spotifyToken: access, tokenTimestamp: Date.now() });
    toggleViews(true);
  } catch (error) {
    console.error('Login error:', error);
    alert('Spotify login failed. Please try again. Error: ' + error.message);
    throw error;
  }
}


