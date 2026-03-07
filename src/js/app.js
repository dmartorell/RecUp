function isBrowserCompatible() {
  const hasSpeechRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
  const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;
  return hasSpeechRecognition && hasMediaRecorder && hasGetUserMedia;
}

if (!isBrowserCompatible()) {
  document.getElementById('app').style.display = 'none';
  document.getElementById('unsupported').style.display = 'flex';
}
