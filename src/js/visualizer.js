let audioCtx = null;
let analyser = null;
let animationFrameId = null;

function initVisualizer(stream) {
  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;

  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);
}

function startVisualization(barsContainer) {
  const bars = Array.from(barsContainer.children);
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const barCount = bars.length;
  const step = Math.floor(bufferLength / barCount);

  function draw() {
    animationFrameId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i * step];
      const height = (value / 255) * 100;
      bars[i].style.height = `${Math.max(4, height)}%`;
    }
  }

  draw();
}

function stopVisualization() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }

  analyser = null;
}

export { initVisualizer, startVisualization, stopVisualization };
