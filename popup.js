const DURATION_MINUTES = 25; // Change here if you want 15/45 minutes
const $time = document.getElementById('time');
const $bubble = document.getElementById('bubble');
const $status = document.getElementById('status-dot');
const $card = document.getElementById('track-card');
const $freq = document.getElementById('track-frequency');
const $name = document.getElementById('track-name');
const $player = document.getElementById('player');
const $open = document.getElementById('open-spotify');
const $skip = document.getElementById('skip');

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
function setRunningUI(isRunning){
  $status.classList.toggle('running', isRunning);
  $status.classList.toggle('stopped', !isRunning);
  $card.classList.toggle('hidden', !isRunning);
  $bubble.setAttribute('aria-pressed', String(isRunning));
}
function showTrack(track){
  if (!track){ // Guard
    $player.src = 'about:blank';
    $freq.textContent = '— Hz';
    $name.textContent = '—';
    $open.removeAttribute('href');
    return;
  }
  $freq.textContent = `${track.frequency} Hz`;
  $name.textContent = track.name;
  $player.src = track.embedUrl;
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
}

async function stopTimer(silent=false){
  clearInterval(ticking);
  ticking = null;
  $player.src = 'about:blank';

  await chrome.storage.local.set({ isRunning:false, startTime:null, track:null });
  chrome.alarms.clear('focus-end');

  setRunningUI(false);
  $time.textContent = `${pad(DURATION_MINUTES)}:00`;

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
})();


