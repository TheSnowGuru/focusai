let DURATION_MINUTES = 25; // user selectable 5-30
const $time = document.getElementById('time');
const $bubble = document.getElementById('bubble');
const $bubbleTime = document.getElementById('bubble-time');
const $player = document.getElementById('player');
const $progress = document.getElementById('progress');
const $skip = document.getElementById('skip');
const $viewTimer = document.getElementById('view-timer');
const $viewLogin = document.getElementById('view-login');
const $loginBtn = document.getElementById('login-spotify');
const $authBtn = document.getElementById('auth-btn');
const $bubbleOverlay = document.getElementById('bubble-overlay');

// Tasks
const $taskList = document.getElementById('task-list');
const $addTaskBtn = document.getElementById('add-task-btn');
const $searchTasks = document.getElementById('search-tasks');
const $confetti = document.getElementById('confetti');

// Timer controls
const $pauseBtn = document.getElementById('pause-btn');
const $resetBtn = document.getElementById('reset-btn');
const $durationPills = document.getElementById('duration-pills');
const $trackInfo = document.getElementById('track-info');

let tracks = [];
let ticking = null;

// Motivational messages
const motivationalMessages = [
  "Get things done now",
  "Focus on your tasks",
  "Close your mobile",
  "Deep work creates value",
  "One task at a time",
  "Eliminate distractions",
  "Your future self will thank you",
  "Progress over perfection",
  "Stay in the zone",
  "Make every minute count"
];

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
  if ($bubbleOverlay) {
    $bubbleOverlay.classList.toggle('hidden', !isRunning);
  }
  if ($bubble) {
  $bubble.setAttribute('aria-pressed', String(isRunning));
  }
  // Update pause button text
  if ($pauseBtn) {
    $pauseBtn.textContent = isRunning ? 'pause' : 'start';
  }
  // Update bubble time display
  if ($bubbleTime && $time) {
    $bubbleTime.textContent = $time.textContent;
  }
}
function showTrack(track){
  if (!track){ // Guard
    if ($player) $player.src = 'about:blank';
    if ($trackInfo) $trackInfo.textContent = 'No track selected';
    return;
  }
  console.log('🎵 showTrack called:', track.name, track.url);
  if ($trackInfo) $trackInfo.textContent = `${track.name} • ${track.frequency} Hz`;
  // Show the Spotify embed UI in the popup (visual only)
  try {
    const id = (track.url.match(/track\/([A-Za-z0-9]+)/) || [])[1];
    if ($player && id) {
      $player.src = `https://open.spotify.com/embed/track/${id}`;
    }
  } catch {}
  // ask offscreen to play
  console.log('📤 Sending PLAY_SPOTIFY message to background');
  chrome.runtime.sendMessage({ type: 'PLAY_SPOTIFY', track }, (response) => {
    console.log('📥 Response from background:', response);
  });
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

  // Check for existing session first and toggle views accordingly
  const isAuthed = await checkExistingSession();
  toggleViews(isAuthed);

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
    const timeText = formatTimeLeft(left);
    $time.textContent = timeText;
    if ($bubbleTime) $bubbleTime.textContent = timeText;
    updateProgress(1 - (left / durationMs));

    if (left <= 0){
      clearInterval(ticking);
      ticking = null;
      await stopTimer(true);

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'FocusAI',
        message: 'Times up! Great work. Take 5-10 and come back 💪'
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
  initAuthButton();
  initNewUIHandlers();
  updateMotivation(); // Show initial motivation
})();

function initNewUIHandlers() {
  // Add task button
  if ($addTaskBtn) {
    $addTaskBtn.addEventListener('click', () => {
      const taskText = prompt('Enter task:');
      if (taskText && taskText.trim()) {
        addTask(taskText.trim());
      }
    });
  }

  // Search functionality
  if ($searchTasks) {
    $searchTasks.addEventListener('input', (e) => {
      filterTasks(e.target.value);
    });
  }

  // Pause/Reset buttons
  if ($pauseBtn) {
    $pauseBtn.addEventListener('click', () => {
      if (ticking) {
        stopTimer();
      } else {
        startTimer();
      }
    });
  }

  if ($resetBtn) {
    $resetBtn.addEventListener('click', () => {
      stopTimer();
      $time.textContent = formatTimeLeft(DURATION_MINUTES * 60 * 1000);
      updateProgress(0);
    });
  }

  // Bubble overlay close
  if ($bubbleOverlay) {
    $bubbleOverlay.addEventListener('click', (e) => {
      if (e.target === $bubbleOverlay) {
        $bubbleOverlay.classList.add('hidden');
      }
    });
  }
}

