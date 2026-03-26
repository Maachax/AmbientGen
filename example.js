/**
 * Ambient Room — Minimal Usage Example
 * ======================================
 */

import * as Tone from "tone";
import { createMusicEngine } from "./core/musicEngine.js";

// 1. Create engine
const engine = createMusicEngine({
  bpm: 72,
  debug: true,
  humanize: true,
  reverbDepth: 2,
  globalHeadroom: -10,
});

// 2. Initialize (sets up audio graph, patterns, voice scheduler)
engine.initialize();

// 3. Start on user gesture (required by browsers)
document.addEventListener(
  "click",
  async () => {
    await Tone.start();
    engine.start();
    console.log("Ambient Room started");
  },
  { once: true }
);

// 4. Expose to console for experimentation
window.engine = engine;

console.log(`
╔══════════════════════════════════════════╗
║         AMBIENT ROOM — Console API       ║
╠══════════════════════════════════════════╣
║                                          ║
║  engine.start()           Start          ║
║  engine.stop()            Stop           ║
║  engine.pause() / .resume()              ║
║                                          ║
║  engine.setBpm(80)        Tempo          ║
║  engine.newScale()        New harmony    ║
║  engine.regenerateAll()   Fresh session  ║
║                                          ║
║  engine.setVoice("glass", true)  On      ║
║  engine.setVoice("glass", false) Off     ║
║  engine.releaseVoice("glass")    Auto    ║
║  engine.toggleVoice("glass")             ║
║                                          ║
║  Voices: deepBass, pad, glass,           ║
║          pulse, drift, shimmer           ║
║                                          ║
║  engine.freeze()          Freeze         ║
║  engine.setReverb(3)      More reverb    ║
║  engine.getState()        Full state     ║
║                                          ║
╚══════════════════════════════════════════╝
`);
