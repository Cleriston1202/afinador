/* JS extraído do index.html. Usa `defer` no HTML para carregar após DOM. */
const startBtn = document.getElementById('startBtn');
const frequencyEl = document.getElementById('frequency');
const noteEl = document.getElementById('note');
const noteFullNameEl = document.getElementById('noteFullName');
const statusEl = document.getElementById('status');
const stringsContainer = document.getElementById('stringsContainer');
const tuningIndicator = document.getElementById('tuningIndicator');
const tuningArrow = document.getElementById('tuningArrow');
const tuningBar = document.getElementById('tuningBar');
const accuracyText = document.getElementById('accuracyText');
const targetFreq = document.getElementById('targetFreq');
const stringInfo = document.getElementById('stringInfo');
const stringInfoContent = document.getElementById('stringInfoContent');
const tunedLamp = document.getElementById('tunedLamp');
const lampLabel = document.getElementById('lampLabel');

let audioContext;
let analyser;
let buffer;
let selectedString = null;
let lastFrequency = null;
let freqHistory = [];
let currentState = 'idle';
let stateCounter = 0;
const MAX_HISTORY = 8; // suaviza leitura
const REQUIRED_STABLE_FRAMES = 4; // evita piscar

const NOTES = [
  { note: 'E', fullName: 'Mi', freq: 82.41, label: 'Mi (6ª)', position: '6ª corda (mais grossa)', octave: 'Mi2', description: 'A corda mais grave do violão, também conhecida como 6ª corda' },
  { note: 'A', fullName: 'Lá', freq: 110.0, label: 'Lá (5ª)', position: '5ª corda', octave: 'Lá2', description: 'Segunda corda mais grave, quinta corda do violão' },
  { note: 'D', fullName: 'Ré', freq: 146.83, label: 'Ré (4ª)', position: '4ª corda', octave: 'Ré3', description: 'Corda intermediária, quarta corda do violão' },
  { note: 'G', fullName: 'Sol', freq: 196.0, label: 'Sol (3ª)', position: '3ª corda', octave: 'Sol3', description: 'Terceira corda, uma das mais usadas em acordes' },
  { note: 'B', fullName: 'Si', freq: 246.94, label: 'Si (2ª)', position: '2ª corda', octave: 'Si3', description: 'Segunda corda mais aguda, penúltima corda' },
  { note: 'E', fullName: 'Mi', freq: 329.63, label: 'Mi (1ª)', position: '1ª corda (mais fina)', octave: 'Mi4', description: 'A corda mais aguda do violão, também conhecida como 1ª corda' }
];

// Filtragem e detecção
const MIN_DETECT_FREQ = 70; // Hz - mínimo plausível para corda de violão
const MAX_DETECT_FREQ = 1000; // Hz - máximo plausível (inclui harmônicos)
const RMS_THRESHOLD = 0.015; // limiar RMS para considerar som válido

function setLamp(state, text) {
  tunedLamp.className = 'lamp ' + state;
  lampLabel.textContent = text;
}

function addToHistory(value) {
  if (value === -1) return;
  freqHistory.push(value);
  if (freqHistory.length > MAX_HISTORY) freqHistory.shift();
}

function smoothedFreq() {
  if (!freqHistory.length) return -1;
  const sum = freqHistory.reduce((a, b) => a + b, 0);
  return sum / freqHistory.length;
}

// Criar botões para cada corda
NOTES.forEach((note, index) => {
  const btn = document.createElement('button');
  btn.className = 'string-btn';
  btn.id = `string-${index}`;
  btn.innerHTML = `
    <span style="font-size: 1.3rem;">${note.note}</span>
    <span class="string-label">${note.fullName} (${note.position})</span>
  `;
  btn.addEventListener('click', () => selectString(index));
  stringsContainer.appendChild(btn);
});

