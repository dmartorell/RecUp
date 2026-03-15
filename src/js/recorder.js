let stream = null;
let mediaRecorder = null;
let chunks = [];

async function requestMicAccess() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return stream;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Permiso de micrófono denegado. Activa el micrófono en la barra de direcciones.');
    }
    if (err.name === 'NotFoundError') {
      throw new Error('No se encontró ningún micrófono conectado.');
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
    mediaRecorder.onerror = (e) => reject(e.error || new Error('Error en MediaRecorder'));
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
      resolve(blob);
    };
    mediaRecorder.stop();
  });
}

export { requestMicAccess, getStream, startRecording, stopRecording };
