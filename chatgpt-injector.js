// Content script for AI engines to inject enhanced prompts
console.log('🎯 AI Engine injector loaded');

// AI Engine selectors based on the current engine
const AI_ENGINE_SELECTORS = {
  chatgpt: [
    'p[data-placeholder="Ask anything"]',
    'div[contenteditable="true"][data-id="root"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    '[data-placeholder="Ask anything"]',
    'textarea[data-id="root"]', 
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="message"]',
    'textarea[placeholder*="Ask"]',
    'textarea[data-testid="textbox"]',
    'textarea[aria-label*="Message"]',
    'textarea[aria-label*="message"]',
    'textarea[aria-label*="Ask"]'
  ],
  gemini: [
    'div[contenteditable="true"][role="textbox"][aria-label="Enter a prompt here"]',
    'div.ql-editor[contenteditable="true"]',
    'div[contenteditable="true"][data-placeholder="Ask Gemini"]',
    'div[contenteditable="true"]'
  ],
  claude: [
    'p[data-placeholder="How can I help you today?"]',
    'div[contenteditable="true"][data-placeholder*="help you"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]'
  ]
};

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INJECT_PROMPT') {
    console.log('📝 Received prompt to inject:', message.prompt, 'for engine:', message.aiEngine);
    injectPrompt(message.prompt, message.aiEngine || 'chatgpt');
    sendResponse({ success: true });
  }
  return true;
});

// Function to inject prompt into AI engine's input field
async function injectPrompt(prompt, aiEngine = 'chatgpt') {
  const maxRetries = 10;
  const retryDelay = 500;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔄 Attempt ${attempt}/${maxRetries} to find ${aiEngine} input field`);
    
    // Get selectors for the current AI engine
    const selectors = AI_ENGINE_SELECTORS[aiEngine] || AI_ENGINE_SELECTORS.chatgpt;
    
    // Look for the appropriate input field
    let textarea = null;
    for (const selector of selectors) {
      textarea = document.querySelector(selector);
      if (textarea) {
        console.log(`✅ Found ${aiEngine} input with selector: ${selector}`);
        break;
      }
    }
    
    if (textarea) {
      console.log('✅ Found input element:', textarea.tagName, textarea.className, textarea.getAttribute('data-placeholder'));
      
      try {
        // Clear existing content
        if (textarea.tagName === 'TEXTAREA') {
          textarea.value = '';
        } else {
          textarea.innerHTML = '';
          textarea.textContent = '';
        }
        
        // Set the prompt based on element type
        if (textarea.tagName === 'TEXTAREA') {
          textarea.value = prompt;
        } else {
          // For ProseMirror/contenteditable elements
          textarea.textContent = prompt;
          
          // For ProseMirror, we need to trigger specific events
          if (textarea.hasAttribute('data-placeholder')) {
            // This is likely a ProseMirror editor
            textarea.innerHTML = `<p>${prompt.replace(/\n/g, '<br>')}</p>`;
          }
        }
        
        // Focus the element first
        textarea.focus();
        
        // Dispatch comprehensive events for React/ProseMirror
        const events = [
          new Event('input', { bubbles: true, cancelable: true }),
          new Event('change', { bubbles: true, cancelable: true }),
          new Event('keyup', { bubbles: true, cancelable: true }),
          new Event('keydown', { bubbles: true, cancelable: true }),
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
          new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true })
        ];
        
        events.forEach(event => textarea.dispatchEvent(event));
        
        // Trigger a custom event that ProseMirror might listen for
        const customEvent = new CustomEvent('prosemirror-update', { 
          detail: { content: prompt },
          bubbles: true 
        });
        textarea.dispatchEvent(customEvent);
        
        // Scroll into view
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        console.log('✅ Prompt injected successfully');
        return true;
        
      } catch (error) {
        console.error('❌ Error injecting prompt:', error);
        return false;
      }
    }
    
    // Wait before retrying
    if (attempt < maxRetries) {
      console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  console.error('❌ Failed to find textarea after all retries');
  return false;
}

// Auto-inject if we have a stored prompt (for page refreshes)
window.addEventListener('load', () => {
  // Check if there's a stored prompt to inject
  chrome.storage.local.get(['pendingPrompt', 'aiEngine'], (result) => {
    if (result.pendingPrompt) {
      console.log('🔄 Found pending prompt, injecting...');
      injectPrompt(result.pendingPrompt, result.aiEngine || 'chatgpt');
      // Clear the pending prompt
      chrome.storage.local.remove(['pendingPrompt', 'aiEngine']);
    }
  });
});