function selectString(index) {
  document.querySelectorAll('.string-btn').forEach(btn => btn.classList.remove('active'));
  const selectedBtn = document.getElementById(`string-${index}`);
  selectedBtn.classList.add('active');
  selectedString = NOTES[index];
  noteEl.textContent = selectedString.note;
  noteFullNameEl.textContent = selectedString.fullName + ' - ' + selectedString.position;
  targetFreq.textContent = selectedString.freq.toFixed(2) + ' Hz';
  stringInfoContent.innerHTML = `
    <strong>Nota:</strong> ${selectedString.fullName} (${selectedString.note})<br>
    <strong>Frequência alvo:</strong> ${selectedString.freq.toFixed(2)} Hz<br>
    <strong>Posição:</strong> ${selectedString.position}<br>
    <strong>Oitava:</strong> ${selectedString.octave}<br>
    <strong>Descrição:</strong> ${selectedString.description}
  `;
  stringInfo.style.display = 'block';
  statusEl.textContent = 'Pronto para afinar';
  statusEl.className = 'status';
  tuningBar.style.width = '0%';
  accuracyText.textContent = '';
  tuningIndicator.style.display = 'none';
  setLamp('idle', 'Pronto');
  lastFrequency = null;
}

startBtn.addEventListener('click', async () => {
  if (!selectedString) {
    statusEl.textContent = 'Por favor, selecione uma corda primeiro';
    statusEl.className = 'status high';
    return;
  }
  startBtn.disabled = true;
  startBtn.textContent = 'Afinador Ativo';
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    buffer = new Float32Array(analyser.fftSize);

    // Aplicar filtros para reduzir ruídos fora da faixa do violão
    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = MIN_DETECT_FREQ;
    highpass.Q.value = 1;

    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = MAX_DETECT_FREQ;
    lowpass.Q.value = 0.7;

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(analyser);
    detectPitch();
  } catch (error) {
    statusEl.textContent = 'Erro ao acessar o microfone';
    statusEl.className = 'status high';
    startBtn.disabled = false;
    startBtn.textContent = 'Iniciar Afinador';
  }
});

