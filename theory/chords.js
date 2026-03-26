import { Scale, Mode, Chord } from "tonal";

// ============================================================
// Chord Progression — Ambient Room
// ============================================================
// Simpler than original: generates a 4-chord progression from scale degrees.
// Favors open, consonant movements (I-IV-V-vi style).
// Returns root notes + seventh chord voicings for melody pool.

const CADENCE_PATTERNS = [
  [1, 4, 5, 1],
  [1, 6, 4, 5],
  [1, 4, 6, 5],
  [1, 3, 4, 1],
  [1, 5, 6, 4],
  [6, 4, 1, 5],
  [1, 2, 4, 1],
  [1, 4, 1, 5],
];

function pickCadence() {
  return CADENCE_PATTERNS[Math.floor(Math.random() * CADENCE_PATTERNS.length)].slice();
}

export function getChordProgression(randomNote, randomMode) {
  const degreesProgression = pickCadence();
  const scaleDegreesFn = Scale.degrees(`${randomNote} ${randomMode}`);
  const seventhChords = Mode.seventhChords(randomMode, randomNote);

  const chordProgression = degreesProgression.map(scaleDegreesFn);

  const seventhChordVoicings = degreesProgression.map((d) => {
    const idx = d - 1;
    return Chord.get(seventhChords[idx]).notes;
  });

  return {
    chordProgression,
    seventhChords,
    degreesProgression,
    seventhChordVoicings,
  };
}
