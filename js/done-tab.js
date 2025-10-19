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
    this.addDoneTab();
    this.attachEventListeners();
  }

  // Add Done tab to the tab bar
  addDoneTab() {
    if (!this.elements.tabBar) return;

    // Check if Done tab already exists
    const existingTab = this.elements.tabBar.querySelector(`[data-tab="${this.tabId}"]`);
    if (existingTab) return;

    // Find the add-tab button to insert before it
    const addTabBtn = this.elements.tabBar.querySelector('.add-tab');
    if (!addTabBtn) return;

    // Create Done tab element
    const doneTab = document.createElement('button');
    doneTab.className = 'tab';
    doneTab.dataset.tab = this.tabId;
    doneTab.textContent = 'Done';
    doneTab.title = 'View completed tasks';

    // Insert before the add-tab button
    this.elements.tabBar.insertBefore(doneTab, addTabBtn);
  }

  // Attach event listeners
  attachEventListeners() {
    // Listen for tab switches
    if (this.elements.tabBar) {
      this.elements.tabBar.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (tab && tab.dataset.tab === this.tabId) {
          this.showDoneTasks();
        }
      });
    }
  }

  // Show completed tasks
  async showDoneTasks() {
    if (!this.elements.taskList) return;

    // Get all completed tasks from storage
    const result = await chrome.storage.local.get('completedTasks');
    const completedTasks = result.completedTasks || [];

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
          <button class="delete-btn" aria-label="Delete permanently" title="Delete permanently">🗑️</button>
        </div>
      `;

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
    
    // If we're currently viewing the done tab, refresh the display
    const activeTab = this.elements.tabBar?.querySelector('.tab.active');
    if (activeTab && activeTab.dataset.tab === this.tabId) {
      this.showDoneTasks();
    }
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
