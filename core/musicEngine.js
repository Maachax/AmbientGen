/**
 * Ambient Room — Music Engine
 * ============================================================
 * Minimalist generative engine inspired by Philip Glass.
 *
 * Core idea: 6 voices play short repeating patterns on the same tempo
 * but with different cycle lengths (e.g. 5, 7, 8, 6, 9, 11 steps).
 * Because cycles are coprime or different, patterns phase against
 * each other creating evolving textures from simple elements.
 *
 * Not all voices play at once — a voice scheduler fades voices
 * in and out over time (2-4 active simultaneously).
 *
 * Each voice picks notes from the current chord/scale, playing
 * a small fixed set of 2-4 notes in its pattern, repeating.
 */

import * as Tone from "tone";
import {
  initAudioTransport,
  audioGraph,
  setReverbDepth,
  setGlobalHeadroom,
  getCurrentHeadroomDb,
} from "../audio/engine.js";
import { voices, voicesByName } from "../audio/synths.js";
import { createParameterDrift } from "../audio/parameterDrift.js";
import { createVoiceScheduler } from "../audio/voiceScheduler.js";
import { getRandomScale } from "../theory/randomScale.js";
import { getChordProgression } from "../theory/chords.js";
import { createPatternManager } from "../rhythm/patterns.js";

