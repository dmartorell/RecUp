let finalTranscript = '';
let isActive = false;
let recognition = null;
let errorCallback = null;
let stopResolve = null;

function createRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = 'es-ES';

  rec.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
      }
    }
  };

  rec.onend = () => {
    if (isActive) {
      setTimeout(() => {
        if (isActive) {
          try {
            rec.start();
          } catch (_) {}
        }
      }, 300);
    } else if (stopResolve) {
      stopResolve(finalTranscript.trim());
      stopResolve = null;
    }
  };

  rec.onerror = (event) => {
    if ((event.error === 'no-speech' || event.error === 'aborted') && isActive) {
      return;
    }
    if (errorCallback) {
      errorCallback(event.error);
    }
  };

  return rec;
}

function startTranscription(onError) {
  finalTranscript = '';
  isActive = true;
  errorCallback = onError || null;

  recognition = createRecognition();
  recognition.start();
}

function stopTranscription() {
  isActive = false;
  return new Promise((resolve) => {
    if (!recognition) {
      resolve(finalTranscript.trim());
      return;
    }
    stopResolve = resolve;
    recognition.stop();
  });
}

export { startTranscription, stopTranscription };