function addTask(text) {
  // Get current tasks
  chrome.storage.local.get({ tasks: [] }).then(({ tasks }) => {
    const newTask = { text, done: false };
    tasks.push(newTask);
    saveTasks(tasks);
    renderTasks(tasks);
  });
}

function filterTasks(searchTerm) {
  const tasks = Array.from($taskList.children);
  tasks.forEach(task => {
    const text = task.querySelector('.task-title').textContent.toLowerCase();
    const matches = text.includes(searchTerm.toLowerCase());
    task.style.display = matches ? 'flex' : 'none';
  });
}

function updateMotivation() {
  const $motivation = document.getElementById('motivation');
  const $motivationText = document.getElementById('motivation-text');
  
  if (!$motivation || !$motivationText) return;
  
  // Check if user has tasks
  const hasTasks = $taskList && $taskList.children.length > 0;
  
  if (!hasTasks) {
    $motivationText.textContent = "Add your first task";
    $motivation.classList.remove('hidden');
  } else {
    // Show random motivational message
    const randomIndex = Math.floor(Math.random() * motivationalMessages.length);
    $motivationText.textContent = motivationalMessages[randomIndex];
    $motivation.classList.remove('hidden');
  }
}

// Update motivation when popup is opened (visibility change)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateMotivation();
  }
});

function initAuthButton() {
  if (!$authBtn) return;
  
  $authBtn.addEventListener('click', async () => {
    const isAuthed = await checkExistingSession();
    
    if (isAuthed) {
      // Logout
      if (confirm('Are you sure you want to logout?')) {
        await chrome.storage.local.remove(['spotifyToken', 'tokenTimestamp', 'spotifyRefreshToken', 'spotifyCodeVerifier']);
        console.log('🚪 Logged out');
        toggleViews(false);
      }
    } else {
      // Login
      try {
        await loginWithSpotify();
      } catch (e) {
        console.error('Login failed:', e);
        alert('Login failed. Please try again.\n\nError: ' + e.message);
      }
    }
  });
}


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
  if (!$durationPills) return;
  const { durationMs } = await chrome.storage.local.get({ durationMs: DURATION_MINUTES*60*1000 });
  const minutes = Math.round((durationMs/60000));
  DURATION_MINUTES = Math.max(5, Math.min(30, minutes - (minutes % 5) || minutes));
  
  // Create duration pills
  const durations = [5, 10, 15, 20, 25, 30];
  $durationPills.innerHTML = '';
  
  durations.forEach(min => {
    const btn = document.createElement('button');
    btn.className = `duration-btn ${min === DURATION_MINUTES ? 'active' : ''}`;
    btn.textContent = `${min}m`;
    btn.addEventListener('click', async () => {
      DURATION_MINUTES = min;
      // Update active state
      $durationPills.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
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
    $durationPills.appendChild(btn);
  });
}

function renderTasks(items){
  if (!$taskList) return;
  
  $taskList.innerHTML = '';
  for (const it of items){
    const li = document.createElement('li');
    
    // Add drag and drop attributes
    li.draggable = true;
    li.dataset.taskId = items.indexOf(it);
    
    // Add drag event listeners
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragend', handleDragEnd);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('drop', handleDrop);
    
    // Status indicator
    const status = document.createElement('div');
    status.className = 'task-status pending';
    status.innerHTML = '⏱️';
    status.title = 'Pending';
    
    // Task content
    const content = document.createElement('div');
    content.className = 'task-content';
    
    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = it.text;
    
    const details = document.createElement('div');
    details.className = 'task-details';
    details.textContent = `- pending • added ${new Date().toLocaleTimeString()}`;
    
    content.appendChild(title);
    content.appendChild(details);
    
    // Task actions
    const actions = document.createElement('div');
    actions.className = 'task-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit task';
    editBtn.addEventListener('click', async () => {
      const newText = prompt('Edit task:', it.text);
      if (newText && newText.trim()) {
        it.text = newText.trim();
        await saveTasks(items);
        renderTasks(items);
      }
    });
    
    const completeBtn = document.createElement('button');
    completeBtn.className = 'complete-btn';
    completeBtn.textContent = 'Complete';
    completeBtn.addEventListener('click', async () => {
      celebrate();
      const idx = items.indexOf(it);
      if (idx >= 0) items.splice(idx, 1);
      await saveTasks(items);
      renderTasks(items);
    });
    
    actions.appendChild(editBtn);
    actions.appendChild(completeBtn);
    
    li.appendChild(status);
    li.appendChild(content);
    li.appendChild(actions);
    $taskList.appendChild(li);
  }
  
  // Update motivation after rendering tasks
  updateMotivation();
}

async function saveTasks(items){
  await chrome.storage.local.set({ tasks: items });
}

// Drag and drop functionality
let draggedElement = null;

function handleDragStart(e) {
  draggedElement = e.target;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.target.outerHTML);
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  // Remove drag-over class from all items
  document.querySelectorAll('#task-list li').forEach(li => {
    li.classList.remove('drag-over');
  });
  draggedElement = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const afterElement = getDragAfterElement($taskList, e.clientY);
  const dragging = document.querySelector('.dragging');
  
  if (afterElement == null) {
    $taskList.appendChild(dragging);
  } else {
    $taskList.insertBefore(dragging, afterElement);
  }
}

