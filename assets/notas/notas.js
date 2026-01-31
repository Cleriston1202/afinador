// Notas (Fretboard) Logic
const playNotesBtn = document.getElementById('play-notes-btn');
const stopNotesBtn = document.getElementById('stop-notes-btn');
const prevNoteBtn = document.getElementById('prev-note-btn');
const nextNoteBtn = document.getElementById('next-note-btn');

// Audio context for strumming/tone playback
let notasAudioCtx = null;

function ensureNotasAudioCtx() {
    if (!notasAudioCtx) notasAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return notasAudioCtx;
}

function playTone(freq, duration = 0.12, type = 'sine') {
    const ac = ensureNotasAudioCtx();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0;
    o.connect(g);
    g.connect(ac.destination);
    const now = ac.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.8, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    o.start(now);
    o.stop(now + duration + 0.02);
}

// Sample support: try to load real audio samples from assets/samples/
const notasSamples = []; // array of AudioBuffer

async function loadSample(url) {
    try {
        const ac = ensureNotasAudioCtx();
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch failed');
        const arr = await res.arrayBuffer();
        const buf = await ac.decodeAudioData(arr);
        return buf;
    } catch (e) {
        return null;
    }
}

function playSample(buffer, timeOffset = 0) {
    if (!buffer) return;
    const ac = ensureNotasAudioCtx();
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const g = ac.createGain();
    g.gain.value = 1;
    src.connect(g);
    g.connect(ac.destination);
    src.start(ac.currentTime + timeOffset);
}

