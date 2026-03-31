// ============================================================
// Minimalist Pattern Generator — Ambient Room
// ============================================================
// Generates short repeating patterns (Glass-style) for each voice.
// Patterns are arrays of step indices within a cycle length.
// Each voice gets a different pattern length / phase offset
// so they interlock and drift against each other.

/**
 * Generate a minimalist repeating pattern.
 * @param {number} cycleLength - Total steps in the cycle (e.g. 8, 12, 16)
 * @param {number} density - 0..1, proportion of active steps
 * @param {object} opts
 * @param {boolean} opts.preferEven - bias toward even-spaced patterns
 * @returns {number[]} array of active step indices (sorted)
 */
export function generateMinimalistPattern(cycleLength, density = 0.4, opts = {}) {
  const { preferEven = true } = opts;
  const targetCount = Math.max(1, Math.round(cycleLength * density));

  if (preferEven && targetCount <= cycleLength / 2) {
    // Try to space notes evenly (very Glass-like)
    const spacing = Math.floor(cycleLength / targetCount);
    const offset = Math.floor(Math.random() * spacing);
    const pattern = [];
    for (let i = 0; i < targetCount; i++) {
      pattern.push((offset + i * spacing) % cycleLength);
    }
    pattern.sort((a, b) => a - b);
    return pattern;
  }

  // Fallback: random selection
  const all = Array.from({ length: cycleLength }, (_, i) => i);
  // Shuffle and pick
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const pattern = all.slice(0, targetCount).sort((a, b) => a - b);
  return pattern;
}

/**
 * Mutate a pattern. Three types:
 * - shift (60%): move one step ±1 position
 * - rotate (30%): phase-shift entire pattern by +1 step (Glass phasing)
 * - invert (10%): mirror pattern within the cycle
 */
export function mutatePattern(pattern, cycleLength) {
  if (!pattern || pattern.length < 2) return pattern;
  const roll = Math.random();

  if (roll < 0.6) {
    // Shift one step ±1
    const copy = pattern.slice();
    const idx = 1 + Math.floor(Math.random() * (copy.length - 1));
    const dir = Math.random() < 0.5 ? -1 : 1;
    const candidate = (copy[idx] + dir + cycleLength) % cycleLength;
    if (!copy.includes(candidate)) {
      copy[idx] = candidate;
      copy.sort((a, b) => a - b);
    }
    return copy;
  } else if (roll < 0.9) {
    // Rotate: phase-shift entire pattern +1 step
    return pattern.map((s) => (s + 1) % cycleLength).sort((a, b) => a - b);
  } else {
    // Invert: mirror within cycle
    return pattern.map((s) => cycleLength - 1 - s).sort((a, b) => a - b);
  }
}

/**
 * Create a pattern manager that tracks position and handles mutations.
 */
export function createPatternManager({
  cycleLength = 8,
  density = 0.4,
  mutateEvery = 64,
  regenEvery = 256,
  mutationProbability = 0.3,
} = {}) {
  let pattern = generateMinimalistPattern(cycleLength, density);
  let stepInCycle = 0;
  let totalTicks = 0;

  function shouldTrigger(step) {
    return pattern.includes(step % cycleLength);
  }

  function advance() {
    stepInCycle = (stepInCycle + 1) % cycleLength;
    return stepInCycle;
  }

  function tick() {
    totalTicks++;
    if (totalTicks % regenEvery === 0) {
      pattern = generateMinimalistPattern(cycleLength, density);
    } else if (totalTicks % mutateEvery === 0) {
      if (Math.random() < mutationProbability) {
        pattern = mutatePattern(pattern, cycleLength);
      }
    }
  }

  function getPattern() {
    return pattern.slice();
  }

  function forceRegenerate(newDensity) {
    pattern = generateMinimalistPattern(cycleLength, newDensity ?? density);
    stepInCycle = 0;
  }

  function getCycleLength() {
    return cycleLength;
  }

  return { shouldTrigger, advance, tick, getPattern, forceRegenerate, getCycleLength };
}
