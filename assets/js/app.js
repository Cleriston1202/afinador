// 1. Mapeamento das frequências padrão (Afinação Standard - E2 A2 D3 G3 B3 E4)
const notasViolao = [
    { nota: 'E2', freq: 82.41 },
    { nota: 'A2', freq: 110.00 },
    { nota: 'D3', freq: 146.83 },
    { nota: 'G3', freq: 196.00 },
    { nota: 'B3', freq: 246.94 },
    { nota: 'E4', freq: 329.63 }
];

let audioCtx = null; // Inicialmente nulo, criado ao iniciar o afinador
let analyser = null;
let buffer = null;
let mediaStream = null; // Para armazenar o stream e poder parar o microfone
let animationFrameId = null; // Para controlar a animação

// Elementos da interface
const currentNoteDisplay = document.getElementById('current-note');
const currentFreqDisplay = document.getElementById('current-freq');
const statusMessage = document.getElementById('status-message');
const targetNoteDisplay = document.getElementById('target-note');
const targetFreqDisplay = document.getElementById('target-freq');
const startTunerBtn = document.getElementById('start-tuner-btn');
const stopTunerBtn = document.getElementById('stop-tuner-btn');
const tunerNeedle = document.getElementById('tuner-needle');
const homeImage = document.querySelector('.home-image'); // Imagem para a home

// Funções de controle da interface
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

    // Atualiza a agulha do afinador
    // O range do medidor é -50 a +50 cents.
    // O agulha gira de -60deg a +60deg (total de 120deg).
    // Mapeamos os cents para a rotação da agulha.
    let rotation = diffCents * 1.2; // 120 graus / 100 cents = 1.2 graus por cent
    rotation = Math.max(-60, Math.min(60, rotation)); // Limita a rotação
    // Atualiza o alvo da agulha; a animação fará a interpolação
    needleAngleTarget = rotation;

    // Atualiza a mensagem de status
    if (Math.abs(diffCents) < 5) { // Tolerância de +/- 5 cents
        statusMessage.textContent = "AFINADO!";
        statusMessage.className = "status-message tuned";
        currentNoteDisplay.style.color = "var(--primary-color)";
    } else if (diffCents < -5) {
        statusMessage.textContent = "Aperte mais (muito baixo)";
        statusMessage.className = "status-message flat";
        currentNoteDisplay.style.color = "#e67e22"; // Laranja
    } else {
        statusMessage.textContent = "Aperte menos (muito alto)";
        statusMessage.className = "status-message sharp";
        currentNoteDisplay.style.color = "#e74c3c"; // Vermelho
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
    // reset target/current
    needleAngleTarget = 0;
    needleAngleCurrent = 0;
}

// Loop de animação da agulha (interpola o ângulo alvo)
function animateNeedleLoop() {
    if (!tunerNeedle) return;
    needleAngleCurrent += (needleAngleTarget - needleAngleCurrent) * NEEDLE_SMOOTHING;
    tunerNeedle.style.transform = `translateX(-50%) rotate(${needleAngleCurrent}deg)`;
    needleAnimId = requestAnimationFrame(animateNeedleLoop);
}

// Lógica do Afinador (baseada no código anterior)
async function iniciarAfinador() {
    if (audioCtx && audioCtx.state === 'running') {
        return; // Afinador já está rodando
    }

    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        buffer = new Float32Array(analyser.fftSize);

        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioCtx.createMediaStreamSource(mediaStream);
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

    if (needleAnimId) {
        cancelAnimationFrame(needleAnimId);
        needleAnimId = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    if (audioCtx) {
        audioCtx.close().then(() => {
            audioCtx = null;
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
    const sampleRate = audioCtx.sampleRate;
    const freq = autoCorrelate(buffer, sampleRate);

    if (freq !== -1 && freq > 40 && freq < 4000) { // Filtra frequências irrealistas
        const notaMaisProxima = encontrarNotaMaisProxima(freq);
        const diff = freq - notaMaisProxima.freq;
        const diffCents = 1200 * Math.log2(freq / notaMaisProxima.freq); // Diferença em cents

        updateTunerDisplay(freq, notaMaisProxima, diffCents);
    } else {
        updateTunerDisplay(0, null, 0); // Limpa o display se não houver detecção
    }

    animationFrameId = requestAnimationFrame(detectarFrequencia);
}


// Algoritmo para identificar a frequência fundamental (Autocorrelação)
// Mantido o mesmo do código anterior, com pequenas otimizações se necessário.
function autoCorrelate(buffer, sampleRate) {
    let size = buffer.length;
    let rms = 0;

    for (let i = 0; i < size; i++) {
        rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / size);
    if (rms < 0.01) return -1; // Sinal muito fraco ou silêncio

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

    // Interpolação parabólica para maior precisão (opcional, mas comum em afinadores)
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


// Controle de navegação e exibição de páginas
const navLinks = document.querySelectorAll('.nav-links a');
const pages = document.querySelectorAll('.page');

function showPage(id) {
    pages.forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(id).classList.add('active');

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
        }
    });

    // Se sair da página do afinador, parar o afinador
    if (id !== 'afinador' && audioCtx && audioCtx.state === 'running') {
        pararAfinador();
    }
}

// Inicializa a navegação baseada na hash da URL
function handleHashChange() {
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        showPage(hash);
    } else {
        showPage('home'); // Página inicial por padrão
    }
}

// Event Listeners
window.addEventListener('load', () => {
    // Define uma imagem de violão local (substitui placeholder externo)
    homeImage.src = 'assets/images/violao.svg';
    handleHashChange(); // Exibe a página correta ao carregar
});
window.addEventListener('hashchange', handleHashChange);

startTunerBtn.addEventListener('click', iniciarAfinador);
stopTunerBtn.addEventListener('click', pararAfinador);

// Adiciona evento de clique para os links de navegação para atualizar a hash
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = link.getAttribute('href');
    });
});
startTunerBtn.addEventListener('click', iniciarAfinador);
stopTunerBtn.addEventListener('click', pararAfinador);

// Adiciona evento de clique para os links de navegação para atualizar a hash
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = link.getAttribute('href');
    });
});