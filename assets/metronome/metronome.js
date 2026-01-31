// Metronome logic using Web Audio API
let metronomeIntervalId = null;
let audioCtx = null;
let metronomeState = { bpm: 100, isRunning: false, beatCount: 0, accentEnabled: true };

function playClick(ac, isAccent = false) {
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = isAccent ? 1000 : 800;
    g.gain.value = 0;
    o.connect(g);
    g.connect(ac.destination);
    const now = ac.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.9, now + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    o.start(now);
    o.stop(now + 0.09);
}

function startMetronome() {
    if (metronomeState.isRunning) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const bpm = metronomeState.bpm;
    const interval = (60 / bpm) * 1000;
    metronomeState.isRunning = true;
    metronomeState.beatCount = 0;
    const beatIndicator = document.getElementById('beat-indicator');
    const beatNumber = document.getElementById('beat-number');

    // immediate first click (accent if enabled)
    const firstAccent = metronomeState.accentEnabled;
    playClick(audioCtx, firstAccent);
    if (beatIndicator) {
        beatIndicator.classList.add('active');
        setTimeout(() => beatIndicator.classList.remove('active'), 120);
    }
    if (beatNumber) beatNumber.textContent = '1';

    metronomeIntervalId = setInterval(() => {
        metronomeState.beatCount = (metronomeState.beatCount + 1) % 4;
        const accent = metronomeState.beatCount === 0 && metronomeState.accentEnabled;
        playClick(audioCtx, accent);
        if (beatIndicator) {
            beatIndicator.classList.add('active');
            setTimeout(() => beatIndicator.classList.remove('active'), 120);
        }
        if (beatNumber) beatNumber.textContent = (metronomeState.beatCount + 1).toString();
    }, interval);

    const toggleBtn = document.getElementById('metronome-toggle-btn');
    if (toggleBtn) { toggleBtn.textContent = 'Parar'; toggleBtn.classList.add('running'); }
}

function stopMetronome() {
    if (!metronomeState.isRunning) return;
    metronomeState.isRunning = false;
    if (metronomeIntervalId) {
        clearInterval(metronomeIntervalId);
        metronomeIntervalId = null;
    }
    const toggleBtn = document.getElementById('metronome-toggle-btn');
    const beatNumber = document.getElementById('beat-number');
    if (toggleBtn) { toggleBtn.textContent = 'Iniciar'; toggleBtn.classList.remove('running'); }
    if (beatNumber) beatNumber.textContent = '-';
}

function updateBpmDisplay(val) {
    const display = document.getElementById('bpm-display');
    if (display) display.textContent = val;
}

function initMetronome() {
    const bpmInput = document.getElementById('bpm-input');
    const bpmNumber = document.getElementById('bpm-number');
    const toggleBtn = document.getElementById('metronome-toggle-btn');
    const accentCheckbox = document.getElementById('accent-checkbox');
    const presetContainer = document.getElementById('preset-buttons');

    const presets = [60, 80, 100, 120, 140, 160];
    if (presetContainer) {
        presets.forEach(p => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = p;
            b.addEventListener('click', () => {
                metronomeState.bpm = p;
                if (bpmInput) bpmInput.value = p;
                if (bpmNumber) bpmNumber.value = p;
                updateBpmDisplay(p);
                if (metronomeState.isRunning) { stopMetronome(); startMetronome(); }
            });
            presetContainer.appendChild(b);
        });
    }

    if (bpmInput) {
        bpmInput.addEventListener('input', (e) => {
            const v = parseInt(e.target.value, 10) || 100;
            metronomeState.bpm = v;
            if (bpmNumber) bpmNumber.value = v;
            updateBpmDisplay(v);
            if (metronomeState.isRunning) { stopMetronome(); startMetronome(); }
        });
    }

    if (bpmNumber) {
        bpmNumber.addEventListener('input', (e) => {
            let v = parseInt(e.target.value, 10) || 100;
            v = Math.max(40, Math.min(240, v));
            metronomeState.bpm = v;
            if (bpmInput) bpmInput.value = v;
            updateBpmDisplay(v);
            if (metronomeState.isRunning) { stopMetronome(); startMetronome(); }
        });
    }

    if (accentCheckbox) accentCheckbox.addEventListener('change', (e) => {
        metronomeState.accentEnabled = !!e.target.checked;
    });

    if (toggleBtn) toggleBtn.addEventListener('click', () => {
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        if (metronomeState.isRunning) stopMetronome(); else startMetronome();
    });

    // initial display
    updateBpmDisplay(metronomeState.bpm);
}
