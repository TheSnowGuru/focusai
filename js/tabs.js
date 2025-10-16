// Tab management (tasks removed)
import { StorageManager } from './storage.js';

export class TabManager {
  constructor() {
    this.elements = {};
    this.activeTab = 'today';
  }

  init() {
    this.elements = {
      tabBar: document.getElementById('tab-bar')
    };

    this.initEventListeners();
    this.createDefaultTabs();
    this.loadActiveTab();
  }

  initEventListeners() {
    if (this.elements.tabBar) {
      this.elements.tabBar.addEventListener('click', (e) => this.handleTabClick(e));
    }
  }

  async createDefaultTabs() {
    const customTabs = await StorageManager.getCustomTabs();
    await this.renderTabs();
  }

  async renderTabs() {
    if (!this.elements.tabBar) return;

    const customTabs = await StorageManager.getCustomTabs();
    
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
    console.log('Switching tab to:', tabId);
    
    this.activeTab = tabId;
    await StorageManager.setActiveTab(tabId);
    this.setActiveTab(tabId);
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
    await this.renderTabs();
  }

  async showAddTabDialog() {
    const name = prompt('Enter tab name:');
    if (!name || !name.trim()) return;

    await this.createCustomTab(name.trim());
  }

  async createCustomTab(name) {
    const customTabs = await StorageManager.getCustomTabs();
    
    if (!customTabs.includes(name)) {
      customTabs.push(name);
      await StorageManager.setCustomTabs(customTabs);
      await this.renderTabs();
    }
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

    if (!confirm('Are you sure you want to delete this tab?')) {
      return;
    }

    const customTabs = await StorageManager.getCustomTabs();
    
    // Find the tab name to remove
    const tabElement = this.elements.tabBar?.querySelector(`[data-tab="${tabId}"]`);
    const tabName = tabElement?.textContent;
    
    if (tabName) {
      const tabIndex = customTabs.indexOf(tabName);
      if (tabIndex >= 0) {
        customTabs.splice(tabIndex, 1);
        await StorageManager.setCustomTabs(customTabs);
        
        // Switch to today tab if deleting active tab
        if (this.activeTab === tabId) {
          await this.switchTab('today');
        }
        
        await this.renderTabs();
      }
    }
  }
}
