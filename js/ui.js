// UI effects and updates
import { StorageManager } from './storage.js';

export class UIManager {
  static motivationalMessages = [
    "🎯 Complete today's goals",
    "✅ Finish what you started",
    "📝 Cross off every task today",
    "💪 Make today count",
    "🏆 Achieve your daily targets",
    "🎊 End today with zero pending tasks",
    "🚀 Complete your mission today",
    "💥 Finish strong today",
    "⭐ Accomplish your goals today",
    "🔥 Make today productive",
    "📋 Complete your to-do list",
    "🎯 Finish everything you planned",
    "🌟 Achieve your daily objectives",
    "✅ Complete your tasks today",
    "🎉 End today with success"
  ];

  static init() {
    this.updateMotivation();
    this.initVisibilityListener();
  }

  static updateMotivation() {
    const $motivationText = document.getElementById('motivation-text');
    
    if (!$motivationText) return;
    
    // Check if user has tasks
    const $taskList = document.getElementById('task-list');
    const hasTasks = $taskList && $taskList.children.length > 0;
    
    if (!hasTasks) {
      $motivationText.textContent = "Add your first task";
    } else {
      // Show random motivational message
      const randomIndex = Math.floor(Math.random() * this.motivationalMessages.length);
      $motivationText.textContent = this.motivationalMessages[randomIndex];
    }
  }

  static initVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateMotivation();
      }
    });
  }


  static celebrate() {
    const $confetti = document.getElementById('confetti');
    if (!$confetti) return;
    
    // Play explosion sound
    const audio = new Audio('explosion-01.mp3');
    audio.volume = 0.7;
    audio.play().catch(e => console.log('Audio play failed:', e));
    
    // Create confetti explosion
    const colors = ['🎉', '✨', '🎊', '💥', '🌟', '💫', '⭐', '🔥'];
    const count = 15;
    
    for (let i = 0; i < count; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.textContent = colors[Math.floor(Math.random() * colors.length)];
      
      // Random positioning and animation
      const dx = (Math.random() - 0.5) * 200;
      const dy = 60 + Math.random() * 40;
      const rot = (Math.random() - 0.5) * 40;
      const jx = (Math.random() - 0.5) * 20;
      const jy = Math.random() * 10;
      const jx2 = (Math.random() - 0.5) * 30;
      const jy2 = Math.random() * 15;
      
      confetti.style.setProperty('--dx', `${dx}px`);
      confetti.style.setProperty('--dy', `${dy}px`);
      confetti.style.setProperty('--rot', `${rot}deg`);
      confetti.style.setProperty('--jx', `${jx}px`);
      confetti.style.setProperty('--jy', `${jy}px`);
      confetti.style.setProperty('--jx2', `${jx2}px`);
      confetti.style.setProperty('--jy2', `${jy2}px`);
      
      $confetti.appendChild(confetti);
      
      // Remove after animation
      setTimeout(() => {
        if (confetti.parentNode) {
          confetti.parentNode.removeChild(confetti);
        }
      }, 1200);
    }
  }

}
