// Tab management
import { StorageManager } from './storage.js';

export class TabManager {
  constructor() {
    this.elements = {};
    this.activeTab = 'today';
  }

  init() {
    this.elements = {
      tabBar: document.getElementById('tab-bar'),
      taskList: document.getElementById('task-list'),
      addTaskInput: document.getElementById('add-task-input'),
      addTaskBtn: document.getElementById('add-task-btn')
    };

    this.initEventListeners();
    this.createDefaultTabs();
    this.loadActiveTab();
  }

  initEventListeners() {
    if (this.elements.tabBar) {
      this.elements.tabBar.addEventListener('click', (e) => this.handleTabClick(e));
    }

    if (this.elements.addTaskInput) {
      this.elements.addTaskInput.addEventListener('keydown', (e) => this.handleAddTaskKeydown(e));
    }

    if (this.elements.addTaskBtn) {
      this.elements.addTaskBtn.addEventListener('click', () => this.addTask());
    }
  }

  async createDefaultTabs() {
    const customTabs = await StorageManager.getCustomTabs();
    const tasks = await StorageManager.getTasks();
    
    // Ensure default tabs exist
    if (!tasks.today) {
      tasks.today = [];
    }
    if (!tasks.tomorrow) {
      tasks.tomorrow = [];
    }
    
    await StorageManager.setTasks(tasks);
    await this.renderTabs();
  }

  async renderTabs() {
    if (!this.elements.tabBar) return;

    const customTabs = await StorageManager.getCustomTabs();
    const tasks = await StorageManager.getTasks();
    
    this.elements.tabBar.innerHTML = '';

    // Default tabs
    const defaultTabs = [
      { id: 'today', name: 'Today' },
      { id: 'tomorrow', name: 'Tomorrow' }
    ];

    // Custom tabs
    const customTabObjects = customTabs.map((name, index) => ({
      id: `custom${index}`,
      name: name
    }));

    const allTabs = [...defaultTabs, ...customTabObjects];

    allTabs.forEach(tab => {
      const tabElement = this.createTabElement(tab);
      this.elements.tabBar.appendChild(tabElement);
    });

    // Add tab button
    const addTabBtn = document.createElement('button');
    addTabBtn.className = 'tab add-tab';
    addTabBtn.textContent = '+ Add Tab';
    addTabBtn.addEventListener('click', () => this.showAddTabDialog());
    this.elements.tabBar.appendChild(addTabBtn);

    // Set active tab
    this.setActiveTab(this.activeTab);
  }

