let finalTranscript = '';
let isActive = false;
let recognition = null;
let errorCallback = null;

function initRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'es-ES';

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      }
    }
  };

  recognition.onend = () => {
    if (isActive) {
      setTimeout(() => {
        if (isActive) {
          try {
            recognition.start();
          } catch (_) {}
        }
      }, 300);
    }
  };

  recognition.onerror = (event) => {
    if ((event.error === 'no-speech' || event.error === 'aborted') && isActive) {
      return;
    }
    if (errorCallback) {
      errorCallback(event.error);
    }
  };
}

function startTranscription(onError) {
  finalTranscript = '';
  isActive = true;
  errorCallback = onError || null;

  if (!recognition) {
    initRecognition();
  }

  recognition.start();
}

function stopTranscription() {
  isActive = false;
  if (recognition) {
    recognition.stop();
  }
  return finalTranscript;
}

function getTranscript() {
  return finalTranscript;
}

export { startTranscription, stopTranscription, getTranscript };
