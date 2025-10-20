// Settings Manager for FocusAI
export class SettingsManager {
  constructor() {
    this.elements = {
      settingsBtn: document.getElementById('settings-btn'),
      settingsPage: document.getElementById('settings-page'),
      backBtn: document.getElementById('back-btn'),
      aiEngineSelect: document.getElementById('ai-engine-select')
    };
    
    this.currentEngine = 'chatgpt'; // Default
  }

  // Initialize settings manager
  async init() {
    await this.loadSettings();
    this.attachEventListeners();
    this.updateUI();
  }

  // Attach event listeners
  attachEventListeners() {
    // Settings button click
    if (this.elements.settingsBtn) {
      this.elements.settingsBtn.addEventListener('click', () => {
        this.showSettings();
      });
    }

    // Back button click
    if (this.elements.backBtn) {
      this.elements.backBtn.addEventListener('click', () => {
        this.hideSettings();
      });
    }

    // AI engine select change
    if (this.elements.aiEngineSelect) {
      this.elements.aiEngineSelect.addEventListener('change', (e) => {
        this.updateAIEngine(e.target.value);
      });
    }
  }

  // Show settings page
  showSettings() {
    if (this.elements.settingsPage) {
      this.elements.settingsPage.classList.remove('hidden');
      console.log('⚙️ Settings page opened');
    }
  }

  // Hide settings page
  hideSettings() {
    if (this.elements.settingsPage) {
      this.elements.settingsPage.classList.add('hidden');
      console.log('⚙️ Settings page closed');
    }
  }

  // Update AI engine
  async updateAIEngine(engine) {
    this.currentEngine = engine;
    await this.saveSettings();
    console.log('🤖 AI Engine changed to:', engine);
  }

  // Load settings from storage
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['aiEngine']);
      this.currentEngine = result.aiEngine || 'chatgpt';
    } catch (error) {
      console.error('❌ Failed to load settings:', error);
    }
  }

  // Save settings to storage
  async saveSettings() {
    try {
      await chrome.storage.local.set({ aiEngine: this.currentEngine });
    } catch (error) {
      console.error('❌ Failed to save settings:', error);
    }
  }

  // Update UI based on current settings
  updateUI() {
    if (this.elements.aiEngineSelect) {
      this.elements.aiEngineSelect.value = this.currentEngine;
    }
  }

  // Get current AI engine
  getCurrentEngine() {
    return this.currentEngine;
  }

  // Get AI engine URLs
  getAIEngineUrls() {
    return {
      chatgpt: 'https://chatgpt.com/',
      gemini: 'https://gemini.google.com/app',
      claude: 'https://claude.ai/new'
    };
  }

  // Get AI engine selectors for content injection
  getAIEngineSelectors() {
    return {
      chatgpt: [
        'p[data-placeholder="Ask anything"]',
        'div[contenteditable="true"][data-id="root"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        '[data-placeholder="Ask anything"]'
      ],
      gemini: [
        'div[contenteditable="true"][role="textbox"][aria-label="Enter a prompt here"]',
        'div.ql-editor[contenteditable="true"]',
        'div[contenteditable="true"][data-placeholder="Ask Gemini"]'
      ],
      claude: [
        'p[data-placeholder="How can I help you today?"]',
        'div[contenteditable="true"][data-placeholder*="help you"]',
        'div[contenteditable="true"][role="textbox"]'
      ]
    };
  }
}
