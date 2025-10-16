// UI effects and updates
import { StorageManager } from './storage.js';

export class UIManager {
  static motivationalMessages = [
    "Get things done now",
    "Focus on your tasks",
    "Close your mobile",
    "Deep work creates value",
    "One task at a time",
    "Eliminate distractions",
    "Your future self will thank you",
    "Progress over perfection",
    "Stay in the zone",
    "Make every minute count"
  ];

  static init() {
    this.updateMotivation();
    this.initVisibilityListener();
  }

  static updateMotivation() {
    const $motivation = document.getElementById('motivation');
    const $motivationText = document.getElementById('motivation-text');
    
    if (!$motivation || !$motivationText) return;
    
    // Check if user has tasks
    const $taskList = document.getElementById('task-list');
    const hasTasks = $taskList && $taskList.children.length > 0;
    
    if (!hasTasks) {
      $motivationText.textContent = "Add your first task";
      $motivation.classList.remove('hidden');
    } else {
      // Show random motivational message
      const randomIndex = Math.floor(Math.random() * this.motivationalMessages.length);
      $motivationText.textContent = this.motivationalMessages[randomIndex];
      $motivation.classList.remove('hidden');
    }
  }

  static initVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateMotivation();
      }
    });
  }

  static toggleViews(isAuthed) {
    console.log('🔄 Toggle views - isAuthed:', isAuthed);
    
    const $viewTimer = document.getElementById('view-timer');
    const $viewLogin = document.getElementById('view-login');
    const $authBtn = document.getElementById('auth-btn');
    
    if ($viewTimer) {
      $viewTimer.classList.toggle('hidden', !isAuthed);
    }
    if ($viewLogin) {
      $viewLogin.classList.toggle('hidden', !!isAuthed);
    }
    
    // Update auth button
    if ($authBtn) {
      if (isAuthed) {
        $authBtn.textContent = 'Logout';
        $authBtn.style.background = '#dc3545';
      } else {
        $authBtn.textContent = 'Login';
        $authBtn.style.background = '#007bff';
      }
    }
    
    console.log('Timer visible:', !$viewTimer?.classList.contains('hidden'));
    console.log('Login visible:', !$viewLogin?.classList.contains('hidden'));
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

  static initAuthButton() {
    const $authBtn = document.getElementById('auth-btn');
    if (!$authBtn) return;
    
    $authBtn.addEventListener('click', async () => {
      const { AuthManager } = await import('./auth.js');
      const isAuthed = await AuthManager.checkExistingSession();
      
      if (isAuthed) {
        // Logout
        if (confirm('Are you sure you want to logout?')) {
          await AuthManager.logout();
          this.toggleViews(false);
        }
      } else {
        // Login
        try {
          await AuthManager.loginWithSpotify();
          this.toggleViews(true);
        } catch (e) {
          console.error('Login failed:', e);
          alert('Login failed. Please try again.\n\nError: ' + e.message);
        }
      }
    });
  }

  static initAuthHandlers() {
    // Display redirect URI in the login card
    const redirectUri = chrome.identity.getRedirectURL('callback');
    const redirectDisplay = document.getElementById('redirect-uri');
    
    console.log('📋 Redirect URI:', redirectUri);
    
    if (redirectDisplay) {
      redirectDisplay.textContent = redirectUri;
    }
    
    const $loginBtn = document.getElementById('login-spotify');
    if ($loginBtn) {
      $loginBtn.addEventListener('click', async () => {
        $loginBtn.disabled = true;
        $loginBtn.textContent = 'Opening Spotify...';
        
        try {
          const { AuthManager } = await import('./auth.js');
          await AuthManager.loginWithSpotify();
          this.toggleViews(true);
        } catch (e) {
          console.error('Login failed:', e);
          alert('Spotify login failed. Please try again.\n\nError: ' + e.message);
          $loginBtn.disabled = false;
          $loginBtn.textContent = 'Login with Spotify';
        }
      });
    }
  }
}
