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
      playMusic: document.getElementById('play-music'),
      prev: document.getElementById('prev'),
      next: document.getElementById('next'),
      durationInput: document.getElementById('duration-input'),
      durationUp: document.getElementById('duration-up'),
      durationDown: document.getElementById('duration-down')
    };
    
    this.isMusicPlaying = false;
    this.initEventListeners();
    this.initDurationControls();
    this.restoreState();
  }

  initEventListeners() {
    if (this.elements.startStop) {
      this.elements.startStop.addEventListener('click', () => this.toggleTimer());
    }
    
    if (this.elements.playMusic) {
      this.elements.playMusic.addEventListener('click', () => this.toggleMusic());
    }
    
    if (this.elements.prev) {
      this.elements.prev.addEventListener('click', () => this.prevTrack());
    }
    
    if (this.elements.next) {
      this.elements.next.addEventListener('click', () => this.nextTrack());
    }

    if (this.elements.durationUp) {
      this.elements.durationUp.addEventListener('click', () => this.incrementDuration());
    }

    if (this.elements.durationDown) {
      this.elements.durationDown.addEventListener('click', () => this.decrementDuration());
    }

    if (this.elements.durationInput) {
      this.elements.durationInput.addEventListener('change', () => this.updateDurationFromInput());
      this.elements.durationInput.addEventListener('blur', () => this.updateDurationFromInput());
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

  async toggleMusic() {
    if (this.isMusicPlaying) {
      await this.stopMusic();
    } else {
      await this.startMusic();
    }
  }

  async startMusic() {
    const track = await SpotifyManager.pickRandomTrack();
    if (track) {
      await SpotifyManager.playTrack(track);
      this.isMusicPlaying = true;
      this.updateMusicButton();
    }
  }

  async stopMusic() {
    await SpotifyManager.stopPlayback();
    this.isMusicPlaying = false;
    this.updateMusicButton();
  }

  updateMusicButton() {
    if (this.elements.playMusic) {
      if (this.isMusicPlaying) {
        this.elements.playMusic.textContent = '⏸️';
        this.elements.playMusic.classList.add('playing');
      } else {
        this.elements.playMusic.textContent = '🎵';
        this.elements.playMusic.classList.remove('playing');
      }
    }
  }

  async startTimer() {
    // Don't auto-start music - user must click music button
    const durationMs = this.DURATION_MINUTES * 60 * 1000;
    const startTime = Date.now();
    await StorageManager.setTimerState({ 
      startTime, 
      durationMs, 
      isRunning: true, 
      track: null 
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

    // Don't auto-stop music - let user control it separately
    // await SpotifyManager.stopPlayback();

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
    if (!this.isMusicPlaying) return;
    
    const prev = await SpotifyManager.getPrevTrack();
    if (!prev) return;
    
    await SpotifyManager.playTrack(prev);
  }

  async nextTrack() {
    if (!this.isMusicPlaying) return;
    
    const next = await SpotifyManager.getNextTrack();
    if (!next) return;
    
    await SpotifyManager.playTrack(next);
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
        // Don't auto-start music on restore
        this.tick(left, startTime, durationMs);
      }
    } else {
      if (this.elements.time) {
        this.elements.time.textContent = this.formatTime(this.DURATION_MINUTES * 60 * 1000);
      }
      this.setRunningUI(false);
    }
  }

  async initDurationControls() {
    if (!this.elements.durationInput) return;
    
    const { durationMs } = await StorageManager.getTimerState();
    const minutes = Math.round((durationMs / 60000));
    this.DURATION_MINUTES = Math.max(5, Math.min(60, minutes));
    
    this.elements.durationInput.value = this.DURATION_MINUTES;
  }

  async incrementDuration() {
    this.DURATION_MINUTES = Math.min(60, this.DURATION_MINUTES + 5);
    this.elements.durationInput.value = this.DURATION_MINUTES;
    await this.updateDuration();
  }

  async decrementDuration() {
    this.DURATION_MINUTES = Math.max(5, this.DURATION_MINUTES - 5);
    this.elements.durationInput.value = this.DURATION_MINUTES;
    await this.updateDuration();
  }

  async updateDurationFromInput() {
    const value = parseInt(this.elements.durationInput.value);
    if (value >= 5 && value <= 60) {
      this.DURATION_MINUTES = value;
      await this.updateDuration();
    } else {
      // Reset to current value if invalid
      this.elements.durationInput.value = this.DURATION_MINUTES;
    }
  }

  async updateDuration() {
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
  }

  formatTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  }

  // Auto-start timer when task is added (DISABLED - user must manually start)
  async autoStartOnTaskAdd() {
    // Auto-start disabled - user must manually start timer
    console.log('Auto-start disabled - user must manually start timer');
  }
}
