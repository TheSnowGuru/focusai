const CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID'; // paste from dashboard
const REDIRECT_URI = 'https://fcebfginidcappmbokiokjpgjfbmadbj.chromiumapp.org/callback';
const SCOPES = ['streaming','user-read-email','user-read-private','user-modify-playback-state'];

let token = null, deviceId = null, player = null;

async function getToken() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'token',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' ')
  }).toString();

  const url = `https://accounts.spotify.com/authorize?${params}`;
  const redirectUrl = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  const hash = new URL(redirectUrl).hash.slice(1);
  const data = new URLSearchParams(hash);
  return data.get('access_token');
}

export async function ensureOffscreen(){
  if (!(await chrome.offscreen.hasDocument?.())) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play Spotify while popup is closed'
    });
  }
}

window.onSpotifyWebPlaybackSDKReady = async () => {
  token = token || await getToken();
  player = new Spotify.Player({
    name: 'Focus Bubble Player',
    getOAuthToken: cb => cb(token),
    volume: 0.8
  });

  player.addListener('ready', ({ device_id }) => { deviceId = device_id; });
  player.addListener('initialization_error', e => console.error(e));
  player.addListener('authentication_error', e => console.error(e));
  player.addListener('account_error', e => console.error(e));
  await player.connect();
};

async function transferPlaybackHere(){
  if (!token || !deviceId) return;
  await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play: true })
  });
}

async function playTrack(trackUrl){
  if (!token || !deviceId) return;
  const id = (trackUrl.match(/track\/([A-Za-z0-9]+)/) || [])[1];
  if (!id) return;
  await transferPlaybackHere();
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [`spotify:track:${id}`] })
  });
}

async function pause(){
  if (!token) return;
  await fetch('https://api.spotify.com/v1/me/player/pause', {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'PLAY_SPOTIFY') {
    await ensureOffscreen();
    token = token || await getToken();
    await playTrack(msg.track.url);
  }
  if (msg.type === 'STOP_SPOTIFY') {
    await pause();
  }
});


