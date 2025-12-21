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
