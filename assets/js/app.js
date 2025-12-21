/* JS extraído do index.html. Usa `defer` no HTML para carregar após DOM. */
console.log('app.js loaded (v2)');
const startBtn = document.getElementById('startBtn');
const frequencyEl = document.getElementById('frequency');
const noteEl = document.getElementById('note');
const noteFullNameEl = document.getElementById('noteFullName');
const statusEl = document.getElementById('status');
const stringsContainer = document.getElementById('stringsContainer');
const tuningBar = document.getElementById('tuningBar');
const accuracyText = document.getElementById('accuracyText');
const targetFreq = document.getElementById('targetFreq');
const stringInfo = document.getElementById('stringInfo');
const stringInfoContent = document.getElementById('stringInfoContent');
const tunedLamp = document.getElementById('tunedLamp');
const lampLabel = document.getElementById('lampLabel');
const autoDetectInfo = document.getElementById('autoDetectInfo');
const tuningSection = document.getElementById('tuningSection');
const backBtn = document.getElementById('backBtn');

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

// Filtragem e detecção com configs otimizadas
const MIN_DETECT_FREQ = 70; // Hz - mínimo plausível para corda de violão
const MAX_DETECT_FREQ = 1000; // Hz - máximo plausível (inclui harmônicos)
const RMS_THRESHOLD = 0.001; // limiar RMS muito mais sensível
const AUTO_DETECT_ENABLED = true; // detectar cordas automaticamente
const AUTO_DETECT_CERTAINTY = 0.85; // confiança mínima para auto-detectar
const MAX_HISTORY_EXTENDED = 16; // histórico maior para melhor suavização

let autoDetectedString = null;
let autoDetectConfidence = 0;
let lastAutoDetectTime = 0;
let isAudioRunning = false;

function setLamp(state, text) {
  tunedLamp.className = 'lamp-large ' + state;
  lampLabel.textContent = text;
}

function addToHistory(value) {
  if (value === -1) return;
  freqHistory.push(value);
  if (freqHistory.length > MAX_HISTORY_EXTENDED) freqHistory.shift();
}

function smoothedFreq() {
  if (!freqHistory.length) return -1;
  // Média ponderada: últimas leituras têm maior peso
  let sum = 0, weightSum = 0;
  freqHistory.forEach((freq, idx) => {
    const weight = 1 + (idx / freqHistory.length);
    sum += freq * weight;
    weightSum += weight;
  });
  return sum / weightSum;
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
  statusEl.textContent = 'Corda selecionada - Clique em Iniciar Afinador';
  statusEl.className = 'status';
  tuningBar.style.width = '0%';
  accuracyText.textContent = '';
  setLamp('idle', 'Pronto');
  lastFrequency = null;
  autoDetectInfo.style.display = 'none';
  
  // Mostra a seção de afinação
  tuningSection.style.display = 'block';
}

backBtn.addEventListener('click', () => {
  // Para o afinador
  if (isAudioRunning && audioContext) {
    audioContext.close();
    audioContext = null;
    isAudioRunning = false;
  }
  
  // Volta para seleção de corda
  selectedString = null;
  tuningSection.style.display = 'none';
  document.querySelectorAll('.string-btn').forEach(btn => btn.classList.remove('active'));
  startBtn.disabled = false;
  startBtn.textContent = 'Iniciar Afinador';
  freqHistory = [];
});

startBtn.addEventListener('click', async () => {
  if (!selectedString) {
    statusEl.textContent = 'Por favor, selecione uma corda primeiro';
    statusEl.className = 'status high';
    return;
  }
  startBtn.disabled = true;
  startBtn.textContent = 'Afinador Ativo...';
  isAudioRunning = true;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096; // Aumentado para melhor precisão
    analyser.smoothingTimeConstant = 0.3;
    buffer = new Float32Array(analyser.fftSize);

    // Conexão simples sem muitos filtros
    source.connect(analyser);
    detectPitch();
  } catch (error) {
    console.error('Erro ao acessar microfone:', error);
    statusEl.textContent = 'Erro ao acessar o microfone. Permita acesso ao áudio.';
    statusEl.className = 'status high';
    startBtn.disabled = false;
    startBtn.textContent = 'Iniciar Afinador';
    isAudioRunning = false;
  }
});