  createTabElement(tab) {
    const tabElement = document.createElement('button');
    tabElement.className = 'tab';
    tabElement.dataset.tab = tab.id;
    tabElement.textContent = tab.name;
    
    // Double-click to rename
    tabElement.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.renameTab(tab.id, tab.name);
    });

    return tabElement;
  }

  async handleTabClick(e) {
    const tab = e.target.closest('.tab');
    if (!tab || tab.classList.contains('add-tab')) return;

    const tabId = tab.dataset.tab;
    await this.switchTab(tabId);
  }

  async switchTab(tabId) {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('🔄 SWITCH TAB - START');
    console.log('═══════════════════════════════════════');
    console.log('From:', this.activeTab);
    console.log('To:', tabId);
    
    // Get tasks BEFORE switching
    const tasksBefore = await StorageManager.getTasks();
    console.log('Tasks BEFORE switch:', tasksBefore);
    
    this.activeTab = tabId;
    await StorageManager.setActiveTab(tabId);
    this.setActiveTab(tabId);
    
    // Get tasks AFTER switching
    const tasksAfter = await StorageManager.getTasks();
    console.log('Tasks AFTER switch:', tasksAfter);
    
    await this.loadTasksForTab(tabId);
    
    console.log('═══════════════════════════════════════');
    console.log('🔄 SWITCH TAB - END');
    console.log('═══════════════════════════════════════');
    console.log('');
  }

  setActiveTab(tabId) {
    // Update tab appearance
    if (this.elements.tabBar) {
      this.elements.tabBar.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
      });
    }
  }

  async loadActiveTab() {
    this.activeTab = await StorageManager.getActiveTab();
    await this.loadTasksForTab(this.activeTab);
    await this.renderTabs();
  }

  async loadTasksForTab(tabId) {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📂 LOAD TASKS FOR TAB - START');
    console.log('═══════════════════════════════════════');
    console.log('Tab ID:', tabId);
    
    const tasks = await StorageManager.getTasks();
    console.log('All tasks from storage:', tasks);
    
    const tabTasks = tasks[tabId] || [];
    console.log('Tasks for tab [' + tabId + ']:', tabTasks);
    console.log('Number of tasks:', tabTasks.length);
    
    if (this.elements.taskList) {
      console.log('Rendering tasks...');
      this.renderTasks(tabTasks);
      console.log('✅ Rendered');
    } else {
      console.log('❌ No taskList element found');
    }
    
    console.log('═══════════════════════════════════════');
    console.log('📂 LOAD TASKS FOR TAB - END');
    console.log('═══════════════════════════════════════');
    console.log('');
  }

  async addTask() {
    const input = this.elements.addTaskInput;
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    // Clear input first
    input.value = '';
    
    await this.addTaskToActiveTab(text);
  }

  async handleAddTaskKeydown(e) {
    if (e.key === 'Enter') {
      await this.addTask();
    }
  }

  async addTaskToActiveTab(taskText) {
    try {
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log('➕ ADD TASK - START');
      console.log('═══════════════════════════════════════');
      console.log('Task text:', taskText);
      console.log('Active tab:', this.activeTab);
      
      const tasks = await StorageManager.getTasks();
      console.log('Current tasks structure:', tasks);
      
      // Ensure tab array exists
      if (!tasks[this.activeTab]) {
        console.log('Creating new array for tab:', this.activeTab);
        tasks[this.activeTab] = [];
      }
      
      console.log('Tasks in active tab before add:', tasks[this.activeTab].length);
      
      // Create new task
      const newTask = {
        text: taskText,
        done: false,
        createdAt: Date.now()
      };
      console.log('New task:', newTask);
      
      // Add to the current tab's task list
      tasks[this.activeTab].push(newTask);
      console.log('✅ Task added to array. New count:', tasks[this.activeTab].length);
      console.log('Updated tasks:', tasks[this.activeTab]);
      
      // Save to storage
      console.log('Saving to storage...');
      await StorageManager.setTasks(tasks);
      console.log('✅ Saved to storage');
      
      // Force a small delay to ensure storage completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Render the updated tasks
      console.log('Rendering tasks...');
      this.renderTasks(tasks[this.activeTab]);
      console.log('✅ Rendered');
      
      // Update motivation after adding task
      const { UIManager } = await import('./ui.js');
      UIManager.updateMotivation();
      
      console.log('═══════════════════════════════════════');
      console.log('➕ ADD TASK - END');
      console.log('═══════════════════════════════════════');
      console.log('');
      
    } catch (error) {
      console.error('❌ Error adding task:', error);
    }
  }

  async showAddTabDialog() {
    const name = prompt('Enter tab name:');
    if (!name || !name.trim()) return;

    await this.createCustomTab(name.trim());
  }

  async createCustomTab(name) {
    const customTabs = await StorageManager.getCustomTabs();
    const tasks = await StorageManager.getTasks();
    
    // Find next available custom tab ID
    let customIndex = 0;
    while (customTabs.includes(name) || tasks[`custom${customIndex}`]) {
      customIndex++;
    }
    
    const tabId = `custom${customIndex}`;
    customTabs.push(name);
    tasks[tabId] = [];
    
    await StorageManager.setCustomTabs(customTabs);
    await StorageManager.setTasks(tasks);
    await this.renderTabs();
  }

  async renameTab(tabId, currentName) {
    if (tabId === 'today' || tabId === 'tomorrow') {
      alert('Cannot rename default tabs');
      return;
    }

    const newName = prompt('Enter new tab name:', currentName);
    if (!newName || !newName.trim() || newName === currentName) return;

    const customTabs = await StorageManager.getCustomTabs();
    const tabIndex = customTabs.indexOf(currentName);
    
    if (tabIndex >= 0) {
      customTabs[tabIndex] = newName.trim();
      await StorageManager.setCustomTabs(customTabs);
      await this.renderTabs();
    }
  }

  async deleteTab(tabId) {
    if (tabId === 'today' || tabId === 'tomorrow') {
      alert('Cannot delete default tabs');
      return;
    }

    if (!confirm('Are you sure you want to delete this tab? All tasks will be lost.')) {
      return;
    }

    const customTabs = await StorageManager.getCustomTabs();
    const tasks = await StorageManager.getTasks();
    
    // Find the tab name to remove
    const tabElement = this.elements.tabBar?.querySelector(`[data-tab="${tabId}"]`);
    const tabName = tabElement?.textContent;
    
    if (tabName) {
      const tabIndex = customTabs.indexOf(tabName);
      if (tabIndex >= 0) {
        customTabs.splice(tabIndex, 1);
        delete tasks[tabId];
        
        await StorageManager.setCustomTabs(customTabs);
        await StorageManager.setTasks(tasks);
        
        // Switch to today tab if deleting active tab
        if (this.activeTab === tabId) {
          await this.switchTab('today');
        }
        
        await this.renderTabs();
      }
    }
  }

  renderTasks(tasks) {
    console.log('🎨 renderTasks called with', tasks.length, 'tasks:', tasks);
    
    if (!this.elements.taskList) {
      console.log('❌ No taskList element found');
      return;
    }
    
    console.log('Clearing task list...');
    this.elements.taskList.innerHTML = '';
    
    console.log('Creating task elements...');
    tasks.forEach((task, index) => {
      console.log('  Creating element for task', index, ':', task.text);
      const taskElement = this.createTaskElement(task, index);
      this.elements.taskList.appendChild(taskElement);
    });
    
    console.log('✅ Rendered', this.elements.taskList.children.length, 'task elements');
  }

  createTaskElement(task, index) {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.taskIndex = index;
    
    // Add drag event listeners
    li.addEventListener('dragstart', (e) => this.handleDragStart(e));
    li.addEventListener('dragend', (e) => this.handleDragEnd(e));
    li.addEventListener('dragover', (e) => this.handleDragOver(e));
    li.addEventListener('drop', (e) => this.handleDrop(e));
    
    // Status indicator
    const status = document.createElement('div');
    status.className = 'task-status pending';
    status.innerHTML = '⏱️';
    status.title = 'Pending';
    
    // Task content
    const content = document.createElement('div');
    content.className = 'task-content';
    
    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.text;
    
    const details = document.createElement('div');
    details.className = 'task-details';
    const createdDate = new Date(task.createdAt || Date.now());
    details.textContent = `- pending • added ${createdDate.toLocaleTimeString()}`;
    
    content.appendChild(title);
    content.appendChild(details);
    
    // Task actions
    const actions = document.createElement('div');
    actions.className = 'task-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit task';
    editBtn.addEventListener('click', async () => {
      const newText = prompt('Edit task:', task.text);
      if (newText && newText.trim()) {
        await this.editTask(index, newText.trim());
      }
    });
    
    const completeBtn = document.createElement('button');
    completeBtn.className = 'complete-btn';
    completeBtn.textContent = 'Complete';
    completeBtn.addEventListener('click', async () => {
      await this.completeTask(index);
    });
    
    actions.appendChild(editBtn);
    actions.appendChild(completeBtn);
    
    li.appendChild(status);
    li.appendChild(content);
    li.appendChild(actions);
    
    return li;
  }

  async editTask(index, newText) {
    const tasks = await StorageManager.getTasks();
    if (tasks[this.activeTab] && tasks[this.activeTab][index]) {
      tasks[this.activeTab][index].text = newText;
      await StorageManager.setTasks(tasks);
      // Render directly to avoid race conditions
      this.renderTasks(tasks[this.activeTab]);
    }
  }

  async completeTask(index) {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('🎯 COMPLETE TASK - START');
    console.log('═══════════════════════════════════════');
    console.log('Index to complete:', index);
    console.log('Active tab:', this.activeTab);
    
    const tasks = await StorageManager.getTasks();
    console.log('Current tasks structure:', tasks);
    console.log('Tasks for active tab [' + this.activeTab + ']:', tasks[this.activeTab]);
    console.log('Number of tasks in active tab:', tasks[this.activeTab]?.length || 0);
    
    if (tasks[this.activeTab] && tasks[this.activeTab][index] !== undefined) {
      const taskToRemove = tasks[this.activeTab][index];
      console.log('✅ Task found at index ' + index + ':', taskToRemove.text);
      
      // Remove the task
      console.log('Removing task from array...');
      tasks[this.activeTab].splice(index, 1);
      console.log('✅ Task removed. Remaining tasks:', tasks[this.activeTab].length);
      console.log('Remaining tasks:', tasks[this.activeTab]);
      
      // Save to storage
      console.log('Saving to storage...');
      await StorageManager.setTasks(tasks);
      console.log('✅ Saved to storage');
      
      // Force a small delay to ensure storage completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Render the updated tasks
      console.log('Rendering updated tasks...');
      this.renderTasks(tasks[this.activeTab]);
      console.log('✅ Rendered');
      
      // Show celebrate effect AFTER updating the list
      const { UIManager } = await import('./ui.js');
      UIManager.celebrate();
      UIManager.updateMotivation();
      
      console.log('═══════════════════════════════════════');
      console.log('🎯 COMPLETE TASK - END');
      console.log('═══════════════════════════════════════');
      console.log('');
    } else {
      console.log('❌ ERROR: Task not found at index:', index);
      console.log('Active tab:', this.activeTab);
      console.log('Tasks available:', tasks[this.activeTab]);
      console.log('═══════════════════════════════════════');
      console.log('');
    }
  }

  // Drag and drop functionality
  handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
  }

  handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('#task-list li').forEach(li => {
      li.classList.remove('drag-over');
    });
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const afterElement = this.getDragAfterElement(this.elements.taskList, e.clientY);
    const dragging = document.querySelector('.dragging');
    
    if (afterElement == null) {
      this.elements.taskList.appendChild(dragging);
    } else {
      this.elements.taskList.insertBefore(dragging, afterElement);
    }
  }

  async handleDrop(e) {
    e.preventDefault();
    const tasks = Array.from(this.elements.taskList.children).map((li, index) => {
      const taskText = li.querySelector('.task-title').textContent;
      return { text: taskText, done: false, createdAt: Date.now() };
    });
    
    const allTasks = await StorageManager.getTasks();
    allTasks[this.activeTab] = tasks;
    await StorageManager.setTasks(allTasks);
  }

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
}
