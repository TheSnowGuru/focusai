console.log('🎬 Offscreen document loading...');

chrome.runtime.onMessage.addListener((msg) => {
  console.log('📨 Offscreen received message:', msg.type);
  
  if (msg.type === 'PLAY_COMPLETION_SOUND') {
    console.log('🔔 PLAY_COMPLETION_SOUND received');
    playCompletionSound();
  }
});

function playCompletionSound() {
  try {
    const audio = new Audio(chrome.runtime.getURL('contador-timer.mp3'));
    audio.volume = 0.8;
    audio.play().catch(e => {
      console.log('❌ Audio play failed:', e);
    });
    console.log('🔔 Playing completion sound from offscreen');
  } catch (error) {
    console.error('❌ Failed to play completion sound:', error);
  }
}

console.log('✅ Offscreen document ready and listening for messages');
