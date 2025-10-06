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
  // Offscreen handles playback; keep embed for reference if needed
  if ($player) $player.src = track.embedUrl;
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
  const { isRunning, track: current } = await chrome.storage.local.get({ isRunning:false, track:null });
  if (!isRunning) return;
  const t = getNextTrack(current) || pickRandomTrack();
  await chrome.storage.local.set({ track: t });
  showTrack(t);
});

(async function init(){
  await loadTracks();
  await restoreState();
  await initDurationSelector();
  await initTasks();
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
    check.innerHTML = it.done ? '✓' : '';
    check.addEventListener('click', async () => {
      it.done = !it.done;
      if (it.done) {
        celebrate();
      }
      await saveTasks(items);
      renderTasks(items);
    });
    const span = document.createElement('div');
    span.className = 'task';
    span.textContent = it.text;
    const del = document.createElement('button');
    del.className = 'ghost';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      const idx = items.indexOf(it);
      if (idx >= 0) items.splice(idx,1);
      await saveTasks(items);
      renderTasks(items);
    });
    li.appendChild(check);
    li.appendChild(span);
    li.appendChild(del);
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
  // Animated confetti burst
  const emojis = ['✨','🎉','✅','🌟','💫'];
  for (let i=0;i<5;i++){
    const el = document.createElement('div');
    el.className = 'confetti';
    el.textContent = emojis[i % emojis.length];
    el.style.setProperty('--dx', `${(i-2)*10}px`);
    $confetti.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
}


