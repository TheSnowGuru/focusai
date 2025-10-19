// Done Tab Manager for FocusAI
export class DoneTabManager {
  constructor() {
    this.tabId = 'done';
    this.elements = {
      taskList: document.getElementById('task-list'),
      tabBar: document.getElementById('tab-bar')
    };
  }

  // Initialize the done tab manager
  init() {
    this.attachEventListeners();
  }

  // Attach event listeners
  attachEventListeners() {
    // Listen for tab switches
    if (this.elements.tabBar) {
      this.elements.tabBar.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (tab && tab.dataset.tab === this.tabId) {
          // Update active tab in storage
          chrome.storage.local.set({ activeTab: this.tabId });
          this.showDoneTasks();
        }
      });
    }
  }

  // Show completed tasks
  async showDoneTasks() {
    if (!this.elements.taskList) return;

    console.log('📋 Showing done tasks...');

    // Get all completed tasks from storage
    const result = await chrome.storage.local.get('completedTasks');
    const completedTasks = result.completedTasks || [];

    console.log('📋 Found completed tasks:', completedTasks.length);

    this.elements.taskList.innerHTML = '';

    if (completedTasks.length === 0) {
      const emptyState = document.createElement('li');
      emptyState.style.cssText = 'text-align: center; padding: 20px; color: var(--muted); border: none;';
      emptyState.textContent = 'No completed tasks yet. Complete some tasks to see them here! 🎉';
      this.elements.taskList.appendChild(emptyState);
      return;
    }

    // Add clear all button
    const clearAllBtn = document.createElement('li');
    clearAllBtn.style.cssText = 'text-align: center; padding: 12px; border-bottom: 1px solid var(--border);';
    clearAllBtn.innerHTML = `
      <button id="clear-all-done" class="clear-all-btn">
        🗑️ Clear All Done Tasks
      </button>
    `;
    this.elements.taskList.appendChild(clearAllBtn);

    // Add event listener for clear all button
    const clearBtn = clearAllBtn.querySelector('#clear-all-done');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAllDoneTasks());
    }

    // Render completed tasks
    completedTasks.forEach((task, index) => {
      const li = document.createElement('li');
      li.className = 'done-task-item';
      li.style.cssText = 'opacity: 0.7; text-decoration: line-through;';
      
      li.innerHTML = `
        <div class="task-content">
          <p class="task-title">${this.escapeHtml(task.text)}</p>
          <p class="task-details">Completed: ${this.formatDate(task.completedAt)}</p>
        </div>
        <div class="task-actions">
          <button class="restore-btn" aria-label="Restore to Today" title="Restore to Today">⬅️</button>
          <button class="delete-btn" aria-label="Delete permanently" title="Delete permanently">🗑️</button>
        </div>
      `;

      // Restore button handler
      const restoreBtn = li.querySelector('.restore-btn');
      restoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.restoreTaskToToday(task);
      });

      // Delete button handler
      const deleteBtn = li.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteDoneTask(task.id);
      });

      this.elements.taskList.appendChild(li);
    });
  }

  // Add a task to the done list
  async addToDone(task) {
    console.log('📋 Adding task to done list:', task.text);
    
    const result = await chrome.storage.local.get('completedTasks');
    const completedTasks = result.completedTasks || [];
    
    // Add completion timestamp
    const doneTask = {
      ...task,
      completedAt: new Date().toISOString()
    };
    
    completedTasks.unshift(doneTask); // Add to beginning
    
    // Keep only last 100 completed tasks to prevent storage bloat
    if (completedTasks.length > 100) {
      completedTasks.splice(100);
    }
    
    await chrome.storage.local.set({ completedTasks });
    console.log('📋 Task added to done list, total completed:', completedTasks.length);
    
    // If we're currently viewing the done tab, refresh the display
    const activeTab = this.elements.tabBar?.querySelector('.tab.active');
    if (activeTab && activeTab.dataset.tab === this.tabId) {
      this.showDoneTasks();
    }
  }

  // Restore a task back to Today tab
  async restoreTaskToToday(task) {
    console.log('⬅️ Restoring task to Today:', task.text);
    
    // Remove from completed tasks
    const result = await chrome.storage.local.get('completedTasks');
    const completedTasks = result.completedTasks || [];
    const updatedCompletedTasks = completedTasks.filter(t => t.id !== task.id);
    await chrome.storage.local.set({ completedTasks: updatedCompletedTasks });
    
    // Add to Today tab
    if (window.taskManager) {
      // Create a new task object without completedAt
      const restoredTask = {
        id: task.id,
        text: task.text,
        completed: false,
        createdAt: task.createdAt || new Date().toISOString()
      };
      
      // Get today's tasks
      const todayTasks = window.taskManager.getAllTasks()['today'] || [];
      todayTasks.unshift(restoredTask); // Add to beginning
      
      // Update today's tasks
      window.taskManager.getAllTasks()['today'] = todayTasks;
      await window.taskManager.saveTasks();
      
      console.log('⬅️ Task restored to Today tab');
      
      // Switch to Today tab to show the restored task
      chrome.storage.local.set({ activeTab: 'today' });
    }
    
    // Refresh the done tasks display
    this.showDoneTasks();
  }

  // Delete a specific done task
  async deleteDoneTask(taskId) {
    const result = await chrome.storage.local.get('completedTasks');
    const completedTasks = result.completedTasks || [];
    
    const updatedTasks = completedTasks.filter(t => t.id !== taskId);
    await chrome.storage.local.set({ completedTasks: updatedTasks });
    
    // Refresh the display
    this.showDoneTasks();
  }

  // Clear all done tasks
  async clearAllDoneTasks() {
    if (!confirm('Are you sure you want to delete all completed tasks? This action cannot be undone.')) {
      return;
    }

    // Play explosion sound for clearing all tasks
    this.playExplosionSound();

    await chrome.storage.local.set({ completedTasks: [] });
    
    // Show success message
    const clearBtn = document.querySelector('#clear-all-done');
    if (clearBtn) {
      const originalText = clearBtn.textContent;
      clearBtn.textContent = '✅ Cleared!';
      clearBtn.style.background = 'var(--accent)';
      clearBtn.style.color = 'white';
      
      setTimeout(() => {
        clearBtn.textContent = originalText;
        clearBtn.style.background = '';
        clearBtn.style.color = '';
      }, 1000);
    }
    
    // Refresh the display
    this.showDoneTasks();
  }

  // Play explosion sound when clearing all tasks
  playExplosionSound() {
    try {
      const audio = new Audio(chrome.runtime.getURL('mp3/explosion-01.mp3'));
      audio.volume = 0.7;
      audio.play().catch(e => {
        console.log('❌ Explosion sound play failed:', e);
      });
      console.log('💥 Playing explosion sound for clear all');
    } catch (error) {
      console.error('❌ Failed to play explosion sound:', error);
    }
  }

  // Format date for display
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  // Escape HTML to prevent XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
