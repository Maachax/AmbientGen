import * as Tone from "tone";

// ============================================================
// Audio Engine — Ambient Room
// ============================================================
// Global audio graph: dry bus → parallel effects → master bus → comp → limiter → out
// Tuned for ambient/minimalist: long reverbs, gentle compression, warm filtering.

const bus = new Tone.Gain(Tone.dbToGain(-10));
const dryBus = new Tone.Gain(1).connect(bus);

// --- Reverb (medium hall) ---
const reverb = new Tone.Reverb({ decay: 7, wet: 1, preDelay: 0.06 });
const reverbHP = new Tone.Filter({ type: "highpass", frequency: 200, Q: 0.6 });
const reverbLP = new Tone.Filter({ type: "lowpass", frequency: 5200, Q: 0.4 });
const reverbWet = new Tone.Gain(0.7).connect(bus);
reverb.chain(reverbHP, reverbLP, reverbWet);

// --- Long reverb (cathedral) ---
const longReverb = new Tone.Reverb({ decay: 12, wet: 1, preDelay: 0.1 });
const longRevHP = new Tone.Filter({ type: "highpass", frequency: 160, Q: 0.5 });
const longRevLP = new Tone.Filter({ type: "lowpass", frequency: 4000, Q: 0.4 });
const longReverbWet = new Tone.Gain(0.55).connect(bus);
longReverb.chain(longRevHP, longRevLP, longReverbWet);

// --- Delay (rhythmic echoes) ---
const delay = new Tone.FeedbackDelay({ delayTime: 0.3, feedback: 0.35, wet: 1 });
const delayWet = new Tone.Gain(0.18).connect(bus);
delay.connect(delayWet);

// --- Vibrato ---
const vibrato = new Tone.Vibrato({ frequency: 4, depth: 0.12, wet: 1 });
const vibratoWet = new Tone.Gain(0.15).connect(bus);
vibrato.connect(vibratoWet);

// --- Chorus ---
const chorus = new Tone.Chorus({ frequency: 0.8, depth: 0.35, wet: 1 }).start();
const chorusWet = new Tone.Gain(0.14).connect(bus);
chorus.connect(chorusWet);

// --- Master chain ---
const lowpass = new Tone.Filter(8000, "lowpass");
const comp = new Tone.Compressor({
  threshold: -20,
  ratio: 2.5,
  attack: 0.02,
  release: 0.3,
});
const limiter = new Tone.Limiter(-1);
const meter = new Tone.Meter();

bus.chain(lowpass, comp, limiter, Tone.getDestination());
bus.connect(meter);

export const audioGraph = {
  bus,
  dryBus,
  optional: { reverb, longReverb, delay, vibrato, chorus },
  wet: {
    reverb: reverbWet,
    longReverb: longReverbWet,
    delay: delayWet,
    vibrato: vibratoWet,
    chorus: chorusWet,
  },
  lowpass,
  comp,
  limiter,
  meter,
};

export function setGlobalHeadroom(db = -10) {
  bus.gain.rampTo(Tone.dbToGain(db), 0.05);
}

export function setEffectWet(effectName, linearValue) {
  const g = audioGraph.wet[effectName];
  if (g) g.gain.rampTo(linearValue, 0.1);
}

export function setReverbDepth(factor = 1) {
  factor = Math.max(0, factor);
  reverb.decay = Math.min(7 + factor * 3, 14);
  longReverb.decay = Math.min(12 + factor * 4, 20);
  const wetScale = Math.min(1.3, 1 + factor * 0.3);
  audioGraph.wet.reverb.gain.rampTo(0.7 * wetScale, 0.4);
  audioGraph.wet.longReverb.gain.rampTo(0.55 * wetScale, 0.5);
}

export function getMeterLevel() {
  return meter.getValue();
}

export function getCurrentHeadroomDb() {
  return Tone.gainToDb(bus.gain.value);
}

export function initAudioTransport() {
  if (!Tone.Transport.state || Tone.Transport.state === "stopped") {
    Tone.Transport.bpm.value = 72;
  }
}
