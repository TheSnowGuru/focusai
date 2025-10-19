let keepAlive = false;

async function ensureOffscreen(){
  const has = await chrome.offscreen.hasDocument?.().catch(() => false);
  if (has) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: 'Play timer completion sound'
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'focus-end') {
    console.log('⏰ Timer completed - focus-end alarm triggered');
    
    // Clear timer state
    await chrome.storage.local.set({ 
      isRunning: false, 
      startTime: null, 
      track: null 
    });

    // Play completion sound by creating an offscreen document
    try {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: 'Play timer completion sound'
      });
      
      // Send message to play the sound
      chrome.runtime.sendMessage({ 
        type: 'PLAY_COMPLETION_SOUND'
      }).catch(e => console.log('Sound message error:', e));
    } catch (e) {
      console.log('Offscreen document error:', e);
    }
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'FocusAI',
      message: 'Times up! Great work. Take 5-10 and come back 💪'
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    // Handle any future message types here
    sendResponse({ ok: true });
  })();
  return true; // keep channel open for async
});


