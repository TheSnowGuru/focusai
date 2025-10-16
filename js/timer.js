// Timer management
import { StorageManager } from './storage.js';
import { SpotifyManager } from './spotify.js';

export class TimerManager {
  constructor() {
    this.DURATION_MINUTES = 25;
    this.ticking = null;
    this.elements = {};
  }

  init() {
    this.elements = {
      time: document.getElementById('time'),
      startStop: document.getElementById('start-stop'),
      prev: document.getElementById('prev'),
      next: document.getElementById('next'),
      durationPills: document.getElementById('duration-pills')
    };
    
    this.initEventListeners();
    this.initDurationSelector();
    this.restoreState();
  }

  initEventListeners() {
    if (this.elements.startStop) {
      this.elements.startStop.addEventListener('click', () => this.toggleTimer());
    }
    
    if (this.elements.prev) {
      this.elements.prev.addEventListener('click', () => this.prevTrack());
    }
    
    if (this.elements.next) {
      this.elements.next.addEventListener('click', () => this.nextTrack());
    }
  }

  async toggleTimer() {
    const { isRunning } = await StorageManager.getTimerState();
    if (isRunning) {
      await this.stopTimer();
    } else {
      await this.startTimer();
    }
  }

  async startTimer() {
    const track = await SpotifyManager.pickRandomTrack();
    if (track) {
      await SpotifyManager.playTrack(track);
    }

    const durationMs = this.DURATION_MINUTES * 60 * 1000;
    const startTime = Date.now();
    await StorageManager.setTimerState({ 
      startTime, 
      durationMs, 
      isRunning: true, 
      track 
    });

    chrome.alarms.clear('focus-end', () => {
      chrome.alarms.create('focus-end', { when: startTime + durationMs });
    });

    this.setRunningUI(true);
    this.tick(durationMs, startTime, durationMs);
  }

  async stopTimer(silent = false) {
    clearInterval(this.ticking);
    this.ticking = null;

    await StorageManager.setTimerState({ 
      isRunning: false, 
      startTime: null, 
      track: null 
    });
    chrome.alarms.clear('focus-end');

    this.setRunningUI(false);
    if (this.elements.time) {
      this.elements.time.textContent = this.formatTime(this.DURATION_MINUTES * 60 * 1000);
    }

    await SpotifyManager.stopPlayback();

    if (!silent) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'FocusAI',
        message: 'Timer stopped.'
      });
    }
  }

  tick(leftInitial, startTime, durationMs) {
    clearInterval(this.ticking);
    let left = leftInitial;

    this.ticking = setInterval(async () => {
      left = Math.max(0, durationMs - (Date.now() - startTime));
      const timeText = this.formatTime(left);
      
      if (this.elements.time) {
        this.elements.time.textContent = timeText;
      }

      if (left <= 0) {
        clearInterval(this.ticking);
        this.ticking = null;
        await this.stopTimer(true);

        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'FocusAI',
          message: 'Times up! Great work. Take 5-10 and come back 💪'
        });
      }
    }, 250);
  }

  setRunningUI(isRunning) {
    if (this.elements.startStop) {
      this.elements.startStop.textContent = isRunning ? 'Stop' : 'Start';
      this.elements.startStop.disabled = isRunning;
      this.elements.startStop.style.opacity = isRunning ? '0.6' : '1';
    }
  }

  async prevTrack() {
    const { isRunning, track } = await StorageManager.getTimerState();
    const prev = await SpotifyManager.getPrevTrack(track);
    if (!prev) return;
    
    await StorageManager.setTimerState({ track: prev });
    if (isRunning) {
      await SpotifyManager.playTrack(prev);
    }
  }

  async nextTrack() {
    const { isRunning, track } = await StorageManager.getTimerState();
    const next = await SpotifyManager.getNextTrack(track);
    if (!next) return;
    
    await StorageManager.setTimerState({ track: next });
    if (isRunning) {
      await SpotifyManager.playTrack(next);
    }
  }

  async restoreState() {
    const state = await StorageManager.getTimerState();
    const { startTime, durationMs, isRunning, track } = state;

    if (isRunning && startTime) {
      const elapsed = Date.now() - startTime;
      const left = Math.max(0, durationMs - elapsed);

      if (this.elements.time) {
        this.elements.time.textContent = this.formatTime(left);
      }

      if (left <= 0) {
        await this.stopTimer(true);
      } else {
        this.setRunningUI(true);
        if (track) {
          await SpotifyManager.playTrack(track);
        }
        this.tick(left, startTime, durationMs);
      }
    } else {
      if (this.elements.time) {
        this.elements.time.textContent = this.formatTime(this.DURATION_MINUTES * 60 * 1000);
      }
      this.setRunningUI(false);
    }
  }

  async initDurationSelector() {
    if (!this.elements.durationPills) return;
    
    const { durationMs } = await StorageManager.getTimerState();
    const minutes = Math.round((durationMs / 60000));
    this.DURATION_MINUTES = Math.max(5, Math.min(30, minutes - (minutes % 5) || minutes));
    
    const durations = [5, 10, 15, 20, 25, 30];
    this.elements.durationPills.innerHTML = '';
    
    durations.forEach(min => {
      const btn = document.createElement('button');
      btn.className = `duration-btn ${min === this.DURATION_MINUTES ? 'active' : ''}`;
      btn.textContent = `${min}m`;
      btn.addEventListener('click', async () => {
        this.DURATION_MINUTES = min;
        this.elements.durationPills.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const { isRunning, startTime } = await StorageManager.getTimerState();
        const durationMsNew = this.DURATION_MINUTES * 60 * 1000;
        await StorageManager.setTimerState({ durationMs: durationMsNew });
        
        if (isRunning && startTime) {
          await this.startTimer();
        } else {
          if (this.elements.time) {
            this.elements.time.textContent = this.formatTime(this.DURATION_MINUTES * 60 * 1000);
          }
        }
      });
      this.elements.durationPills.appendChild(btn);
    });
  }

  formatTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  }

  // Auto-start timer when task is added
  async autoStartOnTaskAdd() {
    const { isRunning } = await StorageManager.getTimerState();
    if (!isRunning) {
      await this.startTimer();
    }
  }
}
