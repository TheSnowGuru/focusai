// Main coordinator for FocusAI extension
import { TimerManager } from './js/timer.js';
import { TabManager } from './js/tabs.js';
import { UIManager } from './js/ui.js';
import { TaskManager } from './js/tasks.js';
import { DoneTabManager } from './js/done-tab.js';
import { GamificationManager } from './js/gamification.js';
import { SettingsManager } from './js/settings.js';

// Global managers
let timerManager;
let tabManager;
let taskManager;
let doneTabManager;
let gamificationManager;
let settingsManager;

// Initialize the application
async function init() {
  try {
    console.log('🚀 Initializing FocusAI...');
    
    // Initialize managers
    timerManager = new TimerManager();
    tabManager = new TabManager();
    taskManager = new TaskManager();
    doneTabManager = new DoneTabManager();
    gamificationManager = new GamificationManager();
    settingsManager = new SettingsManager();
    
    // Make managers globally accessible for cross-module communication
    window.timerManager = timerManager;
    window.tabManager = tabManager;
    window.taskManager = taskManager;
    window.doneTabManager = doneTabManager;
    window.gamificationManager = gamificationManager;
    window.settingsManager = settingsManager;
    window.UIManager = UIManager;
    
    // Initialize all modules
    timerManager.init();
    tabManager.init();
    doneTabManager.init();
    await taskManager.init(); // Wait for tasks to load
    await gamificationManager.init(); // Initialize gamification
    await settingsManager.init(); // Initialize settings
    UIManager.init();
    
    // Restore timer state
    await timerManager.restoreState();
    
    // Restore tab state
    await tabManager.loadActiveTab();
    
    console.log('✅ FocusAI initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize FocusAI:', error);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);