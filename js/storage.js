// Storage management utilities
export class StorageManager {
  static async get(keys, defaultValue = null) {
    try {
      const result = await chrome.storage.local.get(keys);
      
      // If keys is an object (default values), merge with result
      if (typeof keys === 'object' && !Array.isArray(keys)) {
        return { ...keys, ...result };
      }
      
      // If keys is a string, return that specific value or defaultValue
      if (typeof keys === 'string') {
        return result[keys] !== undefined ? result[keys] : defaultValue;
      }
      
      return result;
    } catch (error) {
      console.error('Storage get error:', error);
      return typeof keys === 'object' && !Array.isArray(keys) ? keys : defaultValue;
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
    const { tasks } = await this.get({ tasks: {} });
    console.log('📥 getTasks:', JSON.stringify(tasks));
    return tasks || {};
  }

  static async setTasks(tasks) {
    console.log('💾 setTasks:', JSON.stringify(tasks));
    const result = await this.set({ tasks });
    
    // Verify the save worked
    const verification = await chrome.storage.local.get('tasks');
    console.log('✅ Verified saved tasks:', JSON.stringify(verification.tasks));
    
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
