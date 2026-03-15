import { UI } from './strings.js';

let stream = null;
let mediaRecorder = null;
let chunks = [];

async function requestMicAccess() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return stream;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error(UI.MIC_DENIED);
    }
    if (err.name === 'NotFoundError') {
      throw new Error(UI.MIC_NOT_FOUND);
    }
    throw err;
  }
}

function getStream() {
  return stream;
}

function startRecording() {
  chunks = [];

  let mimeType = 'audio/webm;codecs=opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'audio/webm';
  }

  mediaRecorder = new MediaRecorder(stream, { mimeType });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  mediaRecorder.start();
}

function stopRecording() {
  return new Promise((resolve, reject) => {
    mediaRecorder.onerror = (e) => reject(e.error || new Error(UI.MIC_RECORDER_ERROR));
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
      resolve(blob);
    };
    mediaRecorder.stop();
  });
}

export { requestMicAccess, getStream, startRecording, stopRecording };