function handleDrop(e) {
  e.preventDefault();
  // The actual reordering is handled in handleDragOver
  // Here we just save the new order
  const tasks = Array.from($taskList.children).map((li, index) => {
    const taskText = li.querySelector('.task-title').textContent;
    return { text: taskText, done: false };
  });
  
  saveTasks(tasks);
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function initTasks(){
  const { tasks } = await chrome.storage.local.get({ tasks: [] });
  const items = Array.isArray(tasks) ? tasks : [];
  renderTasks(items);
}

function celebrate(){
  if (!$confetti) return;
  
  // Play explosion sound
  const audio = new Audio('explosion-01.mp3');
  audio.volume = 0.7;
  audio.play().catch(e => console.log('Audio play failed:', e));
  
  // Create confetti explosion
  const colors = ['🎉', '✨', '🎊', '💥', '🌟', '💫', '⭐', '🔥'];
  const count = 15;
  
  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.textContent = colors[Math.floor(Math.random() * colors.length)];
    
    // Random positioning and animation
    const dx = (Math.random() - 0.5) * 200;
    const dy = 60 + Math.random() * 40;
    const rot = (Math.random() - 0.5) * 40;
    const jx = (Math.random() - 0.5) * 20;
    const jy = Math.random() * 10;
    const jx2 = (Math.random() - 0.5) * 30;
    const jy2 = Math.random() * 15;
    
    confetti.style.setProperty('--dx', `${dx}px`);
    confetti.style.setProperty('--dy', `${dy}px`);
    confetti.style.setProperty('--rot', `${rot}deg`);
    confetti.style.setProperty('--jx', `${jx}px`);
    confetti.style.setProperty('--jy', `${jy}px`);
    confetti.style.setProperty('--jx2', `${jx2}px`);
    confetti.style.setProperty('--jy2', `${jy2}px`);
    
    $confetti.appendChild(confetti);
    
    // Remove after animation
    setTimeout(() => {
      if (confetti.parentNode) {
        confetti.parentNode.removeChild(confetti);
      }
    }, 1200);
  }
}


function initAuthHandlers(){
  // Display redirect URI in the new login card
  const redirectUri = chrome.identity.getRedirectURL('callback');
  const redirectDisplay = document.getElementById('redirect-uri');
  
  console.log('📋 Redirect URI:', redirectUri);
  
  if (redirectDisplay) {
    redirectDisplay.textContent = redirectUri;
  }
  
  if ($loginBtn){
    $loginBtn.addEventListener('click', async () => {
      $loginBtn.disabled = true;
      $loginBtn.textContent = 'Opening Spotify...';
      
      try {
        await loginWithSpotify();
        // Success - toggleViews will be called inside loginWithSpotify
      } catch (e) {
        console.error('Login failed:', e);
        alert('Spotify login failed. Please try again.\n\nError: ' + e.message);
        $loginBtn.disabled = false;
        $loginBtn.textContent = 'Login with Spotify';
      }
    });
  }
}