function detectPitch() {
  analyser.getFloatTimeDomainData(buffer);
  const frequency = autoCorrelate(buffer, audioContext.sampleRate);
  addToHistory(frequency);
  const smoothFrequency = smoothedFreq();

  // Checagem espectral
  let isGuitarLike = false;
  if (smoothFrequency !== -1) {
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    const fftSize = analyser.fftSize;
    const bin = Math.round(smoothFrequency * fftSize / audioContext.sampleRate);
    const start = Math.max(0, bin - 3);
    const end = Math.min(freqData.length - 1, bin + 3);
    let localSum = 0;
    for (let i = start; i <= end; i++) localSum += freqData[i];
    const localAvg = localSum / (end - start + 1);
    const globalAvg = freqData.reduce((a, b) => a + b, 0) / freqData.length;
    const spectralRatio = localAvg / (globalAvg + 1e-6);
    isGuitarLike = (
      smoothFrequency >= MIN_DETECT_FREQ &&
      smoothFrequency <= MAX_DETECT_FREQ &&
      spectralRatio > 2.5
    );
  }

  if (smoothFrequency !== -1 && isGuitarLike && selectedString) {
    frequencyEl.textContent = smoothFrequency.toFixed(2) + ' Hz';
    noteEl.textContent = selectedString.note;
    noteFullNameEl.textContent = selectedString.fullName + ' - ' + selectedString.position;
    tuningIndicator.style.display = 'flex';
    const targetFreqVal = selectedString.freq;
    const diff = smoothFrequency - targetFreqVal;
    const cents = Math.round(1200 * Math.log2(smoothFrequency / targetFreqVal));
    const absCents = Math.abs(cents);
    const maxCents = 100;
    const accuracy = Math.max(0, Math.min(100, 100 - (absCents / maxCents) * 100));
    tuningBar.style.width = accuracy + '%';
    tuningBar.style.background = 'linear-gradient(90deg, var(--mono-300), var(--mono-200), var(--mono-100))';
    tuningArrow.className = 'tuning-arrow';
    if (absCents < 5) {
      tuningArrow.textContent = '✓';
      tuningArrow.className = 'tuning-arrow center';
    } else if (diff < 0) {
      tuningArrow.textContent = '←';
      tuningArrow.className = 'tuning-arrow left';
    } else {
      tuningArrow.textContent = '→';
      tuningArrow.className = 'tuning-arrow right';
    }
    const newState = absCents < 5 ? 'tuned' : absCents < 15 ? 'near' : 'far';
    const stateText = newState === 'tuned' ? 'Afinado' : newState === 'near' ? 'Quase lá' : diff < 0 ? 'Aumente' : 'Diminua';
    if (newState !== currentState) {
      stateCounter += 1;
      if (stateCounter >= REQUIRED_STABLE_FRAMES) {
        currentState = newState;
        stateCounter = 0;
        setLamp(currentState, stateText);
      }
    } else {
      stateCounter = 0;
      setLamp(currentState, stateText);
    }
    accuracyText.className = 'accuracy-text';
    if (absCents < 5) {
      accuracyText.textContent = `✓ Perfeito! (${absCents} cents)`;
      accuracyText.classList.add('accuracy-good');
    } else if (absCents < 10) {
      accuracyText.textContent = `Muito próximo! (${absCents} cents) - Continue ajustando`;
      accuracyText.classList.add('accuracy-veryclose');
    } else if (absCents < 20) {
      accuracyText.textContent = `Próximo (${absCents} cents) - Você está no caminho certo!`;
      accuracyText.classList.add('accuracy-mid');
    } else if (absCents < 30) {
      accuracyText.textContent = `Aproximando (${absCents} cents) - Continue ajustando`;
      accuracyText.classList.add('accuracy-low');
    } else {
      accuracyText.textContent = `Longe (${absCents} cents) - Ajuste mais`;
      accuracyText.classList.add('accuracy-far');
    }
    let improvingText = '';
    if (lastFrequency !== null) {
      const lastDiff = Math.abs(lastFrequency - targetFreqVal);
      const currentDiff = Math.abs(smoothFrequency - targetFreqVal);
      if (currentDiff < lastDiff) improvingText = ' 📈 Melhorando!';
      else if (currentDiff > lastDiff) improvingText = ' 📉 Afastando';
    }
    lastFrequency = smoothFrequency;
    if (absCents < 5) {
      statusEl.textContent = '✓✓✓ PERFEITAMENTE AFINADO! ✓✓✓';
      statusEl.className = 'status ok';
    } else if (absCents < 10) {
      statusEl.textContent = `Quase lá! (${absCents} cents)${improvingText}`;
      statusEl.className = 'status very-close';
    } else if (absCents < 20) {
      statusEl.textContent = `Bom progresso! (${absCents} cents)${improvingText}`;
      statusEl.className = 'status close';
    } else if (diff < 0) {
      if (absCents < 30) {
        statusEl.textContent = `Baixo (${absCents} cents) - Aumente um pouco${improvingText}`;
        statusEl.className = 'status low';
      } else {
        statusEl.textContent = `Muito baixo (${absCents} cents) - Aumente mais${improvingText}`;
        statusEl.className = 'status very-low';
      }
    } else {
      if (absCents < 30) {
        statusEl.textContent = `Alto (${absCents} cents) - Diminua um pouco${improvingText}`;
        statusEl.className = 'status high';
      } else {
        statusEl.textContent = `Muito alto (${absCents} cents) - Diminua mais${improvingText}`;
        statusEl.className = 'status very-high';
      }
    }
  } else if (selectedString) {
    statusEl.textContent = 'Aguardando som...';
    statusEl.className = 'status';
    tuningIndicator.style.display = 'none';
    tuningBar.style.width = '0%';
    accuracyText.className = 'accuracy-text';
    accuracyText.textContent = '';
    setLamp('idle', 'Aguardando');
    lastFrequency = null;
    freqHistory = [];
  }
  requestAnimationFrame(detectPitch);
}

function getClosestString(freq) {
  return NOTES.reduce((prev, curr) => Math.abs(curr.freq - freq) < Math.abs(prev.freq - freq) ? curr : prev);
}

function autoCorrelate(buffer, sampleRate) {
  let size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < RMS_THRESHOLD) return -1;
  let r1 = 0, r2 = size - 1;
  const threshold = 0.2;
  for (let i = 0; i < size / 2; i++) { if (Math.abs(buffer[i]) < threshold) { r1 = i; break; } }
  for (let i = 1; i < size / 2; i++) { if (Math.abs(buffer[size - i]) < threshold) { r2 = size - i; break; } }
  buffer = buffer.slice(r1, r2);
  size = buffer.length;
  const c = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] += buffer[j] * buffer[j + i];
    }
  }
  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < size; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  return sampleRate / maxpos;
}
