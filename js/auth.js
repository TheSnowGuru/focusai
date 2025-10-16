// Authentication management
import { StorageManager } from './storage.js';

const SPOTIFY_CLIENT_ID = '13b4d04efb374d83892efa41680c4a3b';

export class AuthManager {
  static async checkExistingSession() {
    const { spotifyToken, tokenTimestamp } = await StorageManager.getAuthState();
    const hasToken = !!spotifyToken && (Date.now() - tokenTimestamp) < 3600000;
    
    console.log('🔍 Checking session - hasToken:', hasToken);
    
    if (hasToken) {
      try {
        const res = await fetch('https://api.spotify.com/v1/me', {
          headers: { 'Authorization': 'Bearer ' + spotifyToken }
        });
        if (res.ok) {
          const user = await res.json();
          console.log('✅ Valid session found:', user.display_name);
          return true;
        }
      } catch (e) {
        console.log('⚠️ Token validation failed, need re-auth');
      }
    }
    
    console.log('❌ No valid session');
    return false;
  }

  static async loginWithSpotify() {
    const redirectUri = chrome.identity.getRedirectURL('callback');
    const scopes = ['streaming','user-read-email','user-read-private','user-modify-playback-state'];
    
    console.log('🔐 Starting Spotify login...');
    console.log('Extension ID:', chrome.runtime.id);
    console.log('Redirect URI:', redirectUri);
    
    // Generate PKCE code verifier and challenge
    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    
    // Store code verifier for later use
    await StorageManager.set({ spotifyCodeVerifier: codeVerifier });
    
    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      show_dialog: 'true'
    }).toString();
    const url = `https://accounts.spotify.com/authorize?${params}`;
    
    console.log('🌐 Opening Spotify authorization...');
    
    try {
      const redirectUrl = await chrome.identity.launchWebAuthFlow({ 
        url, 
        interactive: true 
      });
      console.log('✅ Received redirect URL:', redirectUrl);
      
      const urlObj = new URL(redirectUrl);
      const code = urlObj.searchParams.get('code');
      const errorParam = urlObj.searchParams.get('error');
      
      if (errorParam) {
        console.error('Spotify OAuth error:', errorParam);
        throw new Error(`Spotify error: ${errorParam}`);
      }
      if (!code) {
        console.error('No authorization code received');
        throw new Error('No authorization code received from Spotify');
      }
      
      console.log('🔄 Exchanging authorization code for access token...');
      const { spotifyCodeVerifier } = await StorageManager.get({ spotifyCodeVerifier: '' });
      if (!spotifyCodeVerifier) {
        throw new Error('Code verifier not found in storage');
      }
      
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: spotifyCodeVerifier
        })
      });
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        throw new Error(`Token exchange failed: ${errorText}`);
      }
      
      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        throw new Error('No access token in response');
      }
      
      await StorageManager.setAuthState({
        spotifyToken: tokenData.access_token,
        tokenTimestamp: Date.now(),
        spotifyRefreshToken: tokenData.refresh_token || ''
      });
      
      await StorageManager.remove(['spotifyCodeVerifier']);
      
      console.log('✅ Login complete!');
      return true;
      
    } catch (error) {
      console.error('Login error:', error);
      await StorageManager.remove(['spotifyCodeVerifier']);
      throw error;
    }
  }

  static async logout() {
    await StorageManager.clearAuthState();
    console.log('🚪 Logged out');
  }

  static generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
  }

  static async generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const hashed = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hashed)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
}
