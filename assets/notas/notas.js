// Notas (Fretboard) Logic
const playNotesBtn = document.getElementById('play-notes-btn');
const stopNotesBtn = document.getElementById('stop-notes-btn');
const prevNoteBtn = document.getElementById('prev-note-btn');
const nextNoteBtn = document.getElementById('next-note-btn');

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
    
    // Remove textos anteriores de numeração de dedos
    document.querySelectorAll('#pins text').forEach(el => el.remove());
    
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
            
            // Adiciona número do dedo com melhor posicionamento
            const fingerNum = fingerPositions[fret];
            const cx = parseFloat(el.getAttribute('cx'));
            const cy = parseFloat(el.getAttribute('cy'));
            
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', cx);
            text.setAttribute('y', cy);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'central');
            text.setAttribute('class', 'pin-finger-label');
            text.setAttribute('font-size', '13');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('fill', '#1a1a1a');
            text.textContent = fingerNum;
            
            document.getElementById('pins').appendChild(text);
        }
    });
    
    // Verificar se há acordes com barré (múltiplas cordas na mesma casa)
    const fretCounts = {};
    strings.forEach((s, i) => {
        const fret = chord.frets[i];
        if (fret > 0) {
            fretCounts[fret] = (fretCounts[fret] || 0) + 1;
        }
    });
    
    // Aplicar classe de barré
    Object.entries(fretCounts).forEach(([fret, count]) => {
        if (count >= 2) {
            strings.forEach((s, i) => {
                if (chord.frets[i] === parseInt(fret)) {
                    const el = document.getElementById(`pin-${s}-${fret}`);
                    if (el) el.classList.add('barre-chord');
                }
            });
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
    const interval = 180;
    const strumId = setInterval(() => {
        document.querySelectorAll('#pins .pin.active').forEach(el => el.classList.remove('active'));
        const s = strings[i];
        const fret = chord.frets[i];
        if (fret >= 0) {
            const el = document.getElementById(`pin-${s}-${fret}`);
            if (el) el.classList.add('active');
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

    if (showChordBtn) showChordBtn.addEventListener('click', () => {
        const chord = chordSelect ? chordSelect.value : '';
        if (chord) showChord(chord);
    });
    if (strumChordBtn) strumChordBtn.addEventListener('click', () => {
        const chord = chordSelect ? chordSelect.value : '';
        if (chord) strumChord(chord);
    });
    if (chordSelect) chordSelect.addEventListener('change', () => {
        const chord = chordSelect.value;
        if (chordInfo) chordInfo.textContent = chord ? `Acorde selecionado: ${chord}` : '';
    });

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
