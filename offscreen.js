let currentIframe = null;

function removeIframe(){
  if (currentIframe && currentIframe.parentNode){
    currentIframe.parentNode.removeChild(currentIframe);
  }
  currentIframe = null;
}

function playTrack(track){
  removeIframe();
  if (!track || !track.embedUrl) return;
  const iframe = document.createElement('iframe');
  iframe.width = '100%';
  iframe.height = '80';
  iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  iframe.style.border = '0';
  iframe.src = track.embedUrl;
  document.body.appendChild(iframe);
  currentIframe = iframe;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'OFFSCREEN_PLAY'){
    playTrack(msg.track);
  } else if (msg && msg.type === 'OFFSCREEN_STOP'){
    removeIframe();
  }
});


