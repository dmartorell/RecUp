let stream = null;
let mediaRecorder = null;
let chunks = [];

async function requestMicAccess() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return stream;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Permiso de microfono denegado. Activa el microfono en la barra de direcciones.');
    }
    if (err.name === 'NotFoundError') {
      throw new Error('No se encontro ningun microfono conectado.');
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
  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
      resolve(blob);
    };
    mediaRecorder.stop();
  });
}

export { requestMicAccess, getStream, startRecording, stopRecording };
