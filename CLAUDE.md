# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start       # Dev server at localhost:5173 (auto-opens browser)
npm run build   # Production build → dist/
npm run preview # Preview production build
```

There are no tests or linter configured.

## Architecture

**Ambient Room** is a generative ambient music engine inspired by Philip Glass's minimalist phasing technique. It runs entirely in the browser using [Tone.js](https://tonejs.github.io/) (audio scheduling/synthesis) and [Tonal](https://github.com/tonaljs/tonal) (music theory).

### Module Roles

| Module | Responsibility |
|---|---|
| `core/musicEngine.js` | Central orchestrator; owns the main `Tone.Loop` at 16th notes, manages harmony state (scale, chord progression), coordinates all other modules, exposes the public API |
| `audio/engine.js` | Audio graph: routes all voices through shared effects (reverb ×2, delay, vibrato, chorus) then a master chain (lowpass → compressor → limiter) |
| `audio/synths.js` | Instantiates 6 `Tone.Synth`/`PolySynth` voices, each with its own filter + gain + fade gain node and effect routing |
| `audio/voiceScheduler.js` | Dynamically fades 2–4 voices in/out over seconds; supports manual overrides |
| `audio/parameterDrift.js` | Registers parameters (filter cutoffs, reverb decay, delay feedback) and slowly wanders them via `Tone.js` exponential ramps on a measure-based schedule |
| `theory/randomScale.js` | Picks a random root + mode, weighted toward Lydian/Aeolian/Dorian |
| `theory/chords.js` | Builds 4-chord progressions with seventh-chord voicings from a set of 8 cadence patterns |
| `rhythm/patterns.js` | Generates and manages per-voice step patterns; supports mutation (shift one note ±1 step) and full regeneration |

### Signal Flow

```
Voices (6 synths)
  → dry bus
  → parallel effects (reverb, longReverb, delay, vibrato, chorus)
  → master lowpass (8kHz)
  → compressor (–20 dB threshold, 2.5:1)
  → limiter (–1 dB)
  → Tone.Destination
```

### Phasing Core Concept

Each of the 6 voices has a prime or distinct cycle length (5, 7, 8, 9, 11, 16 steps). Because these lengths share no common factor, the combined pattern evolves continuously and never repeats in a perceptible short-term window. This is the core musical algorithm.

### Main Loop Timing (at 72 BPM default)

- Every tick (16th note): check each voice's pattern, trigger notes
- Every 64 ticks (4 bars): advance chord index within current progression
- Every 128 ticks (8 bars): mutate all patterns
- Every 256 ticks (16 bars): generate a new chord progression (and optionally new scale)
- Every measure: voice scheduler tick, parameter drift tick

### Entry Points

- `index.html` + `example.js` — minimal click-to-start UI; exposes `window.engine` for live console control
- `core/musicEngine.js` → `createMusicEngine(config)` — factory function, returns the public API

### Public API (from `createMusicEngine`)

Key methods: `start()`, `stop()`, `pause()`, `resume()`, `newScale()`, `setBpm(bpm)`, `setReverb(depth)`, `setHeadroom(db)`, `setHumanize(bool)`, `setParameterDrift(bool)`, `setVoice(name, enabled)`, `toggleVoice(name)`, `releaseVoice(name)`, `regeneratePatterns()`, `regenerateAll()`, `getState()`, `getVoices()`.

### Voice Names

`deepBass`, `pad`, `glass`, `pulse`, `drift`, `shimmer`

### Audio Context Requirement

Browsers require a user gesture before audio can start. `Tone.start()` must be called inside a click/touch handler before `engine.start()`.
