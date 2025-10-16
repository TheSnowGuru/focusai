// Storage management utilities
export class StorageManager {
  static async get(key, defaultValue = null) {
    try {
      const result = await chrome.storage.local.get(key);
      return typeof key === 'string' ? (result[key] || defaultValue) : result;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  }

  static async set(data) {
    try {
      await chrome.storage.local.set(data);
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  }

  static async remove(keys) {
    try {
      await chrome.storage.local.remove(keys);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }

  static async clear() {
    try {
      await chrome.storage.local.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }

  // Task-specific storage methods
  static async getTasks() {
    console.log('StorageManager.getTasks called');
    const { tasks } = await this.get({ tasks: {} });
    console.log('StorageManager.getTasks result:', tasks);
    return tasks || {};
  }

  static async setTasks(tasks) {
    console.log('StorageManager.setTasks called with:', tasks);
    const result = await this.set({ tasks });
    console.log('StorageManager.setTasks result:', result);
    return result;
  }

  static async getActiveTab() {
    const { activeTab } = await this.get({ activeTab: 'today' });
    return activeTab || 'today';
  }

  static async setActiveTab(tabName) {
    return await this.set({ activeTab: tabName });
  }

  static async getCustomTabs() {
    const { customTabs } = await this.get({ customTabs: [] });
    return customTabs || [];
  }

  static async setCustomTabs(tabs) {
    return await this.set({ customTabs: tabs });
  }

  // Timer-specific storage methods
  static async getTimerState() {
    return await this.get({
      startTime: null,
      durationMs: 25 * 60 * 1000,
      isRunning: false,
      track: null
    });
  }

  static async setTimerState(state) {
    return await this.set(state);
  }

  // Auth-specific storage methods
  static async getAuthState() {
    return await this.get({
      spotifyToken: '',
      tokenTimestamp: 0,
      spotifyRefreshToken: '',
      spotifyCodeVerifier: ''
    });
  }

  static async setAuthState(authData) {
    return await this.set(authData);
  }

  static async clearAuthState() {
    return await this.remove([
      'spotifyToken',
      'tokenTimestamp', 
      'spotifyRefreshToken',
      'spotifyCodeVerifier'
    ]);
  }
}