function toggleViews(isAuthed) {
  console.log('🔄 Toggle views - isAuthed:', isAuthed);
  
  if ($viewTimer) {
    $viewTimer.classList.toggle('hidden', !isAuthed);
  }
  if ($viewLogin) {
    $viewLogin.classList.toggle('hidden', !!isAuthed);
  }
  
  // Update auth button
  if ($authBtn) {
    if (isAuthed) {
      $authBtn.textContent = 'Logout';
      $authBtn.style.background = '#dc3545';
    } else {
      $authBtn.textContent = 'Login';
      $authBtn.style.background = '#007bff';
    }
  }
  
  console.log('Timer visible:', !$viewTimer?.classList.contains('hidden'));
  console.log('Login visible:', !$viewLogin?.classList.contains('hidden'));
}

async function checkExistingSession(){
  // Check if we have a valid token
  const { spotifyToken, tokenTimestamp } = await chrome.storage.local.get({ spotifyToken:'', tokenTimestamp: 0 });
  const hasToken = !!spotifyToken && (Date.now() - tokenTimestamp) < 3600000;
  
  console.log('🔍 Checking session - hasToken:', hasToken);
  
  if (hasToken) {
    // Verify token is still valid by making a test API call
    try {
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': 'Bearer ' + spotifyToken }
      });
      if (res.ok) {
        const user = await res.json();
        console.log('✅ Valid session found:', user.display_name);
        return true;
      }
    } catch (e) {
      console.log('⚠️ Token validation failed, need re-auth');
    }
  }
  
  console.log('❌ No valid session');
  return false;
}


async function loginWithSpotify(){
  const clientId = '13b4d04efb374d83892efa41680c4a3b';
  const redirectUri = chrome.identity.getRedirectURL('callback');
  const scopes = ['streaming','user-read-email','user-read-private','user-modify-playback-state'];
  
  console.log('🔐 Starting Spotify login...');
  console.log('Extension ID:', chrome.runtime.id);
  console.log('Redirect URI:', redirectUri);
  
  // Generate PKCE code verifier and challenge
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // Store code verifier for later use
  await chrome.storage.local.set({ spotifyCodeVerifier: codeVerifier });
  
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    show_dialog: 'true' // Changed to true to ensure fresh auth
  }).toString();
  const url = `https://accounts.spotify.com/authorize?${params}`;
  
  console.log('🌐 Opening Spotify authorization...');
  
  try {
    // Use identity flow so Chrome captures the redirect
    const redirectUrl = await chrome.identity.launchWebAuthFlow({ 
      url, 
      interactive: true 
    });
    console.log('✅ Received redirect URL:', redirectUrl);
    
    // Parse the URL to get the authorization code
    const urlObj = new URL(redirectUrl);
    const code = urlObj.searchParams.get('code');
    const errorParam = urlObj.searchParams.get('error');
    
    if (errorParam) {
      console.error('Spotify OAuth error:', errorParam);
      throw new Error(`Spotify error: ${errorParam}`);
    }
    if (!code) {
      console.error('No authorization code received');
      throw new Error('No authorization code received from Spotify');
    }
    
    console.log('🔄 Exchanging authorization code for access token...');
    const { spotifyCodeVerifier } = await chrome.storage.local.get({ spotifyCodeVerifier: '' });
    if (!spotifyCodeVerifier) {
      throw new Error('Code verifier not found in storage');
    }
    
    // Exchange code for token immediately
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: spotifyCodeVerifier
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${errorText}`);
    }
    
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error('No access token in response');
    }
    
    // Store token and update UI
    await chrome.storage.local.set({ 
      spotifyToken: tokenData.access_token, 
      tokenTimestamp: Date.now(),
      spotifyRefreshToken: tokenData.refresh_token || ''
    });
    
    // Clear the code verifier after successful exchange
    await chrome.storage.local.remove(['spotifyCodeVerifier']);
    
    toggleViews(true);
    console.log('✅ Login complete!');
    
  } catch (error) {
    console.error('Login error:', error);
    // Clear stored code verifier on error
    await chrome.storage.local.remove(['spotifyCodeVerifier']);
    throw error;
  }
}

// PKCE helper functions
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


