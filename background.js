let spotifyTabId = null;
let lastTrackUrl = null;

async function openOrReuseSpotify(url){
  lastTrackUrl = url;
  // Try to find an existing open.spotify.com tab first
  const tabs = await chrome.tabs.query({ url: 'https://open.spotify.com/*' });
  if (tabs && tabs.length){
    spotifyTabId = tabs[0].id;
    await chrome.tabs.update(spotifyTabId, { active: false, url });
    return spotifyTabId;
  }
  const created = await chrome.tabs.create({ url, active: false });
  spotifyTabId = created.id;
  return spotifyTabId;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message && message.type === 'PLAY_TRACK') {
      if (message.track && message.track.url){
        await openOrReuseSpotify(message.track.url);
      }
      sendResponse({ ok: true });
    } else if (message && message.type === 'STOP') {
      if (spotifyTabId != null){
        try { await chrome.tabs.remove(spotifyTabId); } catch (e) {}
        spotifyTabId = null;
      }
      sendResponse({ ok: true });
    }
  })();
  return true; // keep channel open for async
});