function detectPitch() {
  analyser.getFloatTimeDomainData(buffer);
  const frequency = autoCorrelate(buffer, audioContext.sampleRate);
  addToHistory(frequency);
  const smoothFrequency = smoothedFreq();

  let currentString = selectedString;

  if (smoothFrequency !== -1 && currentString) {
    frequencyEl.textContent = smoothFrequency.toFixed(2) + ' Hz';
    noteEl.textContent = currentString.note;
    noteFullNameEl.textContent = currentString.fullName + ' - ' + currentString.position;
    const targetFreqVal = currentString.freq;
    const diff = smoothFrequency - targetFreqVal;
    const cents = Math.round(1200 * Math.log2(smoothFrequency / targetFreqVal));
    const absCents = Math.abs(cents);
    const maxCents = 100;
    const accuracy = Math.max(0, Math.min(100, 100 - (absCents / maxCents) * 100));
    tuningBar.style.width = accuracy + '%';
    tuningBar.style.background = 'linear-gradient(90deg, var(--mono-300), var(--mono-200), var(--mono-100))';
    
    if (absCents < 5) {
      lampLabel.innerHTML = '✓ Afinado';
    } else if (diff < 0) {
      lampLabel.innerHTML = '↑ Aumente';
    } else {
      lampLabel.innerHTML = '↓ Diminua';
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
      accuracyText.textContent = `Muito próximo! (${absCents} cents)`;
      accuracyText.classList.add('accuracy-veryclose');
    } else if (absCents < 20) {
      accuracyText.textContent = `Próximo (${absCents} cents)`;
      accuracyText.classList.add('accuracy-mid');
    } else if (absCents < 30) {
      accuracyText.textContent = `Aproximando (${absCents} cents)`;
      accuracyText.classList.add('accuracy-low');
    } else {
      accuracyText.textContent = `Ajuste mais (${absCents} cents)`;
      accuracyText.classList.add('accuracy-far');
    }
    let improvingText = '';
    if (lastFrequency !== null) {
      const lastDiff = Math.abs(lastFrequency - targetFreqVal);
      const currentDiff = Math.abs(smoothFrequency - targetFreqVal);
      if (currentDiff < lastDiff) improvingText = ' 📈';
      else if (currentDiff > lastDiff) improvingText = ' 📉';
    }
    lastFrequency = smoothFrequency;
    if (absCents < 5) {
      statusEl.textContent = '✓ PERFEITAMENTE AFINADO! ✓';
      statusEl.className = 'status ok';
    } else if (absCents < 10) {
      statusEl.textContent = `Quase lá! (${absCents} cents)${improvingText}`;
      statusEl.className = 'status very-close';
    } else if (absCents < 20) {
      statusEl.textContent = `Bom progresso! (${absCents} cents)${improvingText}`;
      statusEl.className = 'status close';
    } else if (diff < 0) {
      if (absCents < 30) {
        statusEl.textContent = `Baixo (${absCents} cents) - Aumente${improvingText}`;
        statusEl.className = 'status low';
      } else {
        statusEl.textContent = `Muito baixo (${absCents} cents) - Aumente mais${improvingText}`;
        statusEl.className = 'status very-low';
      }
    } else {
      if (absCents < 30) {
        statusEl.textContent = `Alto (${absCents} cents) - Diminua${improvingText}`;
        statusEl.className = 'status high';
      } else {
        statusEl.textContent = `Muito alto (${absCents} cents) - Diminua mais${improvingText}`;
        statusEl.className = 'status very-high';
      }
    }
  } else if (currentString) {
    statusEl.textContent = 'Aguardando som...';
    statusEl.className = 'status';
    tuningBar.style.width = '0%';
    accuracyText.className = 'accuracy-text';
    accuracyText.textContent = '';
    setLamp('idle', 'Aguardando');
    lastFrequency = null;
  }
  requestAnimationFrame(detectPitch);
}

function getClosestString(freq) {
  // Encontra a corda mais próxima com confiança baseada na distância
  let closest = NOTES[0];
  let minDistance = Math.abs(NOTES[0].freq - freq);
  
  for (let i = 1; i < NOTES.length; i++) {
    const distance = Math.abs(NOTES[i].freq - freq);
    if (distance < minDistance) {
      minDistance = distance;
      closest = NOTES[i];
    }
  }
  
  // Calcula confiança (100% se perfeito, diminui com distância)
  const cents = Math.abs(1200 * Math.log2(freq / closest.freq));
  const confidence = Math.max(0, Math.min(1, 1 - (cents / 200))); // range aceitável: ±200 cents
  
  return { string: closest, distance: minDistance, confidence: confidence, cents: cents };
}

function autoDetectString(freq) {
  if (!AUTO_DETECT_ENABLED || !freq || freq === -1) return false;
  
  const detection = getClosestString(freq);
  const now = Date.now();
  
  // Só auto-detecta se confiança alta e frequência é razoável
  if (detection.confidence >= AUTO_DETECT_CERTAINTY && detection.cents < 150) {
    // Evita trocar de corda muito frequentemente (aguarda 500ms)
    if (now - lastAutoDetectTime > 500) {
      autoDetectedString = detection.string;
      autoDetectConfidence = detection.confidence;
      lastAutoDetectTime = now;
      return true;
    }
  }
  
  return false;
}

function autoCorrelate(buffer, sampleRate) {
  // Calcular RMS para detecção de silêncio
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / buffer.length);
  
  // Se muito silencioso, retornar -1
  if (rms < RMS_THRESHOLD) return -1;
  
  // Implementar Autocorrelação com método de normalização
  let maxSamples = buffer.length;
  let best_offset = -1;
  let best_correlation = 0;
  let rms_sum = 0;
  
  // Calcular RMS dos dados
  for (let i = 0; i < maxSamples; i++) {
    let val = buffer[i];
    rms_sum += val * val;
  }
  rms_sum = Math.sqrt(rms_sum / maxSamples);
  
  // Não continuar se o RMS é muito baixo
  if (rms_sum < RMS_THRESHOLD) return -1;
  
  // Encontrar o melhor lag (atraso)
  let lastCorrelation = 1;
  for (let offset = 1; offset < maxSamples - 100; offset++) {
    let correlation = 0;
    for (let i = 0; i < maxSamples - offset; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }
    
    // Correlação normalizada
    correlation = 1 - (correlation / maxSamples);
    
    if (correlation > 0.9 && correlation > best_correlation) {
      if (correlation > lastCorrelation) {
        let foundGoodCorrelation = false;
        if (correlation > best_correlation) {
          best_correlation = correlation;
          best_offset = offset;
          foundGoodCorrelation = true;
        }
        if (foundGoodCorrelation) {
          // Interpolação parabólica para melhor precisão
          let shift = (buffer[best_offset + 1] - buffer[best_offset - 1]) / (2 * (2 * buffer[best_offset] - buffer[best_offset - 1] - buffer[best_offset + 1]));
          return sampleRate / (best_offset + shift);
        }
      }
    }
    lastCorrelation = correlation;
  }
  
  if (best_correlation > 0.01) {
    return sampleRate / best_offset;
  }
  
  return -1;
}
