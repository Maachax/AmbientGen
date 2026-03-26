# Ambient Room

Generative ambient music engine inspired by Philip Glass and minimalist composition. Six synthetic voices play short repeating patterns at the same tempo but with different cycle lengths, creating evolving textures through phasing — simple elements combining into complex, shifting soundscapes.

## How it works

The engine runs 6 voices, each with its own repeating pattern of different length (5, 7, 8, 9, 11, 16 steps). Because the cycles are different (often prime numbers), the patterns constantly shift against each other — a technique central to minimalist music. Only 2-4 voices play at any given time; the voice scheduler automatically fades instruments in and out over the course of minutes.

### Voices

| Voice | Role | Oscillator | Octave | Cycle |
|-------|------|-----------|--------|-------|
| **deepBass** | Sub-drone foundation | sine | 2 | 8 |
| **pad** | Sustained chord wash | triangle | 3 | 16 |
| **glass** | High bell-like figure | sine | 5 | 7 |
| **pulse** | Rhythmic pulsing note | triangle | 4 | 5 |
| **drift** | Slow melodic wanderer | sine | 4 | 11 |
| **shimmer** | High harmonic sparkle | sine | 6 | 9 |

## Quick start

```bash
npm install
npm start
```

Open http://localhost:5173 and click anywhere to start.

## API

```javascript
import * as Tone from "tone";
import { createMusicEngine } from "./core/musicEngine.js";

const engine = createMusicEngine({ bpm: 72, debug: true });
engine.initialize();

document.addEventListener("click", async () => {
  await Tone.start();
  engine.start();
}, { once: true });
```

### Controls

```javascript
engine.setBpm(80)              // tempo
engine.newScale()              // new harmony
engine.regenerateAll()         // fresh session (scale + patterns + bpm)
engine.regeneratePatterns()    // new patterns, same harmony

engine.setVoice("glass", true)   // force voice on
engine.setVoice("glass", false)  // force voice off
engine.releaseVoice("glass")     // return to auto scheduling
engine.toggleVoice("pulse")      // toggle override

engine.freeze()                // freeze all variations
engine.setReverb(3)            // reverb depth
engine.setHeadroom(-12)        // master volume (dB)
engine.setParameterDrift(false)  // disable slow parameter wandering
engine.setHumanize(true)       // micro-timing humanization

engine.getState()              // full engine state
```

## Architecture

```
ambient-room/
├── audio/
│   ├── engine.js           Audio graph (buses, effects, master chain)
│   ├── synths.js           6 synthetic voices with filter chains
│   ├── parameterDrift.js   Slow random wandering of parameters
│   └── voiceScheduler.js   Automatic voice entry/exit over time
├── theory/
│   ├── randomScale.js      Scale generation (weighted toward ambient modes)
│   └── chords.js           Chord progressions from scale degrees
├── rhythm/
│   └── patterns.js         Minimalist repeating pattern generation
├── utils/
│   └── generateConditionalArray.js
├── core/
│   └── musicEngine.js      Main orchestrator
├── example.js              Usage example
└── index.html              Minimal demo page
```

### Data flow

```
getRandomScale() → lydian, dorian, aeolian...
    ↓
getChordProgression(note, mode) → [I, IV, V, vi]
    ↓
note pool → per-voice note sequences (2-4 notes each)
    ↓
pattern managers (different cycle lengths per voice)
    ↓
main loop (Tone.Loop @ 16n)
    ↓
voice scheduler decides who plays
    ↓
active voices trigger notes through their chains
    ↓
audio graph (dry + effects → comp → limiter → out)
```

### Phasing example

With cycles of 5 and 7 steps, the patterns realign every 35 steps (LCM). During those 35 steps, every possible combination of the two patterns occurs exactly once — creating variety from pure repetition.

## Dependencies

- **Tone.js** — audio engine and transport
- **Tonal** — music theory (scales, modes, chords)
- **Vite** — dev server and build

## License

CC BY-NC-SA 4.0
