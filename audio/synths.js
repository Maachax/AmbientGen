import * as Tone from "tone";
import { audioGraph } from "./engine.js";

// ============================================================
// Ambient Room — 6 Synthetic Voices
// ============================================================
// Each voice has: inner synth → filter → gain → routing (dry + effects)
// All pure synthesis: sine, triangle, pads. No samples.
//
// Voice roles:
//   1. deepBass    — Sub-drone layer (sine, very low)
//   2. pad         — Sustained chord pad (triangle, warm)
//   3. glass       — High bell-like repeating figure (sine, bright)
//   4. pulse       — Rhythmic pulsing note (triangle, mid)
//   5. drift       — Slow melodic wanderer (sine, mid-high)
//   6. shimmer     — High harmonic sparkle (sine, very high, quiet)

function createVoice({ name, oscType, envelope, filterFreq, filterQ, gainDb, polyphony }) {
  const isPolyphonic = polyphony && polyphony > 1;

  const inner = isPolyphonic
    ? new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: polyphony,
        oscillator: { type: oscType },
        envelope,
      })
    : new Tone.Synth({
        oscillator: { type: oscType },
        envelope,
      });

  const filter = new Tone.Filter({
    type: "lowpass",
    frequency: filterFreq,
    rolloff: -24,
    Q: filterQ,
  });

  const gain = new Tone.Gain(Tone.dbToGain(gainDb));

  // Fade gain for smooth entry/exit (controlled by voice scheduler)
  const fadeGain = new Tone.Gain(0); // starts silent

  inner.chain(filter, gain, fadeGain);

  // Routing to buses
  fadeGain.connect(audioGraph.dryBus);

  // Create a proxy so we can call triggerAttackRelease etc. on the voice directly
  const proxy = new Proxy(fadeGain, {
    get(target, prop, receiver) {
      if (prop === "_inner") return inner;
      if (prop === "filter") return filter;
      if (prop === "gain") return gain;
      if (prop === "fadeGain") return fadeGain;
      if (prop === "name") return name;
      if (prop in target) return Reflect.get(target, prop, receiver);
      const val = inner[prop];
      return typeof val === "function" ? val.bind(inner) : val;
    },
    set(target, prop, value, receiver) {
      if (prop in target) return Reflect.set(target, prop, value, receiver);
      inner[prop] = value;
      return true;
    },
  });

  return proxy;
}

// --- Voice definitions ---

const deepBass = createVoice({
  name: "deepBass",
  oscType: "sine",
  envelope: { attack: 0.3, decay: 0.5, sustain: 0.7, release: 2.0 },
  filterFreq: 200,
  filterQ: 0.3,
  gainDb: -8,
});

const pad = createVoice({
  name: "pad",
  oscType: "triangle",
  envelope: { attack: 0.8, decay: 1.2, sustain: 0.6, release: 3.0 },
  filterFreq: 2200,
  filterQ: 0.4,
  gainDb: -14,
  polyphony: 4,
});

const glass = createVoice({
  name: "glass",
  oscType: "sine",
  envelope: { attack: 0.005, decay: 0.8, sustain: 0.1, release: 1.8 },
  filterFreq: 6000,
  filterQ: 0.6,
  gainDb: -18,
});

const pulse = createVoice({
  name: "pulse",
  oscType: "triangle",
  envelope: { attack: 0.01, decay: 0.4, sustain: 0.3, release: 1.0 },
  filterFreq: 3000,
  filterQ: 0.5,
  gainDb: -16,
});

const drift = createVoice({
  name: "drift",
  oscType: "sine",
  envelope: { attack: 0.15, decay: 0.6, sustain: 0.5, release: 2.5 },
  filterFreq: 4000,
  filterQ: 0.3,
  gainDb: -17,
});

const shimmer = createVoice({
  name: "shimmer",
  oscType: "sine",
  envelope: { attack: 0.01, decay: 1.0, sustain: 0.05, release: 2.0 },
  filterFreq: 8000,
  filterQ: 0.7,
  gainDb: -22,
});

// --- Effect routing per voice ---
function routeToEffects(voice, effectNames) {
  for (const name of effectNames) {
    const eff = audioGraph.optional[name];
    if (eff) voice.fadeGain.connect(eff);
  }
}

routeToEffects(deepBass, ["reverb", "longReverb"]);
routeToEffects(pad, ["reverb", "longReverb", "chorus"]);
routeToEffects(glass, ["reverb", "delay"]);
routeToEffects(pulse, ["reverb", "delay", "vibrato"]);
routeToEffects(drift, ["longReverb", "vibrato", "chorus"]);
routeToEffects(shimmer, ["longReverb", "delay"]);

// --- All voices as ordered array ---
const voices = [deepBass, pad, glass, pulse, drift, shimmer];

const voicesByName = {
  deepBass,
  pad,
  glass,
  pulse,
  drift,
  shimmer,
};

export { voices, voicesByName, deepBass, pad, glass, pulse, drift, shimmer };
