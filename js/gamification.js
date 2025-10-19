// Gamification Manager for FocusAI
export class GamificationManager {
  constructor() {
    this.elements = {
      streakDisplay: null,
      progressBar: null,
      progressText: null
    };
    this.dailyGoal = 5; // Default daily goal
  }

  // Initialize gamification
  async init() {
    this.createGamificationUI();
    await this.updateStreak();
    await this.updateDailyProgress();
    
    // Listen for storage changes to update UI
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        if (changes.completedTasks) {
          this.updateDailyProgress();
          this.updateStreak();
        }
      }
    });
  }

  // Create gamification UI elements
  createGamificationUI() {
    const header = document.querySelector('.header');
    if (!header) return;

    // Create gamification container
    const gamificationContainer = document.createElement('div');
    gamificationContainer.className = 'gamification-container';
    gamificationContainer.innerHTML = `
      <div class="streak-display" id="streak-display">
        🔥 <span id="streak-count">0</span>
      </div>
      <div class="progress-container">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="progress-bar-fill"></div>
        </div>
        <div class="progress-text" id="progress-text">0/5 tasks today</div>
      </div>
    `;

    // Insert after header
    header.insertAdjacentElement('afterend', gamificationContainer);

    // Store references
    this.elements.streakDisplay = document.getElementById('streak-display');
    this.elements.progressBar = document.getElementById('progress-bar-fill');
    this.elements.progressText = document.getElementById('progress-text');
  }

  // Update streak counter
  async updateStreak() {
    const result = await chrome.storage.local.get(['streakData', 'completedTasks']);
    const completedTasks = result.completedTasks || [];
    
    let streakData = result.streakData || {
      currentStreak: 0,
      lastCompletionDate: null,
      longestStreak: 0
    };

    // Get today's date (YYYY-MM-DD format)
    const today = new Date().toISOString().split('T')[0];
    
    // Check if user completed any tasks today
    const todaysTasks = completedTasks.filter(task => {
      const taskDate = new Date(task.completedAt).toISOString().split('T')[0];
      return taskDate === today;
    });

    // Update streak logic
    if (todaysTasks.length > 0) {
      const lastDate = streakData.lastCompletionDate;
      
      if (!lastDate) {
        // First task ever
        streakData.currentStreak = 1;
        streakData.lastCompletionDate = today;
      } else if (lastDate !== today) {
        // Check if yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (lastDate === yesterdayStr) {
          // Continue streak
          streakData.currentStreak += 1;
        } else {
          // Streak broken, restart
          streakData.currentStreak = 1;
        }
        streakData.lastCompletionDate = today;
      }
      
      // Update longest streak
      if (streakData.currentStreak > streakData.longestStreak) {
        streakData.longestStreak = streakData.currentStreak;
      }
      
      // Save updated streak data
      await chrome.storage.local.set({ streakData });
    }

    // Update UI
    if (this.elements.streakDisplay) {
      const streakCount = document.getElementById('streak-count');
      if (streakCount) {
        streakCount.textContent = streakData.currentStreak;
      }
      
      // Add pulsing animation for streaks > 0
      if (streakData.currentStreak > 0) {
        this.elements.streakDisplay.classList.add('active');
      } else {
        this.elements.streakDisplay.classList.remove('active');
      }
    }
  }

  // Update daily progress
  async updateDailyProgress() {
    const result = await chrome.storage.local.get(['completedTasks', 'dailyGoal']);
    const completedTasks = result.completedTasks || [];
    const dailyGoal = result.dailyGoal || this.dailyGoal;

    // Get today's completed tasks
    const today = new Date().toISOString().split('T')[0];
    const todaysTasks = completedTasks.filter(task => {
      const taskDate = new Date(task.completedAt).toISOString().split('T')[0];
      return taskDate === today;
    });

    const completedCount = todaysTasks.length;
    const percentage = Math.min((completedCount / dailyGoal) * 100, 100);

    // Update progress bar
    if (this.elements.progressBar) {
      this.elements.progressBar.style.width = `${percentage}%`;
      
      // Add completion class when 100%
      if (percentage === 100) {
        this.elements.progressBar.classList.add('complete');
      } else {
        this.elements.progressBar.classList.remove('complete');
      }
    }

    // Update progress text
    if (this.elements.progressText) {
      this.elements.progressText.textContent = `${completedCount}/${dailyGoal} tasks today`;
    }

    // Check for goal completion celebration
    if (completedCount === dailyGoal && percentage === 100) {
      await this.checkForCelebration(completedCount, dailyGoal);
    }
  }

  // Check if we should celebrate (only once per goal completion)
  async checkForCelebration(completedCount, dailyGoal) {
    const today = new Date().toISOString().split('T')[0];
    const result = await chrome.storage.local.get('lastCelebrationDate');
    const lastCelebrationDate = result.lastCelebrationDate;

    // Only celebrate once per day when goal is reached
    if (lastCelebrationDate !== today) {
      await chrome.storage.local.set({ lastCelebrationDate: today });
      this.triggerGoalCompletionCelebration();
    }
  }

  // Trigger celebration when daily goal is completed
  triggerGoalCompletionCelebration() {
    console.log('🎉 GOAL COMPLETED! Triggering celebration!');
    
    // Play explosion sound
    this.playExplosionSound();
    
    // Create massive confetti explosion
    this.createMassiveConfetti();
    
    // Show celebration message
    this.showCelebrationMessage();
    
    // Update motivation text
    if (window.UIManager) {
      const motivationText = document.getElementById('motivation-text');
      if (motivationText) {
        motivationText.textContent = "🎉 Daily goal completed! You're amazing!";
        motivationText.style.color = 'var(--accent)';
        
        setTimeout(() => {
          window.UIManager.updateMotivation();
        }, 5000);
      }
    }
  }

  // Create massive confetti effect
  createMassiveConfetti() {
    const confettiContainer = document.getElementById('confetti') || document.createElement('div');
    confettiContainer.id = 'confetti';
    confettiContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;';
    
    if (!document.getElementById('confetti')) {
      document.body.appendChild(confettiContainer);
    }

    // Create 100 confetti pieces
    for (let i = 0; i < 100; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
        const shapes = ['circle', 'square'];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        
        confetti.style.cssText = `
          position: absolute;
          width: ${Math.random() * 10 + 5}px;
          height: ${Math.random() * 10 + 5}px;
          background: ${colors[Math.floor(Math.random() * colors.length)]};
          border-radius: ${shape === 'circle' ? '50%' : '0'};
          left: ${Math.random() * 100}%;
          top: -20px;
          opacity: 1;
          animation: confetti-fall ${Math.random() * 3 + 2}s linear forwards;
          transform: rotate(${Math.random() * 360}deg);
        `;
        
        confettiContainer.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 5000);
      }, i * 20);
    }
  }

  // Show celebration message
  showCelebrationMessage() {
    const message = document.createElement('div');
    message.className = 'celebration-message';
    message.innerHTML = `
      <div class="celebration-content">
        <div class="celebration-emoji">🎉</div>
        <div class="celebration-title">Daily Goal Completed!</div>
        <div class="celebration-subtitle">You're on fire! Keep it up! 🔥</div>
      </div>
    `;
    
    document.body.appendChild(message);
    
    // Animate in
    setTimeout(() => {
      message.classList.add('show');
    }, 100);
    
    // Remove after 4 seconds
    setTimeout(() => {
      message.classList.remove('show');
      setTimeout(() => message.remove(), 300);
    }, 4000);
  }

  // Play explosion sound
  playExplosionSound() {
    try {
      const audio = new Audio('explosion-01.mp3');
      audio.volume = 0.8;
      audio.play().catch(e => {
        console.log('❌ Explosion sound play failed:', e);
      });
      console.log('💥 Playing celebration explosion sound');
    } catch (error) {
      console.error('❌ Failed to play explosion sound:', error);
    }
  }

  // Get current streak (for external use)
  async getCurrentStreak() {
    const result = await chrome.storage.local.get('streakData');
    const streakData = result.streakData || { currentStreak: 0 };
    return streakData.currentStreak;
  }

  // Get today's progress (for external use)
  async getTodaysProgress() {
    const result = await chrome.storage.local.get(['completedTasks', 'dailyGoal']);
    const completedTasks = result.completedTasks || [];
    const dailyGoal = result.dailyGoal || this.dailyGoal;

    const today = new Date().toISOString().split('T')[0];
    const todaysTasks = completedTasks.filter(task => {
      const taskDate = new Date(task.completedAt).toISOString().split('T')[0];
      return taskDate === today;
    });

    return {
      completed: todaysTasks.length,
      goal: dailyGoal,
      percentage: Math.min((todaysTasks.length / dailyGoal) * 100, 100)
    };
  }
}

