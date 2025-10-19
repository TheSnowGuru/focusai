// Main coordinator for FocusAI extension
import { AuthManager } from './js/auth.js';
import { TimerManager } from './js/timer.js';
import { TabManager } from './js/tabs.js';
import { UIManager } from './js/ui.js';
import { SpotifyManager } from './js/spotify.js';
import { TaskManager } from './js/tasks.js';
import { DoneTabManager } from './js/done-tab.js';

// Global managers
let timerManager;
let tabManager;
let taskManager;
let doneTabManager;

// Initialize the application
async function init() {
  try {
    console.log('🚀 Initializing FocusAI...');
    
    // Load tracks first
    await SpotifyManager.loadTracks();
    
    // Initialize managers
    timerManager = new TimerManager();
    tabManager = new TabManager();
    taskManager = new TaskManager();
    doneTabManager = new DoneTabManager();
    
    // Make managers globally accessible for cross-module communication
    window.timerManager = timerManager;
    window.tabManager = tabManager;
    window.taskManager = taskManager;
    window.doneTabManager = doneTabManager;
    window.UIManager = UIManager;
    
    // Initialize all modules
    timerManager.init();
    tabManager.init();
    doneTabManager.init();
    await taskManager.init(); // Wait for tasks to load
    UIManager.init();
    UIManager.initAuthButton();
    UIManager.initAuthHandlers();
    
    // Check authentication and restore state
    await restoreAppState();
    
    console.log('✅ FocusAI initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize FocusAI:', error);
  }
}

// Restore application state
async function restoreAppState() {
  try {
    // Check for existing authentication
    const isAuthed = await AuthManager.checkExistingSession();
    UIManager.toggleViews(isAuthed);
    
    if (isAuthed) {
      // Restore timer state
      await timerManager.restoreState();
      
      // Restore tab state
      await tabManager.loadActiveTab();
    }
    
  } catch (error) {
    console.error('Failed to restore app state:', error);
  }
}

// Handle window beforeunload to ensure playback continues
window.addEventListener('beforeunload', () => {
  (async () => {
    try {
      const { isRunning, track } = await chrome.storage.local.get({ isRunning: false, track: null });
      if (isRunning && track) {
        chrome.runtime.sendMessage({ type: 'PLAY_SPOTIFY', track });
      }
    } catch (error) {
      console.error('Error handling beforeunload:', error);
    }
  })();
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);