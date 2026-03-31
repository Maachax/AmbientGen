import * as Tone from "tone";

// ============================================================
// Voice Scheduler — Ambient Room
// ============================================================
// Controls which voices are active at any given time.
// Voices fade in/out smoothly. Not all 6 play at once.
// The scheduler picks 2-4 voices to be active, rotates over time.
//
// Each voice has:
//   - active: boolean (currently sounding)
//   - manualOverride: null | true | false (user forced on/off)
//   - fadeGain: reference to the voice's fade gain node

function pickIntRange(a, b) {
  return Math.floor(a + Math.random() * (b - a + 1));
}

export function createVoiceScheduler(voices, {
  debug = false,
  fadeIn: fadeInSeconds = 4,
  fadeOut: fadeOutSeconds = 6,
  minActive = 2,
  maxActive = 4,
  rethinkMin = 16,
  rethinkMax = 48,
  onFadeIn = null,
  onFadeOut = null,
} = {}) {
  const states = voices.map((v) => ({
    voice: v,
    active: false,
    manualOverride: null, // null = auto, true = forced on, false = forced off
  }));

  let measureCounter = 0;
  let nextRethinkAt = pickIntRange(4, 12); // first rethink comes early
  let scheduledId = null;

  function log(...args) {
    if (debug) console.log("[VoiceScheduler]", ...args);
  }

  function fadeInVoice(state) {
    if (state.active) return;
    state.active = true;
    state.voice.fadeGain.gain.rampTo(1, fadeInSeconds);
    if (onFadeIn) onFadeIn(state.voice.name);
    log("fade in:", state.voice.name);
  }

  function fadeOutVoice(state) {
    if (!state.active) return;
    state.active = false;
    state.voice.fadeGain.gain.rampTo(0, fadeOutSeconds);
    if (onFadeOut) onFadeOut(state.voice.name);
    log("fade out:", state.voice.name);
  }

  function rethink() {
    // Count how many are freely available (no manual override)
    const autoStates = states.filter((s) => s.manualOverride === null);
    const forcedOn = states.filter((s) => s.manualOverride === true);
    const forcedOff = states.filter((s) => s.manualOverride === false);

    // Apply forced states
    for (const s of forcedOn) fadeInVoice(s);
    for (const s of forcedOff) fadeOutVoice(s);

    // Determine target count for auto voices
    const forcedOnCount = forcedOn.length;
    const desiredTotal = pickIntRange(minActive, maxActive);
    const autoTarget = Math.max(0, desiredTotal - forcedOnCount);

    // Shuffle auto states for variety
    const shuffled = autoStates.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Activate first N, deactivate rest
    for (let i = 0; i < shuffled.length; i++) {
      if (i < autoTarget) {
        fadeInVoice(shuffled[i]);
      } else {
        fadeOutVoice(shuffled[i]);
      }
    }

    nextRethinkAt = measureCounter + pickIntRange(rethinkMin, rethinkMax);
    log("rethink → active:", getActiveNames(), "next at measure:", nextRethinkAt);
  }

  function tick() {
    measureCounter++;
    if (measureCounter >= nextRethinkAt) {
      rethink();
    }
  }

  function start() {
    // Initial arrangement
    rethink();
    scheduledId = Tone.Transport.scheduleRepeat(() => tick(), "1m");
    log("started");
  }

  function stop() {
    if (scheduledId != null) Tone.Transport.clear(scheduledId);
    scheduledId = null;
  }

  function dispose() {
    stop();
    for (const s of states) fadeOutVoice(s);
  }

  // --- Manual override API ---

  function setVoice(name, enabled) {
    const s = states.find((st) => st.voice.name === name);
    if (!s) return;
    s.manualOverride = enabled;
    if (enabled) fadeInVoice(s);
    else fadeOutVoice(s);
  }

  function releaseVoice(name) {
    const s = states.find((st) => st.voice.name === name);
    if (!s) return;
    s.manualOverride = null;
    // Will be reconsidered at next rethink
  }

  function toggleVoice(name) {
    const s = states.find((st) => st.voice.name === name);
    if (!s) return;
    if (s.manualOverride === true) {
      s.manualOverride = false;
      fadeOutVoice(s);
    } else {
      s.manualOverride = true;
      fadeInVoice(s);
    }
    return s.manualOverride;
  }

  function getActiveNames() {
    return states.filter((s) => s.active).map((s) => s.voice.name);
  }

  function getStates() {
    return states.map((s) => ({
      name: s.voice.name,
      active: s.active,
      manualOverride: s.manualOverride,
    }));
  }

  function forceRethink() {
    rethink();
  }

  return {
    start,
    stop,
    dispose,
    tick,
    setVoice,
    releaseVoice,
    toggleVoice,
    getActiveNames,
    getStates,
    forceRethink,
  };
}
