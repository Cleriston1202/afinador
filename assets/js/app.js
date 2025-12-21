/* JS extraído do index.html. Usa `defer` no HTML para carregar após DOM. */
console.log('app.js loaded (refactor)');

// 1. Mapeamento das frequências padrão (Afinação Standard - E2 A2 D3 G3 B3 E4)
const notasViolao = [
  { nota: 'E2', freq: 82.41 },
  { nota: 'A2', freq: 110.00 },
  { nota: 'D3', freq: 146.83 },
  { nota: 'G3', freq: 196.00 },
  { nota: 'B3', freq: 246.94 },
  { nota: 'E4', freq: 329.63 }
];

// Elementos da UI
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
const tuningSection = document.getElementById('tuningSection');
const backBtn = document.getElementById('backBtn');

// Estado do áudio
let audioCtx;
let analyser;
let buffer;
let selectedIndex = null; // índice da corda selecionada
let isRunning = false;
let historyFreq = [];

// Configurações
const FFT_SIZE = 2048;
const RMS_THRESHOLD = 0.005; // sensibilidade aumentada para captar sinais mais fracos

// Gera os botões de corda a partir de `notasViolao`
notasViolao.forEach((n, i) => {
  const btn = document.createElement('button');
  btn.className = 'string-btn';
  btn.id = `string-${i}`;
  btn.innerHTML = `${n.nota}`;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.string-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedIndex = i;
    targetFreq.textContent = n.freq.toFixed(2) + ' Hz';
    noteEl.textContent = n.nota.replace(/\d/, '') || n.nota;
    noteFullNameEl.textContent = n.nota;
    stringInfo.style.display = 'block';
    stringInfoContent.innerHTML = `<strong>Nota:</strong> ${n.nota}<br><strong>Freq alvo:</strong> ${n.freq.toFixed(2)} Hz`;
    tuningSection.style.display = 'block';
    statusEl.textContent = 'Corda selecionada. Clique em Iniciar Afinador.';
  });
  stringsContainer.appendChild(btn);
});

backBtn.addEventListener('click', () => {
  if (isRunning && audioCtx) {
    audioCtx.close();
    audioCtx = null;
    isRunning = false;
  }
  selectedIndex = null;
  document.querySelectorAll('.string-btn').forEach(b => b.classList.remove('active'));
  tuningSection.style.display = 'none';
  startBtn.disabled = false;
  startBtn.textContent = 'Iniciar Afinador';
  historyFreq = [];
  setLamp('idle', 'Pronto');
  frequencyEl.textContent = '-- Hz';
  noteEl.textContent = '--';
});

startBtn.addEventListener('click', async () => {
  if (selectedIndex === null) {
    statusEl.textContent = 'Selecione uma corda antes de iniciar.';
    return;
  }
  startBtn.disabled = true;
  startBtn.textContent = 'Afinador Ativo...';
  try {
    await iniciarAfinador();
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Erro ao iniciar microfone. Verifique permissões.';
    startBtn.disabled = false;
    startBtn.textContent = 'Iniciar Afinador';
  }
});

function setLamp(state, text) {
  if (!tunedLamp) return;
  tunedLamp.className = 'lamp-large ' + state;
  lampLabel.textContent = text;
}

async function iniciarAfinador() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  buffer = new Float32Array(analyser.fftSize);

  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);
  isRunning = true;
  statusEl.textContent = 'Afinador ativo. Toque a corda.';
  detectarFrequencia();
}

function detectarFrequencia() {
  if (!analyser) return;
  analyser.getFloatTimeDomainData(buffer);
  const freq = autoCorrelate(buffer, audioCtx.sampleRate);

  if (freq !== -1) {
    // atualizar histórico simples
    historyFreq.push(freq);
    if (historyFreq.length > 6) historyFreq.shift();
    const avg = historyFreq.reduce((a, b) => a + b, 0) / historyFreq.length;

    const notaMaisProxima = encontrarNotaMaisProxima(avg);
    atualizarUIComFrequencia(avg, notaMaisProxima);
  } else {
    statusEl.textContent = 'Aguardando som...';
    frequencyEl.textContent = '-- Hz';
  }

  if (isRunning) requestAnimationFrame(detectarFrequencia);
}

// Algoritmo de Autocorrelação para encontrar o período da onda
function autoCorrelate(buffer, sampleRate) {
  let size = buffer.length;
  let rms = 0;

  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);
  if (rms < RMS_THRESHOLD) return -1; // Sinal muito fraco

  let r1 = 0, r2 = size - 1, thres = 0.2;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buffer[size - i]) < thres) { r2 = size - i; break; }
  }

  const buf = buffer.slice(r1, r2);
  size = buf.length;

  let c = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] = c[i] + buf[j] * buf[j + i];
    }
  }

  let d = 0; while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < size; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  if (maxpos === 0) return -1;
  return sampleRate / maxpos;
}

function encontrarNotaMaisProxima(freq) {
  // encontra nota alvo de acordo com a corda selecionada (selectedIndex)
  const alvo = notasViolao[selectedIndex];
  // também calcula diferença em cents
  const diff = freq - alvo.freq;
  const cents = Math.round(1200 * Math.log2(freq / alvo.freq));
  return { nota: alvo.nota, freqDet: freq, alvoFreq: alvo.freq, diff, cents };
}

function atualizarUIComFrequencia(freq, notaObj) {
  frequencyEl.textContent = freq.toFixed(2) + ' Hz';
  noteEl.textContent = notaObj.nota.replace(/\d/, '');
  noteFullNameEl.textContent = notaObj.nota;

  const absCents = Math.abs(notaObj.cents);
  // atualizar barra simples
  const maxCents = 100;
  const accuracy = Math.max(0, Math.min(100, 100 - (absCents / maxCents) * 100));
  tuningBar.style.width = accuracy + '%';

  if (absCents <= 5) {
    setLamp('tuned', 'AFINADO!');
    accuracyText.textContent = `✓ ${absCents} cents`;
    statusEl.textContent = 'AFINADO!';
  } else if (notaObj.diff > 0) {
    setLamp('far', 'Diminua');
    accuracyText.textContent = `${absCents} cents`;
    statusEl.textContent = 'Aperte menos';
  } else {
    setLamp('far', 'Aumente');
    accuracyText.textContent = `${absCents} cents`;
    statusEl.textContent = 'Aperte mais';
  }
}

function encontrarNotaMaisProximaGlobal(freq) {
  // caso necessário detectar globalmente (não usado no fluxo principal)
  return notasViolao.reduce((prev, curr) => Math.abs(curr.freq - freq) < Math.abs(prev.freq - freq) ? curr : prev);
}

function setLamp(state, text) {
  if (!tunedLamp) return;
  tunedLamp.className = 'lamp-large ' + state;
  lampLabel.textContent = text;
}

// Expor algumas funções para depuração
window._afinador = { notasViolao, iniciarAfinador, autoCorrelate };

