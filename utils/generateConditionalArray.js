// ============================================================
// Utility: Conditional Array Generation
// ============================================================

function generateConditionalArray(length, probability, valueFunction) {
  const result = [];
  for (let i = 0; i < length; i++) {
    if (Math.random() <= probability) {
      result.push(valueFunction(i));
    }
  }
  return result;
}

export function generateMelodyProbability(size, probability) {
  return generateConditionalArray(size, probability, (index) => index);
}

export function generateBinaryProbability(size, probability) {
  return generateConditionalArray(size, probability, () =>
    Math.floor(Math.random() * 2)
  );
}
