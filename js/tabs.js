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
    this.activeTab = tabId;
    await StorageManager.setActiveTab(tabId);
    this.setActiveTab(tabId);
    await this.loadTasksForTab(tabId);
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
    const tasks = await StorageManager.getTasks();
    const tabTasks = tasks[tabId] || [];
    
    if (this.elements.taskList) {
      this.renderTasks(tabTasks);
    }
  }

  async addTask() {
    console.log('addTask called');
    const input = this.elements.addTaskInput;
    if (!input) {
      console.log('No input element found');
      return;
    }

    const text = input.value.trim();
    console.log('Task text:', text);
    if (!text) {
      console.log('No text to add');
      return;
    }

    await this.addTaskToActiveTab(text);
    input.value = '';
    console.log('Task added successfully');
  }

  async handleAddTaskKeydown(e) {
    console.log('Key pressed:', e.key);
    if (e.key === 'Enter') {
      console.log('Enter key detected, calling addTask');
      await this.addTask();
    }
  }

  async addTaskToActiveTab(taskText) {
    try {
      const tasks = await StorageManager.getTasks();
      if (!tasks[this.activeTab]) {
        tasks[this.activeTab] = [];
      }
      
      tasks[this.activeTab].push({
        text: taskText,
        done: false,
        createdAt: Date.now()
      });

      console.log('Saving tasks:', tasks);
      const success = await StorageManager.setTasks(tasks);
      console.log('Storage save success:', success);
      
      await this.loadTasksForTab(this.activeTab);
      console.log('Tasks loaded for tab:', this.activeTab);
      
      // Update motivation after adding task
      const { UIManager } = await import('./ui.js');
      UIManager.updateMotivation();
      
    } catch (error) {
      console.error('Error adding task:', error);
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
    if (!this.elements.taskList) return;
    
    this.elements.taskList.innerHTML = '';
    
    tasks.forEach((task, index) => {
      const taskElement = this.createTaskElement(task, index);
      this.elements.taskList.appendChild(taskElement);
    });
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
      await this.loadTasksForTab(this.activeTab);
    }
  }

  async completeTask(index) {
    // Import UIManager for celebrate effect
    const { UIManager } = await import('./ui.js');
    UIManager.celebrate();
    
    const tasks = await StorageManager.getTasks();
    if (tasks[this.activeTab] && tasks[this.activeTab][index]) {
      tasks[this.activeTab].splice(index, 1);
      await StorageManager.setTasks(tasks);
      await this.loadTasksForTab(this.activeTab);
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
