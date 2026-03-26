import { Mode } from "tonal";

// ============================================================
// Random Scale Generator
// ============================================================
// For ambient/minimalist: we favor modes that sound contemplative.
// Weighted selection: ionian, dorian, aeolian, mixolydian, lydian get higher weight.

const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const AMBIENT_MODE_WEIGHTS = {
  ionian: 3,
  dorian: 4,
  phrygian: 1,
  lydian: 5,      // dreamy, floating
  mixolydian: 3,
  aeolian: 4,     // melancholic, contemplative
  locrian: 0.5,
};

function weightedPickMode() {
  const allModes = Mode.names();
  const entries = allModes.map((m) => ({
    name: m,
    weight: AMBIENT_MODE_WEIGHTS[m] || 1,
  }));
  let total = entries.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e.name;
  }
  return entries[entries.length - 1].name;
}

export function getRandomScale() {
  const randomNote = notes[Math.floor(Math.random() * notes.length)];
  const randomMode = weightedPickMode();
  return { randomNote, randomMode };
}
