// Timer management
import { StorageManager } from './storage.js';

export class TimerManager {
  constructor() {
    this.DURATION_MINUTES = 25; // Default to 25 minutes
    this.ticking = null;
    this.elements = {};
  }

  init() {
    this.elements = {
      time: document.getElementById('time'),
      startStop: document.getElementById('start-stop'),
      restart: document.getElementById('restart'),
      durationInput: document.getElementById('duration-input'),
      durationUp: document.getElementById('duration-up'),
      durationDown: document.getElementById('duration-down')
    };
    
    this.isPaused = false;
    this.pausedTimeRemaining = null;
    this.initEventListeners();
    this.initDurationControls();
    this.restoreState();
  }

  initEventListeners() {
    if (this.elements.startStop) {
      this.elements.startStop.addEventListener('click', () => this.toggleTimer());
    }
    
    if (this.elements.restart) {
      this.elements.restart.addEventListener('click', () => this.restartTimer());
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
      await this.pauseTimer();
    } else {
      await this.resumeTimer();
    }
  }

  async pauseTimer() {
    // Pause the timer without resetting
    clearInterval(this.ticking);
    this.ticking = null;
    
    // Calculate remaining time
    const remainingTime = await this.getRemainingTime();
    console.log('⏸️ Pausing timer. Remaining time:', remainingTime, 'ms');
    
    // Store paused state
    this.isPaused = true;
    this.pausedTimeRemaining = remainingTime;
    
    await StorageManager.setTimerState({ 
      isRunning: false, 
      isPaused: true,
      pausedTimeRemaining: remainingTime
    });
    
    this.setRunningUI(false);
    console.log('⏸️ Timer paused at', remainingTime, 'ms remaining');
  }

  async resumeTimer() {
    // Resume from paused state or start fresh
    const state = await StorageManager.getTimerState();
    
    if (state.isPaused && state.pausedTimeRemaining) {
      // Resume from where we left off
      console.log('▶️ Resuming timer from', state.pausedTimeRemaining, 'ms');
      const startTime = Date.now();
      const durationMs = state.pausedTimeRemaining;
      
      await StorageManager.setTimerState({ 
        startTime, 
        durationMs, 
        isRunning: true,
        isPaused: false,
        pausedTimeRemaining: null
      });

      chrome.alarms.clear('focus-end', () => {
        chrome.alarms.create('focus-end', { when: startTime + durationMs });
      });

      this.setRunningUI(true);
      this.tick(durationMs, startTime, durationMs);
    } else {
      // Start fresh
      await this.startTimer();
    }
  }

  async getRemainingTime() {
    const state = await StorageManager.getTimerState();
    if (!state.isRunning || !state.startTime) return null;
    
    const elapsed = Date.now() - state.startTime;
    const remaining = state.durationMs - elapsed;
    return Math.max(0, remaining);
  }

  async restartTimer() {
    // Stop current timer and start fresh
    await this.stopTimer(true);
    await this.startTimer();
    console.log('🔄 Timer restarted');
  }

  async startTimer() {
    const durationMs = this.DURATION_MINUTES * 60 * 1000;
    const startTime = Date.now();
    await StorageManager.setTimerState({ 
      startTime, 
      durationMs, 
      isRunning: true
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
      startTime: null
    });
    chrome.alarms.clear('focus-end');

    this.setRunningUI(false);
    if (this.elements.time) {
      this.elements.time.textContent = this.formatTime(this.DURATION_MINUTES * 60 * 1000);
    }

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

        // Play completion sound
        this.playCompletionSound();

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
      this.elements.startStop.textContent = isRunning ? 'Pause' : 'Start';
      // Don't disable the button - user needs to be able to click it to pause
      this.elements.startStop.disabled = false;
      this.elements.startStop.style.opacity = '1';
      
      // Add visual feedback for running state
      if (isRunning) {
        this.elements.startStop.classList.add('running');
      } else {
        this.elements.startStop.classList.remove('running');
      }
    }
  }


  async restoreState() {
    const state = await StorageManager.getTimerState();
    const { startTime, durationMs, isRunning } = state;

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

  // Play sound when timer completes
  playCompletionSound() {
    try {
      const audio = new Audio('contador-timer.mp3');
      audio.volume = 0.8;
      audio.play().catch(e => {
        console.log('❌ Audio play failed:', e);
      });
      console.log('🔔 Playing completion sound');
    } catch (error) {
      console.error('❌ Failed to play completion sound:', error);
    }
  }

}