// Utility: convert AudioBuffer to WAV (16-bit PCM) ArrayBuffer for storage
function audioBufferToWav(buffer, opt) {
    opt = opt || {};
    var numChannels = buffer.numberOfChannels;
    var sampleRate = buffer.sampleRate;
    var format = 1; // PCM
    var bitDepth = 16;

    var result;
    if (numChannels === 2) {
        var channelLeft = buffer.getChannelData(0);
        var channelRight = buffer.getChannelData(1);
        var interleaved = new Float32Array(channelLeft.length + channelRight.length);
        var index = 0,
            inputIndex = 0;
        while (index < interleaved.length) {
            interleaved[index++] = channelLeft[inputIndex];
            interleaved[index++] = channelRight[inputIndex];
            inputIndex++;
        }
        result = interleaved;
    } else {
        result = buffer.getChannelData(0);
    }

    var bytesPerSample = bitDepth / 8;
    var blockAlign = numChannels * bytesPerSample;
    var bufferLength = 44 + result.length * bytesPerSample;
    var arrayBuffer = new ArrayBuffer(bufferLength);
    var view = new DataView(arrayBuffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + result.length * bytesPerSample, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, format, true);
    /* channel count */
    view.setUint16(22, numChannels, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * blockAlign, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, blockAlign, true);
    /* bits per sample */
    view.setUint16(34, bitDepth, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, result.length * bytesPerSample, true);

    // write the PCM samples
    var offset = 44;
    for (var i = 0; i < result.length; i++, offset += 2) {
        var s = Math.max(-1, Math.min(1, result[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return arrayBuffer;

    function writeString(view, offset, string) {
        for (var i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
}

// Generate an example strum AudioBuffer (synthesized) to act as sample
function generateExampleStrum(duration = 0.8, sampleRate = 44100) {
    const ac = ensureNotasAudioCtx();
    const length = Math.floor(duration * sampleRate);
    const buffer = ac.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // strings base open frequencies (approx)
    const stringFreqs = [82.41,110.00,146.83,196.00,246.94,329.63];
    // simulate six plucks staggered
    const now = 0;
    for (let i = 0; i < 6; i++) {
        const start = Math.floor((i * 0.02) * sampleRate); // stagger 20ms
        const f = stringFreqs[i];
        for (let n = 0; n < length - start; n++) {
            const t = n / sampleRate;
            // simple pluck: decaying sine + mild noise
            const env = Math.exp(-3 * t);
            const tone = Math.sin(2 * Math.PI * f * t) * env;
            const noise = (Math.random() * 2 - 1) * 0.02 * env;
            data[start + n] += (tone + noise) * 0.7;
        }
    }

    // normalize
    let max = 0;
    for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > max) max = Math.abs(data[i]);
    if (max > 1) for (let i = 0; i < data.length; i++) data[i] /= max;

    return buffer;
}

// IndexedDB storage for uploaded samples
const SAMPLES_DB = 'afinador-samples-db';
const SAMPLES_STORE = 'samples';

function openSamplesDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(SAMPLES_DB, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(SAMPLES_STORE)) db.createObjectStore(SAMPLES_STORE, { keyPath: 'name' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveSampleToDb(name, arrayBuffer) {
    const db = await openSamplesDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SAMPLES_STORE, 'readwrite');
        const store = tx.objectStore(SAMPLES_STORE);
        store.put({ name, data: arrayBuffer });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

async function loadSamplesFromDb() {
    const db = await openSamplesDb();
    return new Promise((resolve) => {
        const tx = db.transaction(SAMPLES_STORE, 'readonly');
        const store = tx.objectStore(SAMPLES_STORE);
        const req = store.getAll();
        req.onsuccess = async () => {
            const items = req.result || [];
            const ac = ensureNotasAudioCtx();
            for (let it of items) {
                try {
                    const buf = await ac.decodeAudioData(it.data.slice(0));
                    notasSamples.push(buf);
                } catch (e) {
                    // ignore decode errors
                }
            }
            resolve(items.length);
        };
        req.onerror = () => resolve(0);
    });
}

async function clearSamplesDb() {
    const db = await openSamplesDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SAMPLES_STORE, 'readwrite');
        const store = tx.objectStore(SAMPLES_STORE);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

let notesSequence = [];
let notesIndex = 0;
let notesIntervalId = null;
const NOTES_STEP_MS = 1300;

function buildDefaultSequence() {
    const strings = ['E2','A2','D3','G3','B3','E4'];
    const seq = [];
    for (let s = 0; s < strings.length; s++) {
        for (let fret = 0; fret <= 4; fret++) {
            seq.push(`${strings[s]}-${fret}`);
        }
    }
    return seq;
}

function clearActivePins() {
    document.querySelectorAll('#pins .pin.active').forEach(el => el.classList.remove('active'));
}

function highlightPin(idSuffix) {
    clearActivePins();
    const el = document.getElementById(`pin-${idSuffix}`);
    if (el) el.classList.add('active');
}

function playNotesSequence() {
    if (!notesSequence.length) notesSequence = buildDefaultSequence();
    playNotesBtn.disabled = true;
    stopNotesBtn.disabled = false;
    notesIndex = 0;
    highlightPin(notesSequence[notesIndex]);
    notesIntervalId = setInterval(() => {
        notesIndex = (notesIndex + 1) % notesSequence.length;
        highlightPin(notesSequence[notesIndex]);
    }, NOTES_STEP_MS);
}

function stopNotesSequence() {
    playNotesBtn.disabled = false;
    stopNotesBtn.disabled = true;
    if (notesIntervalId) {
        clearInterval(notesIntervalId);
        notesIntervalId = null;
    }
    clearActivePins();
}

function nextNote() {
    if (!notesSequence.length) notesSequence = buildDefaultSequence();
    notesIndex = (notesIndex + 1) % notesSequence.length;
    highlightPin(notesSequence[notesIndex]);
}

function prevNote() {
    if (!notesSequence.length) notesSequence = buildDefaultSequence();
    notesIndex = (notesIndex - 1 + notesSequence.length) % notesSequence.length;
    highlightPin(notesSequence[notesIndex]);
}

/* Chords: definição completa para todas as notas maiores e menores */
const CHORDS_ALL = {
    // Maiores
    'C_major':  { frets: [-1,3,2,0,1,0], name: 'C Maior (Dó)' },
    'C#_major': { frets: [-1,-1,4,1,1,1], name: 'C# Maior (Dó#)' },
    'D_major':  { frets: [-1,-1,0,2,3,2], name: 'D Maior (Ré)' },
    'D#_major': { frets: [-1,-1,1,3,4,3], name: 'D# Maior (Ré#)' },
    'E_major':  { frets: [0,2,2,1,0,0], name: 'E Maior (Mi)' },
    'F_major':  { frets: [1,3,3,2,1,1], name: 'F Maior (Fá)' },
    'F#_major': { frets: [2,4,4,3,2,2], name: 'F# Maior (Fá#)' },
    'G_major':  { frets: [3,2,0,0,0,3], name: 'G Maior (Sol)' },
    'G#_major': { frets: [4,3,1,1,1,4], name: 'G# Maior (Sol#)' },
    'A_major':  { frets: [-1,0,2,2,2,0], name: 'A Maior (Lá)' },
    'A#_major': { frets: [-1,1,3,3,3,1], name: 'A# Maior (Lá#)' },
    'B_major':  { frets: [2,2,4,4,4,2], name: 'B Maior (Si)' },
    
    // Menores
    'C_minor':  { frets: [-1,3,1,0,1,0], name: 'Cm Menor (Dó)' },
    'C#_minor': { frets: [-1,-1,4,2,4,1], name: 'C#m Menor (Dó#)' },
    'D_minor':  { frets: [-1,-1,0,2,3,1], name: 'Dm Menor (Ré)' },
    'D#_minor': { frets: [-1,-1,1,3,4,2], name: 'D#m Menor (Ré#)' },
    'E_minor':  { frets: [0,2,2,0,0,0], name: 'Em Menor (Mi)' },
    'F_minor':  { frets: [1,3,3,1,1,1], name: 'Fm Menor (Fá)' },
    'F#_minor': { frets: [2,4,4,2,2,2], name: 'F#m Menor (Fá#)' },
    'G_minor':  { frets: [3,5,5,3,3,3], name: 'Gm Menor (Sol)' },
    'G#_minor': { frets: [4,6,6,4,4,4], name: 'G#m Menor (Sol#)' },
    'A_minor':  { frets: [-1,0,2,2,1,0], name: 'Am Menor (Lá)' },
    'A#_minor': { frets: [-1,1,3,3,2,1], name: 'A#m Menor (Lá#)' },
    'B_minor':  { frets: [2,2,4,4,3,2], name: 'Bm Menor (Si)' }
};

/* Chords: definição e visualização */
const CHORDS = {
    'C':  { frets: [-1,3,2,0,1,0], name: 'C (Dó Maior)' },
    'G':  { frets: [3,2,0,0,0,3], name: 'G (Sol Maior)' },
    'D':  { frets: [-1,-1,0,2,3,2], name: 'D (Ré Maior)' },
    'Em': { frets: [0,2,2,0,0,0], name: 'Em (Mi Menor)' },
    'Am': { frets: [-1,0,2,2,1,0], name: 'Am (Lá Menor)' }
};

function showChord(chordKey) {
    const chord = CHORDS[chordKey];
    if (!chord) return;
    clearActivePins();
    const strings = ['E2','A2','D3','G3','B3','E4'];
    document.querySelectorAll('#pins .pin').forEach(el => el.classList.remove('chord-muted'));
    strings.forEach((s, i) => {
        const fret = chord.frets[i];
        if (fret === -1) {
            for (let f = 0; f <= 4; f++) {
                const el = document.getElementById(`pin-${s}-${f}`);
                if (el) el.classList.add('chord-muted');
            }
        } else {
            const id = `pin-${s}-${fret}`;
            const el = document.getElementById(id);
            if (el) el.classList.add('active');
        }
    });
    const chordInfo = document.getElementById('chord-info');
    if (chordInfo) chordInfo.textContent = `${chord.name} — posições: ${chord.frets.map(v => v===-1? 'x': v).join(' ')}`;
}

function showChordMajorMinor(note, type) {
    const chordKey = `${note}_${type}`;
    const chord = CHORDS_ALL[chordKey];
    if (!chord) return;
    
    clearActivePins();
    const strings = ['E2','A2','D3','G3','B3','E4'];
    document.querySelectorAll('#pins .pin').forEach(el => el.classList.remove('chord-muted'));
    
    // Remover rótulos e barras anteriores (textos, grupos, retângulos e traços de pestana)
    document.querySelectorAll('#pins text').forEach(el => el.remove());
    document.querySelectorAll('#pins .pin-finger-group').forEach(el => el.remove());
    document.querySelectorAll('#pins .barre-rect').forEach(el => el.remove());
    document.querySelectorAll('#pins .barre-top-line').forEach(el => el.remove());
    
    // Verificar primeiro se há acordes com barré (múltiplas cordas na mesma casa)
    const fretCounts = {};
    strings.forEach((s, i) => {
        const fret = chord.frets[i];
        if (fret > 0) {
            fretCounts[fret] = (fretCounts[fret] || 0) + 1;
        }
    });
    
    // Mapear dedos para posições (apenas frets 1-4)
    const fingerPositions = {};
    const usedFrets = [];
    
    strings.forEach((s, i) => {
        const fret = chord.frets[i];
        if (fret > 0) {
            if (!usedFrets.includes(fret)) {
                usedFrets.push(fret);
            }
        }
    });
    
    // Ordenar frets e atribuir números de dedo (1-4)
    usedFrets.sort((a, b) => a - b);
    usedFrets.forEach((fret, index) => {
        fingerPositions[fret] = Math.min(index + 1, 4);
    });
    
    strings.forEach((s, i) => {
        const fret = chord.frets[i];
        if (fret === -1) {
            // Corda muda
            for (let f = 0; f <= 12; f++) {
                const el = document.getElementById(`pin-${s}-${f}`);
                if (el) el.classList.add('chord-muted');
            }
        } else if (fret === 0) {
            // Corda aberta - destaca com cor especial
            const id = `pin-${s}-${fret}`;
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('active');
                el.classList.add('open-string');
            }
        } else {
            // Destaca o pin da posição
            const id = `pin-${s}-${fret}`;
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('active');
            }
            
            const cx = parseFloat(el.getAttribute('cx'));
            const cy = parseFloat(el.getAttribute('cy'));
            
            // Determinar se esta posi73o faz parte de um barre (pestana)
            const isBarreChord = fretCounts[fret] >= 2;

            if (isBarreChord) {
                // Para pestana: desenhar um ret2ngulo arredondado cobrindo as cordas afetadas
                const pinsGroup = document.getElementById('pins');
                // localizar todos os cx das cordas que est3o nesse traste
                const cxList = [];
                strings.forEach((ss, ii) => {
                    if (chord.frets[ii] === fret) {
                        const p = document.getElementById(`pin-${ss}-${fret}`);
                        if (p) cxList.push(parseFloat(p.getAttribute('cx')));
                    }
                });
                if (cxList.length) {
                    const minX = Math.min(...cxList);
                    const maxX = Math.max(...cxList);
                    const barPadding = 14; // padding horizontal para a barra
                    const barHeight = 18; // altura da barra
                    const barX = minX - barPadding;
                    const barY = cy - barHeight/2;
                    const barW = (maxX - minX) + barPadding * 2;

                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('x', barX);
                    rect.setAttribute('y', barY);
                    rect.setAttribute('width', barW);
                    rect.setAttribute('height', barHeight);
                    rect.setAttribute('rx', Math.max(6, barHeight/2));
                    rect.setAttribute('class', 'barre-rect');
                    pinsGroup.appendChild(rect);

                    // ra rotulo do dedo sobre a barra (ex: 1, 2)
                    const fingerNum = fingerPositions[fret] || '';
                    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    label.setAttribute('x', (minX + maxX) / 2);
                    label.setAttribute('y', cy);
                    label.setAttribute('text-anchor', 'middle');
                    label.setAttribute('dominant-baseline', 'central');
                    label.setAttribute('class', 'barre-finger-label');
                    label.setAttribute('font-weight', '700');
                    label.textContent = fingerNum || '';
                    pinsGroup.appendChild(label);

                        // traço vertical que marca o barré (vai de cima a baixo das cordas afetadas)
                        const vertLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        // centralizar a linha vertical no centro da barra
                        const lineX = (barX + (barX + barW)) / 2;
                        // calcular y mínimo e máximo das cordas afetadas
                        const cyListAll = [];
                        strings.forEach((ss, ii) => {
                            const p = document.getElementById(`pin-${ss}-${fret}`);
                            if (p) cyListAll.push(parseFloat(p.getAttribute('cy')));
                        });
                        const minY = Math.min(...cyListAll);
                        const maxY = Math.max(...cyListAll);
                        const padY = 8;
                        vertLine.setAttribute('x1', lineX);
                        vertLine.setAttribute('x2', lineX);
                        vertLine.setAttribute('y1', minY - padY);
                        vertLine.setAttribute('y2', maxY + padY);
                        vertLine.setAttribute('class', 'barre-vertical-line');
                        vertLine.setAttribute('stroke-width', '4');
                        vertLine.setAttribute('stroke-linecap', 'round');
                        pinsGroup.appendChild(vertLine);
                }
                // marcar visualmente os pins individuais tamb9m
                el.classList.add('barre-chord');
            } else {
                // rptulo de dedo individual: usar ncmero com alto contraste
                const fingerNum = fingerPositions[fret] || '';
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', cx);
                text.setAttribute('y', cy);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'central');
                text.setAttribute('class', 'pin-finger-label');
                text.setAttribute('font-size', '14');
                text.setAttribute('font-weight', '700');
                // deixar o ncmero legavel sobre o pino (texto branco com contorno escuro)
                text.setAttribute('fill', '#ffffff');
                text.setAttribute('stroke', '#000000');
                text.setAttribute('stroke-width', '0.9');
                text.textContent = fingerNum;
                document.getElementById('pins').appendChild(text);
            }
        }
    });
    
    const positionsInfo = document.getElementById('chord-positions-info');
    if (positionsInfo) {
        const posStr = chord.frets.map((v, i) => {
            if (v === -1) return `${strings[i]}: X`;
            if (v === 0) return `${strings[i]}: 0`;
            return `${strings[i]}: ${v}`;
        }).join(' | ');
        
        // Verificar se há barré
        const hasBarreChord = Object.values(fretCounts).some(count => count >= 2);
        const barrInfo = hasBarreChord ? ' [Barré]' : '';
        
        positionsInfo.textContent = `${chord.name} — ${posStr}${barrInfo}`;
    }
}

function strumChord(chordKey) {
    const chord = CHORDS[chordKey];
    if (!chord) return;
    clearActivePins();
    const strings = ['E2','A2','D3','G3','B3','E4'];
    let i = 0;
    const max = strings.length;
    const interval = 120; // faster strum for better feel
    const strumId = setInterval(() => {
        document.querySelectorAll('#pins .pin.active').forEach(el => el.classList.remove('active'));
        const s = strings[i];
        const fret = chord.frets[i];
        if (fret >= 0) {
            const el = document.getElementById(`pin-${s}-${fret}`);
            if (el) el.classList.add('active');
            // If real samples were loaded, play them staggered; otherwise synth a tone
            if (notasSamples && notasSamples.length) {
                // play sample corresponding to this string index (mod samples length)
                const sampleBuf = notasSamples[i % notasSamples.length];
                try { playSample(sampleBuf, 0); } catch (e) { /* ignore */ }
            } else {
                const openFreq = NOTE_FREQUENCIES[s] ? NOTE_FREQUENCIES[s].open : null;
                if (openFreq && fret >= 0) {
                    const freq = openFreq * Math.pow(2, fret/12);
                    try { playTone(freq, 0.12, 'sine'); } catch(e) { /* ignore audio errors */ }
                }
            }
        }
        i++;
        if (i >= max) {
            clearInterval(strumId);
            showChord(chordKey);
        }
    }, interval);
}

/* Mapa de notas para cada corda e casa */
const NOTE_FREQUENCIES = {
    'E2': { open: 82.41, semitone: 'E' },
    'A2': { open: 110.00, semitone: 'A' },
    'D3': { open: 146.83, semitone: 'D' },
    'G3': { open: 196.00, semitone: 'G' },
    'B3': { open: 246.94, semitone: 'B' },
    'E4': { open: 329.63, semitone: 'E' }
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getNoteName(string, fret) {
    if (!NOTE_FREQUENCIES[string]) return 'N/A';
    const baseNote = NOTE_FREQUENCIES[string].semitone;
    const baseIndex = NOTE_NAMES.indexOf(baseNote);
    const noteIndex = (baseIndex + fret) % 12;
    const octave = Math.floor((baseIndex + fret) / 12);
    
    // Determina a oitava correta
    const baseOctave = parseInt(string.charAt(1));
    const finalOctave = baseOctave + octave;
    
    return `${NOTE_NAMES[noteIndex]}${finalOctave}`;
}

function showNotePosition(string, fret, stringSelect, fretSelect, noteInfo) {
    clearActivePins();
    
    const noteName = getNoteName(string, fret);
    const pinId = `pin-${string}-${fret}`;
    const pinEl = document.getElementById(pinId);
    
    if (pinEl) {
        pinEl.classList.add('active');
    }
    
    if (noteInfo) {
        noteInfo.textContent = `Corda: ${string} | Casa: ${fret} | Nota: ${noteName}`;
    }
}

function initNotasSection() {
    if (!document.getElementById('fretboard')) return;
    notesSequence = buildDefaultSequence();
    
    const playBtn = document.getElementById('play-notes-btn');
    const stopBtn = document.getElementById('stop-notes-btn');
    const prevBtn = document.getElementById('prev-note-btn');
    const nextBtn = document.getElementById('next-note-btn');
    
    if (playBtn) playBtn.addEventListener('click', playNotesSequence);
    if (stopBtn) stopBtn.addEventListener('click', stopNotesSequence);
    if (prevBtn) prevBtn.addEventListener('click', prevNote);
    if (nextBtn) nextBtn.addEventListener('click', nextNote);

    const chordSelect = document.getElementById('chord-select');
    const showChordBtn = document.getElementById('show-chord-btn');
    const strumChordBtn = document.getElementById('strum-chord-btn');
    const chordInfo = document.getElementById('chord-info');

    // populate chord select dynamically from CHORDS for consistency
    if (chordSelect) {
        // clear existing custom options except placeholder
        const placeholder = chordSelect.querySelector('option[value=""]');
        chordSelect.innerHTML = '';
        if (placeholder) chordSelect.appendChild(placeholder);
        // Use CHORDS_ALL to populate the select with full list and friendly names
        Object.keys(CHORDS_ALL).sort().forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = CHORDS_ALL[k] && CHORDS_ALL[k].name ? CHORDS_ALL[k].name : k;
            chordSelect.appendChild(opt);
        });
    }

    // show / strum button handlers with UI feedback
    if (showChordBtn) showChordBtn.addEventListener('click', () => {
        const chord = chordSelect ? chordSelect.value : '';
        if (chord) {
            showChord(chord);
            if (chordInfo) chordInfo.textContent = CHORDS[chord] ? `${CHORDS[chord].name}` : `Acorde: ${chord}`;
        }
    });
    if (strumChordBtn) strumChordBtn.addEventListener('click', () => {
        const chord = chordSelect ? chordSelect.value : '';
        if (chord) {
            // ensure audio context exists on user gesture
            try { ensureNotasAudioCtx(); } catch(e) { /* ignore */ }
            strumChord(chord);
            if (chordInfo) chordInfo.textContent = `Tocando: ${CHORDS[chord] ? CHORDS[chord].name : chord}`;
        }
    });
    if (chordSelect) chordSelect.addEventListener('change', () => {
        const chord = chordSelect.value;
        if (chordInfo) chordInfo.textContent = chord ? `Acorde selecionado: ${CHORDS[chord] ? CHORDS[chord].name : chord}` : '';
        if (showChordBtn) showChordBtn.disabled = !chord;
        if (strumChordBtn) strumChordBtn.disabled = !chord;
    });

    // initial enable/disable
    if (showChordBtn) showChordBtn.disabled = !chordSelect || !chordSelect.value;
    if (strumChordBtn) strumChordBtn.disabled = !chordSelect || !chordSelect.value;

    // Try to preload real strum samples from assets/samples/
    (async () => {
        const candidatePaths = [
            'assets/samples/strum1.mp3',
            'assets/samples/strum2.mp3',
            'assets/samples/strum3.mp3'
        ];
        for (let p of candidatePaths) {
            const buf = await loadSample(p);
            if (buf) notasSamples.push(buf);
        }
        // if any samples loaded, show small hint in chord-info
        if (notasSamples.length && chordInfo) {
            chordInfo.textContent = (chordInfo.textContent ? chordInfo.textContent + ' ' : '') + 'Samples reais carregados.';
        }

        // Also try to load persisted uploaded samples from IndexedDB
        try {
            const count = await loadSamplesFromDb();
            if (count > 0 && chordInfo) {
                chordInfo.textContent = (chordInfo.textContent ? chordInfo.textContent + ' ' : '') + `+ ${count} samples do usuário carregados.`;
            }
        } catch (e) {
            // ignore
        }
    })();

    // wire upload UI if present
    const sampleFileInput = document.getElementById('sample-file');
    const uploadBtn = document.getElementById('upload-sample-btn');
    const clearBtn = document.getElementById('clear-samples-btn');
    const uploaderMsg = document.getElementById('sample-uploader-msg');

    if (uploadBtn && sampleFileInput) {
        uploadBtn.addEventListener('click', async () => {
            const f = sampleFileInput.files && sampleFileInput.files[0];
            if (!f) {
                if (uploaderMsg) uploaderMsg.textContent = 'Escolha um arquivo primeiro.';
                return;
            }
            const arrayBuffer = await f.arrayBuffer();
            try {
                const ac = ensureNotasAudioCtx();
                const buf = await ac.decodeAudioData(arrayBuffer.slice(0));
                notasSamples.push(buf);
                await saveSampleToDb(f.name, arrayBuffer);
                if (uploaderMsg) uploaderMsg.textContent = `Sample ${f.name} carregado e salvo.`;
                if (chordInfo) chordInfo.textContent = 'Sample do usuário carregado.';
            } catch (e) {
                if (uploaderMsg) uploaderMsg.textContent = 'Falha ao decodificar o arquivo.';
            }
        });
    }

    // Preview uploaded file without saving
    const previewBtn = document.getElementById('preview-sample-btn');
    if (previewBtn && sampleFileInput) {
        previewBtn.addEventListener('click', async () => {
            const f = sampleFileInput.files && sampleFileInput.files[0];
            if (!f) {
                if (uploaderMsg) uploaderMsg.textContent = 'Escolha um arquivo para pré-visualizar.';
                return;
            }
            const arrayBuffer = await f.arrayBuffer();
            try {
                const ac = ensureNotasAudioCtx();
                const buf = await ac.decodeAudioData(arrayBuffer.slice(0));
                playSample(buf, 0);
                if (uploaderMsg) uploaderMsg.textContent = `Pré-visualizando ${f.name}`;
            } catch (e) {
                if (uploaderMsg) uploaderMsg.textContent = 'Falha ao decodificar para pré-visualização.';
            }
        });
    }

    // Generate example samples (synthesized) and save to DB
    const downloadBtn = document.getElementById('download-samples-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            try {
                const ex1 = generateExampleStrum(0.9);
                const ex2 = generateExampleStrum(0.7);
                notasSamples.push(ex1, ex2);
                // convert to wav ArrayBuffer and store
                const wav1 = audioBufferToWav(ex1);
                const wav2 = audioBufferToWav(ex2);
                await saveSampleToDb('example-strum-1.wav', wav1);
                await saveSampleToDb('example-strum-2.wav', wav2);
                if (uploaderMsg) uploaderMsg.textContent = 'Samples de exemplo gerados e salvos localmente.';
                if (chordInfo) chordInfo.textContent = 'Samples de exemplo carregados.';
            } catch (e) {
                if (uploaderMsg) uploaderMsg.textContent = 'Falha ao gerar samples de exemplo.';
            }
        });
    }

    // Download generated samples as WAV files
    const downloadFileBtn = document.getElementById('download-samples-file-btn');
    if (downloadFileBtn) {
        downloadFileBtn.addEventListener('click', async () => {
            try {
                // ensure we have at least two samples
                let bufs = [];
                if (notasSamples && notasSamples.length >= 2) {
                    bufs = [notasSamples[0], notasSamples[1]];
                } else {
                    bufs = [generateExampleStrum(0.9), generateExampleStrum(0.7)];
                }

                for (let i = 0; i < bufs.length; i++) {
                    const ab = audioBufferToWav(bufs[i]);
                    const blob = new Blob([ab], { type: 'audio/wav' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `example-strum-${i+1}.wav`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                }
                if (uploaderMsg) uploaderMsg.textContent = 'Download iniciado para samples de exemplo.';
            } catch (e) {
                if (uploaderMsg) uploaderMsg.textContent = 'Falha ao gerar arquivo para download.';
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            try {
                await clearSamplesDb();
                notasSamples.length = 0;
                if (uploaderMsg) uploaderMsg.textContent = 'Samples limpos.';
                if (chordInfo) chordInfo.textContent = '';
            } catch (e) {
                if (uploaderMsg) uploaderMsg.textContent = 'Falha ao limpar samples.';
            }
        });
    }

    // Configurador de acordes maiores e menores
    const noteBaseSelect = document.getElementById('note-base-select');
    const chordTypeSelect = document.getElementById('chord-type-select');
    const showChordPositionsBtn = document.getElementById('show-chord-positions-btn');
    const chordPositionsInfo = document.getElementById('chord-positions-info');

    const updateChordDisplay = () => {
        const noteBase = noteBaseSelect ? noteBaseSelect.value : '';
        const chordType = chordTypeSelect ? chordTypeSelect.value : '';
        if (noteBase && chordType) {
            showChordMajorMinor(noteBase, chordType);
        }
    };

    if (noteBaseSelect) {
        noteBaseSelect.addEventListener('change', updateChordDisplay);
    }

    if (chordTypeSelect) {
        chordTypeSelect.addEventListener('change', updateChordDisplay);
    }

    if (showChordPositionsBtn) {
        showChordPositionsBtn.addEventListener('click', updateChordDisplay);
    }

    // Configurador de notas
    const stringSelect = document.getElementById('string-select');
    const fretSelect = document.getElementById('fret-select');
    const showNotePositionBtn = document.getElementById('show-note-position-btn');
    const noteInfo = document.getElementById('note-info');

    if (showNotePositionBtn) {
        showNotePositionBtn.addEventListener('click', () => {
            const string = stringSelect ? stringSelect.value : '';
            const fret = fretSelect ? fretSelect.value : '';
            if (string && fret !== '') {
                showNotePosition(string, parseInt(fret), stringSelect, fretSelect, noteInfo);
            }
        });
    }

    if (stringSelect) {
        stringSelect.addEventListener('change', () => {
            const string = stringSelect.value;
            const fret = fretSelect ? fretSelect.value : '';
            if (string && fret !== '') {
                showNotePosition(string, parseInt(fret), stringSelect, fretSelect, noteInfo);
            }
        });
    }

    if (fretSelect) {
        fretSelect.addEventListener('change', () => {
            const string = stringSelect ? stringSelect.value : '';
            const fret = fretSelect.value;
            if (string && fret !== '') {
                showNotePosition(string, parseInt(fret), stringSelect, fretSelect, noteInfo);
            }
        });
    }
}
