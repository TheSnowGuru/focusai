// Spotify integration
import { StorageManager } from './storage.js';

export class SpotifyManager {
  static tracks = [];

  static async loadTracks() {
    try {
      const res = await fetch(chrome.runtime.getURL('tracks.json'));
      this.tracks = await res.json();
      if (!Array.isArray(this.tracks) || this.tracks.length === 0) {
        console.warn('tracks.json empty or invalid');
        this.tracks = [];
      }
    } catch (error) {
      console.error('Failed to load tracks:', error);
      this.tracks = [];
    }
  }

  static pickRandomTrack() {
    if (!this.tracks.length) return null;
    return this.tracks[Math.floor(Math.random() * this.tracks.length)];
  }

  static getNextTrack(current) {
    if (!this.tracks.length) return null;
    const idx = current ? this.tracks.findIndex(t => t.url === current.url) : -1;
    const nextIdx = (idx >= 0 ? idx + 1 : 0) % this.tracks.length;
    return this.tracks[nextIdx];
  }

  static getPrevTrack(current) {
    if (!this.tracks.length) return null;
    const idx = current ? this.tracks.findIndex(t => t.url === current.url) : 0;
    const prevIdx = (idx - 1 + this.tracks.length) % this.tracks.length;
    return this.tracks[prevIdx];
  }

  static async playTrack(track) {
    if (!track) {
      console.log('No track to play');
      return;
    }

    console.log('🎵 Playing track:', track.name);
    
    // Send to offscreen for background playback
    chrome.runtime.sendMessage({ type: 'PLAY_SPOTIFY', track }, (response) => {
      console.log('📥 Response from background:', response);
    });
  }

  static async stopPlayback() {
    console.log('🛑 Stopping Spotify playback');
    chrome.runtime.sendMessage({ type: 'STOP_SPOTIFY' });
  }

  static async getCurrentTrack() {
    const { track } = await StorageManager.getTimerState();
    return track;
  }

  static async setCurrentTrack(track) {
    await StorageManager.setTimerState({ track });
  }
}
