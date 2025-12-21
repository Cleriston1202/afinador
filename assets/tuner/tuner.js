// Tuner (Afinador) Logic
const startTunerBtn = document.getElementById('start-tuner-btn');
const stopTunerBtn = document.getElementById('stop-tuner-btn');

window.audioCtx = null; // Expõe no window para acesso global
let analyser = null;
let buffer = null;
let mediaStream = null;
let animationFrameId = null;

const currentNoteDisplay = document.getElementById('current-note');
const currentFreqDisplay = document.getElementById('current-freq');
const statusMessage = document.getElementById('status-message');
const targetNoteDisplay = document.getElementById('target-note');
const targetFreqDisplay = document.getElementById('target-freq');
const tunerNeedle = document.getElementById('tuner-needle');

let needleAngleTarget = 0;
let needleAngleCurrent = 0;
let needleAnimId = null;
const NEEDLE_SMOOTHING = 0.15;

const notasViolao = [
    { nota: 'E2', freq: 82.41 },
    { nota: 'A2', freq: 110.00 },
    { nota: 'D3', freq: 146.83 },
    { nota: 'G3', freq: 196.00 },
    { nota: 'B3', freq: 246.94 },
    { nota: 'E4', freq: 329.63 }
];

function updateTunerDisplay(freq, notaObj, diffCents) {
    if (notaObj) {
        currentNoteDisplay.textContent = notaObj.nota;
        targetNoteDisplay.textContent = notaObj.nota;
        targetFreqDisplay.textContent = notaObj.freq.toFixed(2);
    } else {
        currentNoteDisplay.textContent = "--";
        targetNoteDisplay.textContent = "--";
        targetFreqDisplay.textContent = "0.00";
    }

    currentFreqDisplay.textContent = `${freq.toFixed(2)} Hz`;

    let rotation = diffCents * 1.2;
    rotation = Math.max(-60, Math.min(60, rotation));
    needleAngleTarget = rotation;

    if (Math.abs(diffCents) < 5) {
        statusMessage.textContent = "AFINADO!";
        statusMessage.className = "status-message tuned";
        currentNoteDisplay.style.color = "var(--primary-color)";
    } else if (diffCents < -5) {
        statusMessage.textContent = "Aperte mais (muito baixo)";
        statusMessage.className = "status-message flat";
        currentNoteDisplay.style.color = "#e67e22";
    } else {
        statusMessage.textContent = "Aperte menos (muito alto)";
        statusMessage.className = "status-message sharp";
        currentNoteDisplay.style.color = "#e74c3c";
    }
}

function resetTunerDisplay() {
    currentNoteDisplay.textContent = "--";
    currentFreqDisplay.textContent = "0.00 Hz";
    statusMessage.textContent = "Aguardando áudio...";
    statusMessage.className = "status-message";
    targetNoteDisplay.textContent = "--";
    targetFreqDisplay.textContent = "0.00";
    tunerNeedle.style.transform = `translateX(-50%) rotate(0deg)`;
    currentNoteDisplay.style.color = "var(--text-color)";
    needleAngleTarget = 0;
    needleAngleCurrent = 0;
}

function animateNeedleLoop() {
    if (!tunerNeedle) return;
    needleAngleCurrent += (needleAngleTarget - needleAngleCurrent) * NEEDLE_SMOOTHING;
    tunerNeedle.style.transform = `translateX(-50%) rotate(${needleAngleCurrent}deg)`;
    needleAnimId = requestAnimationFrame(animateNeedleLoop);
}

async function iniciarAfinador() {
    if (window.audioCtx && window.audioCtx.state === 'running') {
        return;
    }

    try {
        window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = window.audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        buffer = new Float32Array(analyser.fftSize);

        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = window.audioCtx.createMediaStreamSource(mediaStream);
        source.connect(analyser);

        startTunerBtn.disabled = true;
        stopTunerBtn.disabled = false;
        statusMessage.textContent = "Detectando...";
        statusMessage.className = "status-message";

        detectarFrequencia();
        if (!needleAnimId) animateNeedleLoop();
    } catch (err) {
        console.error("Erro ao acessar o microfone:", err);
        statusMessage.textContent = "Erro: Permissão de microfone negada ou indisponível.";
        statusMessage.className = "status-message sharp";
        startTunerBtn.disabled = false;
    }
}

function pararAfinador() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (needleAnimId) {
        cancelAnimationFrame(needleAnimId);
        needleAnimId = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    if (window.audioCtx) {
        window.audioCtx.close().then(() => {
            window.audioCtx = null;
            analyser = null;
            buffer = null;
            console.log("Afinador parado e recursos liberados.");
        });
    }

    startTunerBtn.disabled = false;
    stopTunerBtn.disabled = true;
    resetTunerDisplay();
}

function detectarFrequencia() {
    if (!analyser || !buffer) return;

    analyser.getFloatTimeDomainData(buffer);
    const sampleRate = window.audioCtx.sampleRate;
    const freq = autoCorrelate(buffer, sampleRate);

    if (freq !== -1 && freq > 40 && freq < 4000) {
        const notaMaisProxima = encontrarNotaMaisProxima(freq);
        const diff = freq - notaMaisProxima.freq;
        const diffCents = 1200 * Math.log2(freq / notaMaisProxima.freq);

        updateTunerDisplay(freq, notaMaisProxima, diffCents);
    } else {
        updateTunerDisplay(0, null, 0);
    }

    animationFrameId = requestAnimationFrame(detectarFrequencia);
}

function autoCorrelate(buffer, sampleRate) {
    let size = buffer.length;
    let rms = 0;

    for (let i = 0; i < size; i++) {
        rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / size);
    if (rms < 0.01) return -1;

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

    let s0 = c[maxpos - 1];
    let s1 = c[maxpos];
    let s2 = c[maxpos + 1];
    let interpolatedPos = maxpos + 0.5 * ((s0 - s2) / (s0 - 2 * s1 + s2));

    return sampleRate / interpolatedPos;
}

function encontrarNotaMaisProxima(freq) {
    let maisProxima = notasViolao[0];
    let menorDiferenca = Math.abs(notasViolao[0].freq - freq);

    for (let i = 1; i < notasViolao.length; i++) {
        const diff = Math.abs(notasViolao[i].freq - freq);
        if (diff < menorDiferenca) {
            menorDiferenca = diff;
            maisProxima = notasViolao[i];
        }
    }
    return maisProxima;
}

// Event listeners
startTunerBtn.addEventListener('click', iniciarAfinador);
stopTunerBtn.addEventListener('click', pararAfinador);
