// Task Manager for FocusAI
export class TaskManager {
  constructor() {
    this.allTasks = {}; // Store tasks by tab ID
    this.currentTabId = 'today'; // Default tab
    this.draggedElement = null;
    this.elements = {
      taskList: document.getElementById('task-list'),
      addTaskInput: document.getElementById('add-task-input'),
      addTaskBtn: document.getElementById('add-task-btn'),
      confetti: document.getElementById('confetti'),
      tabBar: document.getElementById('tab-bar')
    };
  }

  // Initialize the task manager
  async init() {
    await this.loadTasks();
    this.attachEventListeners();
    this.render();
  }

  // Attach event listeners
  attachEventListeners() {
    // Add task on button click
    this.elements.addTaskBtn.addEventListener('click', () => this.addTask());

    // Add task on Enter key
    this.elements.addTaskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addTask();
      }
    });

    // Listen for storage changes (tab switches)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.activeTab) {
        const newTabId = changes.activeTab.newValue;
        if (newTabId && newTabId !== this.currentTabId) {
          this.switchTab(newTabId);
        }
      }
    });

    // Enable drag-and-drop between tabs
    this.setupTabDragDrop();
  }

  // Setup drag-and-drop for tabs
  setupTabDragDrop() {
    if (!this.elements.tabBar) return;

    // Use event delegation for dynamically created tabs
    this.elements.tabBar.addEventListener('dragover', (e) => {
      const tab = e.target.closest('.tab');
      if (tab && !tab.classList.contains('add-tab') && this.draggedElement) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        // Highlight the tab being dragged over
        this.elements.tabBar.querySelectorAll('.tab').forEach(t => {
          t.classList.remove('drag-over');
        });
        tab.classList.add('drag-over');
      }
    });

    this.elements.tabBar.addEventListener('dragleave', (e) => {
      const tab = e.target.closest('.tab');
      if (tab) {
        tab.classList.remove('drag-over');
      }
    });

    this.elements.tabBar.addEventListener('drop', async (e) => {
      const tab = e.target.closest('.tab');
      if (tab && !tab.classList.contains('add-tab') && this.draggedElement) {
        e.preventDefault();
        
        const targetTabId = tab.dataset.tab;
        const taskId = this.draggedElement.getAttribute('data-task-id');
        
        // Remove highlight
        tab.classList.remove('drag-over');
        
        // Move task to target tab
        if (targetTabId && targetTabId !== this.currentTabId) {
          await this.moveTaskToTab(taskId, targetTabId);
        }
      }
    });
  }

  // Move a task from current tab to another tab
  async moveTaskToTab(taskId, targetTabId) {
    const currentTasks = this.getCurrentTasks();
    const taskIndex = currentTasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return;
    
    // Remove task from current tab
    const [task] = currentTasks.splice(taskIndex, 1);
    this.setCurrentTasks(currentTasks);
    
    // Add task to target tab
    if (!this.allTasks[targetTabId]) {
      this.allTasks[targetTabId] = [];
    }
    this.allTasks[targetTabId].push(task);
    
    // Save and re-render
    await this.saveTasks();
    this.render();
    
    // Show feedback
    this.showMoveNotification(targetTabId);
  }

  // Show notification when task is moved
  showMoveNotification(targetTabId) {
    const targetTab = this.elements.tabBar?.querySelector(`[data-tab="${targetTabId}"]`);
    if (targetTab) {
      const originalText = targetTab.textContent;
      targetTab.style.background = 'var(--accent)';
      targetTab.style.color = 'white';
      
      setTimeout(() => {
        targetTab.style.background = '';
        targetTab.style.color = '';
      }, 500);
    }
  }

  // Switch to a different tab
  switchTab(tabId) {
    this.currentTabId = tabId;
    
    // If switching to done tab, let DoneTabManager handle it
    if (tabId === 'done' && window.doneTabManager) {
      window.doneTabManager.showDoneTasks();
      return;
    }
    
    // Ensure the new tab has an array initialized
    if (!this.allTasks[this.currentTabId]) {
      this.allTasks[this.currentTabId] = [];
    }
    this.render();
  }

  // Get current tab's tasks
  getCurrentTasks() {
    if (!this.allTasks[this.currentTabId]) {
      this.allTasks[this.currentTabId] = [];
    }
    return this.allTasks[this.currentTabId];
  }

  // Set current tab's tasks
  setCurrentTasks(tasks) {
    this.allTasks[this.currentTabId] = tasks;
  }

  // Add a new task
  async addTask() {
    const input = this.elements.addTaskInput;
    const text = input.value.trim();
    
    if (!text) return;

    const task = {
      id: Date.now().toString(),
      text: text,
      completed: false,
      createdAt: new Date().toISOString()
    };

    const tasks = this.getCurrentTasks();
    tasks.push(task);
    this.setCurrentTasks(tasks);
    await this.saveTasks();
    this.render();
    
    // Update gamification progress if task was added to Today tab
    if (this.currentTabId === 'today' && window.gamificationManager) {
      window.gamificationManager.updateDailyProgress();
    }
    
    // Clear input and focus
    input.value = '';
    input.focus();
  }

  // Edit a task inline
  async editTask(taskId, newText) {
    const tasks = this.getCurrentTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task && newText.trim()) {
      task.text = newText.trim();
      await this.saveTasks();
      this.render();
    }
  }

  // Complete and delete task with explosion animation
  async completeTask(taskId) {
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    // Get the task before removing it
    const tasks = this.getCurrentTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Get the position for the explosion effect
    const rect = taskElement.getBoundingClientRect();
    const listRect = this.elements.taskList.getBoundingClientRect();
    
    // Create explosion effect
    this.createExplosion(rect.left - listRect.left + rect.width / 2, rect.top - listRect.top + rect.height / 2);

    // Play explosion sound
    this.playExplosionSound();

    // Animate task out
    taskElement.style.transition = 'all 0.3s ease-out';
    taskElement.style.transform = 'scale(0) rotate(10deg)';
    taskElement.style.opacity = '0';

    // Wait for animation then remove task and add to done
    setTimeout(async () => {
      // Remove from current tab
      this.setCurrentTasks(tasks.filter(t => t.id !== taskId));
      await this.saveTasks();
      
      // Add to done tab
      if (window.doneTabManager) {
        console.log('📋 Adding task to done tab:', task.text);
        await window.doneTabManager.addToDone(task);
      } else {
        console.log('❌ DoneTabManager not available');
      }
      
      this.render();
    }, 300);
  }

  // Create explosion confetti effect
  createExplosion(x, y) {
    const emojis = ['🎉', '✨', '💫', '⭐', '🌟', '💥', '🎊'];
    const count = 12;

    for (let i = 0; i < count; i++) {
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const particle = document.createElement('div');
      particle.className = 'confetti';
      particle.textContent = emoji;
      
      // Random position offset
      const angle = (Math.PI * 2 * i) / count;
      const distance = 60 + Math.random() * 40;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const rotation = Math.random() * 360 - 180;
      
      particle.style.cssText = `
        left: ${x}px;
        top: ${y}px;
        --dx: ${dx}px;
        --dy: ${dy}px;
        --rot: ${rotation}deg;
        --jx: ${Math.random() * 10 - 5}px;
        --jy: ${Math.random() * 10 - 5}px;
        --jx2: ${Math.random() * 10 - 5}px;
        --jy2: ${Math.random() * 10 - 5}px;
      `;
      
      this.elements.confetti.appendChild(particle);
      
      // Remove particle after animation
      setTimeout(() => particle.remove(), 1200);
    }
  }

  // Play explosion sound when task is completed
  playExplosionSound() {
    try {
      const audio = new Audio(chrome.runtime.getURL('mp3/explosion-01.mp3'));
      audio.volume = 0.7;
      audio.play().catch(e => {
        console.log('❌ Explosion sound play failed:', e);
      });
      console.log('💥 Playing explosion sound');
    } catch (error) {
      console.error('❌ Failed to play explosion sound:', error);
    }
  }

  // Enable inline editing for a task
  enableInlineEdit(taskElement, taskId) {
    const taskContentEl = taskElement.querySelector('.task-content');
    const taskTitleEl = taskContentEl.querySelector('.task-title');
    const currentText = taskTitleEl.textContent;

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'task-edit-input';
    input.style.cssText = `
      width: 100%;
      border: 1px solid var(--primary);
      background: var(--bg);
      color: var(--text);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      outline: none;
    `;

    // Replace title with input
    taskContentEl.replaceChild(input, taskTitleEl);
    input.focus();
    input.select();

    // Save on Enter or blur
    const saveEdit = async () => {
      const newText = input.value.trim();
      if (newText && newText !== currentText) {
        await this.editTask(taskId, newText);
      } else {
        this.render();
      }
    };

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveEdit();
      }
    });

    input.addEventListener('blur', saveEdit);

    // Cancel on Escape
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.render();
      }
    });
  }

  // Update task section title based on current tab
  updateTaskSectionTitle() {
    const titleElement = document.getElementById('task-section-title');
    if (!titleElement) return;

    // Set title based on tab ID
    switch (this.currentTabId) {
      case 'today':
        titleElement.textContent = 'My Tasks';
        break;
      case 'thisweek':
        titleElement.textContent = 'My Tasks';
        break;
      case 'thisyear':
        titleElement.textContent = 'My Goals🎯';
        break;
      case 'done':
        titleElement.textContent = 'All Done';
        break;
      default:
        titleElement.textContent = 'My Tasks';
        break;
    }
  }

  // Render tasks to the UI
  render() {
    if (!this.elements.taskList) return;

    // Update task section title based on current tab
    this.updateTaskSectionTitle();

    this.elements.taskList.innerHTML = '';

    const tasks = this.getCurrentTasks();

    if (tasks.length === 0) {
      const emptyState = document.createElement('li');
      emptyState.style.cssText = 'text-align: center; padding: 20px; color: var(--muted); border: none;';
      emptyState.textContent = 'No tasks yet. Add one above! 🎯';
      this.elements.taskList.appendChild(emptyState);
      
      // Update motivation
      this.updateMotivation();
      return;
    }

    tasks.forEach((task, index) => {
      const li = document.createElement('li');
      li.setAttribute('data-task-id', task.id);
      li.draggable = true;
      
      li.innerHTML = `
        <div class="task-content">
          <p class="task-title">${this.escapeHtml(task.text)}</p>
        </div>
        <div class="task-actions">
          <button class="ai-btn" aria-label="Open in ChatGPT" title="Open in ChatGPT to finish this task ✨">AI✨</button>
          <button class="edit-btn" aria-label="Edit task" title="Edit task">✏️</button>
          <button class="complete-btn" aria-label="Complete task" title="Complete and delete">✓</button>
        </div>
      `;

      // AI button handler
      const aiBtn = li.querySelector('.ai-btn');
      aiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openInChatGPT(task.text);
      });

      // Edit button handler
      const editBtn = li.querySelector('.edit-btn');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.enableInlineEdit(li, task.id);
      });

      // Complete button handler
      const completeBtn = li.querySelector('.complete-btn');
      completeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.completeTask(task.id);
      });

      // Drag and drop handlers
      li.addEventListener('dragstart', (e) => {
        this.draggedElement = li;
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        this.draggedElement = null;
      });

      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (this.draggedElement && this.draggedElement !== li) {
          const rect = li.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          
          if (e.clientY < midpoint) {
            li.parentNode.insertBefore(this.draggedElement, li);
          } else {
            li.parentNode.insertBefore(this.draggedElement, li.nextSibling);
          }
        }
      });

      li.addEventListener('drop', async (e) => {
        e.preventDefault();
        await this.updateTaskOrder();
      });

      this.elements.taskList.appendChild(li);
    });
    
    // Update motivation after rendering tasks
    this.updateMotivation();
  }

  // Update motivational message
  updateMotivation() {
    if (typeof window !== 'undefined' && window.UIManager) {
      window.UIManager.updateMotivation();
    }
  }

  // Update task order after drag and drop
  async updateTaskOrder() {
    const taskElements = Array.from(this.elements.taskList.querySelectorAll('[data-task-id]'));
    const newOrder = taskElements.map(el => el.getAttribute('data-task-id'));
    
    // Reorder tasks array for current tab
    const tasks = this.getCurrentTasks();
    const reorderedTasks = newOrder.map(id => tasks.find(t => t.id === id)).filter(Boolean);
    this.setCurrentTasks(reorderedTasks);
    await this.saveTasks();
  }

  // Save tasks to storage (all tabs)
  async saveTasks() {
    try {
      await chrome.storage.local.set({ allTasks: this.allTasks });
    } catch (error) {
      console.error('Failed to save tasks:', error);
    }
  }

  // Load tasks from storage (all tabs)
  async loadTasks() {
    try {
      const result = await chrome.storage.local.get(['allTasks', 'activeTab']);
      this.allTasks = result.allTasks || {};
      
      // Set current tab from storage or default to 'today'
      if (result.activeTab) {
        this.currentTabId = result.activeTab;
      }
      
      // Ensure current tab has an array
      if (!this.allTasks[this.currentTabId]) {
        this.allTasks[this.currentTabId] = [];
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
      this.allTasks = {};
      this.allTasks[this.currentTabId] = [];
    }
  }

  // Escape HTML to prevent XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Get all tasks for current tab (for external access)
  getTasks() {
    return this.getCurrentTasks();
  }

  // Get all tasks for all tabs
  getAllTasks() {
    return this.allTasks;
  }

  // Clear all tasks for current tab
  async clearAllTasks() {
    this.setCurrentTasks([]);
    await this.saveTasks();
    this.render();
  }

  // Clear all tasks for all tabs
  async clearAllTabsTasks() {
    this.allTasks = {};
    this.allTasks[this.currentTabId] = [];
    await this.saveTasks();
    this.render();
  }

  // Open task in AI engine with enhanced prompt
  async openInChatGPT(taskText) {
    if (!taskText || taskText.trim().length === 0) {
      console.log('❌ No task text to send to AI engine');
      return;
    }

    // Get current AI engine from settings
    const aiEngine = window.settingsManager ? window.settingsManager.getCurrentEngine() : 'chatgpt';
    const aiUrls = window.settingsManager ? window.settingsManager.getAIEngineUrls() : { chatgpt: 'https://chatgpt.com/' };
    
    // Enhancement prompt template
    const enhancementPrompt = `You are an advanced AI assistant improving and completing tasks.

1. Rewrite and enhance the user's task so it's clear, specific, and ready to execute.
2. If needed, make assumptions that speed up completion and explain them briefly.
3. Complete the task directly.
4. Always return a clickable URL for the user to complete or access results faster.

----- USER TASK BELOW -----
«««
${taskText}
»»»`;

    // Truncate if too long (keep under 3000 chars for URL safety)
    const maxLength = 3000;
    const finalPrompt = enhancementPrompt.length > maxLength 
      ? enhancementPrompt.substring(0, maxLength - 50) + '\n\n[Task truncated for URL length]'
      : enhancementPrompt;

    try {
      // Store the prompt for the content script to pick up
      await chrome.storage.local.set({ 
        pendingPrompt: finalPrompt,
        aiEngine: aiEngine
      });
      
      // Open selected AI engine in new tab
      const aiUrl = aiUrls[aiEngine] || aiUrls.chatgpt;
      const newTab = window.open(aiUrl, '_blank', 'noopener,noreferrer');
      
      if (newTab) {
        // Wait a moment for the tab to load, then send message to content script
        setTimeout(async () => {
          try {
            // Get the tab ID and send message to content script
            const urlPattern = aiEngine === 'chatgpt' ? 'https://chatgpt.com/*' :
                             aiEngine === 'gemini' ? 'https://gemini.google.com/*' :
                             'https://claude.ai/*';
            
            const tabs = await chrome.tabs.query({ url: urlPattern });
            if (tabs.length > 0) {
              const tab = tabs[tabs.length - 1]; // Get the most recent tab
              await chrome.tabs.sendMessage(tab.id, {
                type: 'INJECT_PROMPT',
                prompt: finalPrompt,
                aiEngine: aiEngine
              });
              console.log(`✅ Prompt sent to ${aiEngine} content script`);
            }
          } catch (error) {
            console.log(`⚠️ Could not send message to ${aiEngine} content script, prompt stored for auto-injection`);
          }
        }, 2000);
        
        this.showNotification(`Opening ${aiEngine.toUpperCase()} with enhanced prompt...`, 'info');
        console.log(`🚀 Opening ${aiEngine} with enhanced task:`, taskText);
        
        // Track analytics event
        this.trackAIClick(taskText);
      } else {
        throw new Error('Failed to open new tab');
      }
      
    } catch (error) {
      console.error(`❌ Failed to open ${aiEngine}:`, error);
      this.showNotification(`Failed to open ${aiEngine.toUpperCase()}. Please try again.`, 'error');
    }
  }

  // Track AI button click for analytics (optional)
  trackAIClick(taskText) {
    try {
      // You can add analytics tracking here
      const eventData = {
        taskLength: taskText.length,
        hasContext: taskText.length > 50,
        timestamp: new Date().toISOString()
      };
      
      console.log('📊 AI Button Click:', eventData);
      
      // Example: Send to analytics service
      // analytics.track('open_in_chatgpt_ai_star', eventData);
    } catch (error) {
      console.log('Analytics tracking failed:', error);
    }
  }

  // Fallback: Copy URL to clipboard if window.open fails
  async fallbackCopyToClipboard(url) {
    try {
      await navigator.clipboard.writeText(url);
      console.log('📋 ChatGPT URL copied to clipboard');
      
      // Show user notification
      this.showNotification('ChatGPT URL copied to clipboard!', 'info');
    } catch (error) {
      console.error('❌ Failed to copy to clipboard:', error);
      this.showNotification('Failed to open ChatGPT. Please try again.', 'error');
    }
  }

  // Show notification to user
  showNotification(message, type = 'info') {
    // Create a simple notification
    const notification = document.createElement('div');
    
    // Set background color based on type
    let backgroundColor = '#007bff'; // default info
    if (type === 'error') backgroundColor = '#dc3545';
    if (type === 'success') backgroundColor = '#28a745';
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${backgroundColor};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease-out;
      max-width: 300px;
      word-wrap: break-word;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 4 seconds for success messages (longer for instructions)
    const duration = type === 'success' ? 4000 : 3000;
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
}