export function createMusicEngine(config = {}) {
  // ========================
  // CONFIGURATION
  // ========================
  const {
    bpm = 72,
    debug = false,
    humanize = true,
    reverbDepth = 2,
    globalHeadroom = -10,
  } = config;

  let DEBUG = debug;
  const log = (...args) => { if (DEBUG) console.log("[AmbientRoom]", ...args); };

  // Humanization
  const HUMANIZE_MAX_MS = 0.025;
  let humanizeEnabled = humanize;

  function humanizeTime(time) {
    if (!humanizeEnabled) return time;
    const delta = Math.random() * HUMANIZE_MAX_MS;
    return time + delta;
  }

  // ========================
  // GLOBAL STATE
  // ========================
  let beatIndex = 0;     // global tick counter (16th notes)
  let chordIndex = 0;
  let loopCount = 0;
  let freezeVariations = false;

  // Regeneration intervals (in 16th-note ticks)
  const CHORD_CHANGE_TICKS = 64;     // change chord every 64 ticks (4 bars)
  const PROG_CHANGE_TICKS = 256;     // new progression every 16 bars
  const PATTERN_MUTATE_TICKS = 128;  // mutate patterns every 8 bars

  // ========================
  // HARMONY
  // ========================
  let { randomNote, randomMode } = getRandomScale();
  let chordsProg = getChordProgression(randomNote, randomMode);
  log("Scale:", randomNote, randomMode);
  log("Progression:", chordsProg.chordProgression);

  // Build note pool from chord voicings
  function buildNotePool(prog) {
    const pool = [];
    for (const voicing of prog.seventhChordVoicings) {
      for (const n of voicing) {
        if (!pool.includes(n)) pool.push(n);
      }
    }
    return pool;
  }

  let notePool = buildNotePool(chordsProg);

  function currentChordNotes() {
    return chordsProg.seventhChordVoicings[chordIndex] || notePool.slice(0, 4);
  }

  // ========================
  // VOICE CONFIGURATIONS
  // ========================
  // Each voice has its own cycle length, density, octave, and note picking strategy.
  // Different cycle lengths = phasing effect (core of the Glass aesthetic).

  const VOICE_CONFIGS = {
    deepBass: {
      cycleLength: 8,
      density: 0.25,
      octave: 2,
      noteStrategy: "root",       // always plays root
      duration: "2n",
      mutateEvery: 256,
      regenEvery: 512,
    },
    pad: {
      cycleLength: 16,
      density: 0.2,
      octave: 3,
      noteStrategy: "chord",      // plays full chord
      duration: "1n",
      mutateEvery: 256,
      regenEvery: 512,
    },
    glass: {
      cycleLength: 7,             // prime number = nice phasing
      density: 0.5,
      octave: 5,
      noteStrategy: "sequence",   // cycles through a small note set
      duration: "8n",
      mutateEvery: 96,
      regenEvery: 384,
    },
    pulse: {
      cycleLength: 5,             // prime = maximum phasing
      density: 0.6,
      octave: 4,
      noteStrategy: "sequence",
      duration: "16n",
      mutateEvery: 80,
      regenEvery: 320,
    },
    drift: {
      cycleLength: 11,            // prime
      density: 0.35,
      octave: 4,
      noteStrategy: "sequence",
      duration: "4n",
      mutateEvery: 128,
      regenEvery: 512,
    },
    shimmer: {
      cycleLength: 9,
      density: 0.4,
      octave: 6,
      noteStrategy: "sequence",
      duration: "16n",
      mutateEvery: 64,
      regenEvery: 256,
    },
  };

  // ========================
  // PATTERN MANAGERS (one per voice)
  // ========================
  const patternManagers = {};
  const voiceNoteSequences = {}; // per-voice note sequences for "sequence" strategy
  const voiceSeqIndex = {};      // current position in note sequence

  function initPatterns() {
    for (const [name, cfg] of Object.entries(VOICE_CONFIGS)) {
      patternManagers[name] = createPatternManager({
        cycleLength: cfg.cycleLength,
        density: cfg.density,
        mutateEvery: cfg.mutateEvery,
        regenEvery: cfg.regenEvery,
        mutationProbability: 0.3,
      });
      regenerateNoteSequence(name);
    }
  }

  function regenerateNoteSequence(voiceName) {
    const cfg = VOICE_CONFIGS[voiceName];
    if (cfg.noteStrategy === "sequence") {
      // Pick 3-5 notes from current chord/pool
      const chordNotes = currentChordNotes();
      const count = 2 + Math.floor(Math.random() * 3); // 2-4 notes
      const seq = [];
      for (let i = 0; i < count; i++) {
        seq.push(chordNotes[i % chordNotes.length]);
      }
      voiceNoteSequences[voiceName] = seq;
      voiceSeqIndex[voiceName] = 0;
    }
  }

  function regenerateAllNoteSequences() {
    for (const name of Object.keys(VOICE_CONFIGS)) {
      regenerateNoteSequence(name);
    }
  }

  // ========================
  // VOICE SCHEDULER
  // ========================
  let voiceScheduler = null;

  // ========================
  // PARAMETER DRIFT
  // ========================
  let paramDrift = null;
  let paramDriftEnabled = true;

  function initParameterDrift() {
    if (paramDrift) return;
    paramDrift = createParameterDrift({ debug: DEBUG, immediateFirstApply: true });

    // Drift voice filters
    for (const v of voices) {
      if (v.filter) {
        const baseFreq = v.filter.frequency.value;
        paramDrift.addTarget({
          name: `${v.name}_filter`,
          getter: () => v.filter.frequency.value,
          apply: (val, dur) => v.filter.frequency.rampTo(val, dur),
          range: [baseFreq * 0.6, baseFreq * 1.4],
          stepMeasures: [10, 24],
          rampMeasures: [3, 8],
        });
      }
    }

    // Drift reverb
    if (audioGraph?.optional?.reverb) {
      paramDrift.addTarget({
        name: "reverbDecay",
        getter: () => audioGraph.optional.reverb.decay,
        apply: (v) => (audioGraph.optional.reverb.decay = v),
        range: [4, 10],
        stepMeasures: [16, 40],
        rampMeasures: [4, 12],
      });
    }

    // Drift delay feedback
    if (audioGraph?.optional?.delay) {
      paramDrift.addTarget({
        name: "delayFeedback",
        getter: () => audioGraph.optional.delay.feedback.value,
        apply: (v, dur) => audioGraph.optional.delay.feedback.rampTo(v, dur),
        range: [0.2, 0.4],
        stepMeasures: [12, 28],
        rampMeasures: [3, 6],
      });
    }

    if (paramDriftEnabled) paramDrift.start();
  }

  // ========================
  // NOTE PICKING
  // ========================
  function getNoteForVoice(voiceName, time) {
    const cfg = VOICE_CONFIGS[voiceName];

    switch (cfg.noteStrategy) {
      case "root":
        return `${chordsProg.chordProgression[chordIndex]}${cfg.octave}`;

      case "chord":
        // Return array of notes for PolySynth
        return currentChordNotes().map((n) => `${n}${cfg.octave}`);

      case "sequence": {
        const seq = voiceNoteSequences[voiceName];
        if (!seq || seq.length === 0) return null;
        const idx = voiceSeqIndex[voiceName] || 0;
        const note = `${seq[idx]}${cfg.octave}`;
        voiceSeqIndex[voiceName] = (idx + 1) % seq.length;
        return note;
      }

      default:
        return null;
    }
  }

  // ========================
  // MAIN LOOP
  // ========================
  const mainLoop = new Tone.Loop((time) => {
    beatIndex++;

    // --- Chord change ---
    if (beatIndex % CHORD_CHANGE_TICKS === 0) {
      chordIndex = (chordIndex + 1) % chordsProg.chordProgression.length;
      log("Chord →", chordsProg.chordProgression[chordIndex]);
      // On chord change, refresh note sequences so voices adapt
      regenerateAllNoteSequences();
    }

    // --- New progression ---
    if (!freezeVariations && beatIndex % PROG_CHANGE_TICKS === 0) {
      chordsProg = getChordProgression(randomNote, randomMode);
      notePool = buildNotePool(chordsProg);
      chordIndex = 0;
      regenerateAllNoteSequences();
      log("New progression:", chordsProg.chordProgression);
    }

    // --- Pattern mutations ---
    if (!freezeVariations) {
      for (const name of Object.keys(patternManagers)) {
        patternManagers[name].tick();
      }
    }

    // --- Trigger voices ---
    const activeNames = voiceScheduler ? voiceScheduler.getActiveNames() : [];

    for (const name of activeNames) {
      const pm = patternManagers[name];
      const cfg = VOICE_CONFIGS[name];
      if (!pm || !cfg) continue;

      const stepInCycle = beatIndex % pm.getCycleLength();

      if (pm.shouldTrigger(stepInCycle)) {
        const voice = voicesByName[name];
        if (!voice) continue;

        const noteOrNotes = getNoteForVoice(name, time);
        if (!noteOrNotes) continue;

        try {
          if (Array.isArray(noteOrNotes)) {
            // Polyphonic (pad)
            voice.triggerAttackRelease(noteOrNotes, cfg.duration, humanizeTime(time));
          } else {
            voice.triggerAttackRelease(noteOrNotes, cfg.duration, humanizeTime(time));
          }
        } catch (e) {
          log("trigger error", name, e.message);
        }
      }
    }

    // --- Loop counter ---
    loopCount++;
    if (loopCount > 1_000_000_000) loopCount = 1;

    // --- Debug ---
    if (DEBUG && beatIndex % 128 === 0) {
      log("beat:", beatIndex, "active:", activeNames.join(", "),
        "chord:", chordsProg.chordProgression[chordIndex],
        "peak:", audioGraph.meter.getValue().toFixed(1), "dBFS");
    }
  }, "16n");

  // ========================
  // INITIALIZATION
  // ========================
  function initialize() {
    initAudioTransport();
    Tone.getTransport().bpm.value = bpm;
    setGlobalHeadroom(globalHeadroom);
    setReverbDepth(reverbDepth);
    initPatterns();
    voiceScheduler = createVoiceScheduler(voices, { debug: DEBUG });
    initParameterDrift();
    log("Initialized at", bpm, "BPM");
  }

  // ========================
  // PUBLIC API
  // ========================
  return {
    initialize,

    start() {
      if (Tone.getContext().state !== "running") {
        console.warn("[AmbientRoom] Call Tone.start() first (requires user gesture).");
        return;
      }
      voiceScheduler.start();
      mainLoop.start(0);
      Tone.getTransport().start();
      log("Started");
    },

    stop() {
      Tone.getTransport().stop();
      mainLoop.stop();
      if (voiceScheduler) voiceScheduler.stop();
      log("Stopped");
    },

    pause() {
      Tone.getTransport().pause();
      log("Paused");
    },

    resume() {
      Tone.getTransport().start();
      log("Resumed");
    },

    // --- Tempo ---
    setBpm(newBpm) {
      Tone.getTransport().bpm.rampTo(newBpm, 0.5);
      log("BPM →", newBpm);
    },

    getBpm() {
      return Tone.getTransport().bpm.value;
    },

    // --- Harmony ---
    newScale() {
      const { randomNote: rn, randomMode: rm } = getRandomScale();
      randomNote = rn;
      randomMode = rm;
      chordsProg = getChordProgression(randomNote, randomMode);
      notePool = buildNotePool(chordsProg);
      chordIndex = 0;
      regenerateAllNoteSequences();
      log("New scale:", randomNote, randomMode);
      return { note: randomNote, mode: randomMode };
    },

    getScale() {
      return { note: randomNote, mode: randomMode };
    },

    // --- Voice control (manual override) ---
    setVoice(name, enabled) {
      if (voiceScheduler) voiceScheduler.setVoice(name, enabled);
    },

    releaseVoice(name) {
      if (voiceScheduler) voiceScheduler.releaseVoice(name);
    },

    toggleVoice(name) {
      if (voiceScheduler) return voiceScheduler.toggleVoice(name);
    },

    // --- Pattern control ---
    regeneratePatterns() {
      for (const name of Object.keys(patternManagers)) {
        patternManagers[name].forceRegenerate();
        regenerateNoteSequence(name);
      }
      log("All patterns regenerated");
    },

    // --- Full regeneration ---
    regenerateAll() {
      const { randomNote: rn, randomMode: rm } = getRandomScale();
      randomNote = rn;
      randomMode = rm;
      chordsProg = getChordProgression(randomNote, randomMode);
      notePool = buildNotePool(chordsProg);
      chordIndex = 0;
      beatIndex = 0;
      loopCount = 0;

      for (const name of Object.keys(patternManagers)) {
        patternManagers[name].forceRegenerate();
        regenerateNoteSequence(name);
      }

      if (voiceScheduler) voiceScheduler.forceRethink();

      const newBpm = 60 + Math.floor(Math.random() * 30); // 60-90 BPM
      Tone.getTransport().bpm.rampTo(newBpm, 1);

      log("Full regeneration:", randomNote, randomMode, "at", newBpm, "BPM");
      return { note: randomNote, mode: randomMode, bpm: newBpm };
    },

    // --- Variations ---
    freeze(state = null) {
      freezeVariations = state !== null ? state : !freezeVariations;
      log("Freeze:", freezeVariations);
      return freezeVariations;
    },

    // --- Parameters ---
    setHumanize(state) {
      humanizeEnabled = state;
    },

    setReverb(depth) {
      setReverbDepth(depth);
    },

    setHeadroom(db) {
      setGlobalHeadroom(db);
    },

    setParameterDrift(enabled) {
      paramDriftEnabled = enabled;
      if (paramDrift) {
        if (enabled) paramDrift.start();
        else paramDrift.stop();
      }
    },

    setDebug(enabled) {
      DEBUG = enabled;
      return DEBUG;
    },

    // --- State ---
    getState() {
      return {
        beatIndex,
        chordIndex,
        loopCount,
        currentChord: chordsProg.chordProgression[chordIndex],
        scale: { note: randomNote, mode: randomMode },
        progression: chordsProg.chordProgression.slice(),
        bpm: Tone.getTransport().bpm.value,
        voices: voiceScheduler ? voiceScheduler.getStates() : [],
        patterns: Object.fromEntries(
          Object.entries(patternManagers).map(([k, pm]) => [k, pm.getPattern()])
        ),
        freezeVariations,
        humanizeEnabled,
        paramDriftEnabled,
        peakLevel: audioGraph.meter.getValue(),
        headroom: getCurrentHeadroomDb(),
      };
    },

    getVoices() {
      return voicesByName;
    },

    getAudioGraph() {
      return audioGraph;
    },
  };
}
