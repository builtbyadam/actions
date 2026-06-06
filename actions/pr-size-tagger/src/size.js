// Pure logic for pr-size-tagger. No GitHub API calls here so it can be
// unit-tested directly (see test/size.test.js).

/**
 * Parse the `bins` input into a validated array of {label, max} pairs sorted
 * ascending by max. Each value must be a positive integer.
 *
 * @param {string} json JSON object mapping label -> max-lines.
 * @returns {{label: string, max: number}[]} bins sorted ascending by max.
 */
function parseBins(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error(`Input "bins" is not valid JSON: ${e.message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error('Input "bins" must be a JSON object mapping label to max-lines.');
  }
  const entries = Object.entries(parsed);
  if (entries.length === 0) {
    throw new Error('Input "bins" must be a non-empty JSON object.');
  }
  const bins = entries.map(([label, max]) => {
    if (!Number.isInteger(max) || max <= 0) {
      throw new Error(`Input "bins" value for "${label}" must be a positive integer.`);
    }
    return { label, max };
  });
  bins.sort((a, b) => a.max - b.max);
  return bins;
}

/**
 * Pick the label for a given line count: the smallest bin whose max is >= lines.
 * Counts beyond every bin clamp to the largest bin's label.
 *
 * @param {{label: string, max: number}[]} bins Sorted ascending by max (from parseBins).
 * @param {number} lines Computed changed-line count.
 * @returns {string} the chosen label.
 */
function pickLabel(bins, lines) {
  for (const bin of bins) {
    if (lines <= bin.max) return bin.label;
  }
  return bins[bins.length - 1].label;
}

/**
 * Compute the changed-line count from a PR's additions/deletions.
 *
 * @param {number} additions
 * @param {number} deletions
 * @param {string} countMode "changed" (additions + deletions) or "additions".
 * @returns {number}
 */
function computeLines(additions, deletions, countMode) {
  const add = Number(additions) || 0;
  const del = Number(deletions) || 0;
  return countMode === "additions" ? add : add + del;
}

/**
 * Diff current labels against the bin labels to find which to remove: every
 * label that is a bin key and is not the chosen label. Unrelated labels and
 * the chosen label are left in place.
 *
 * @param {string[]} currentLabels Labels currently on the PR.
 * @param {string[]} binLabels All labels defined in the bins mapping.
 * @param {string} chosenLabel The label that should remain.
 * @returns {string[]}
 */
function labelsToRemove(currentLabels, binLabels, chosenLabel) {
  const binSet = new Set(binLabels);
  return currentLabels.filter((label) => binSet.has(label) && label !== chosenLabel);
}

module.exports = { parseBins, pickLabel, computeLines, labelsToRemove };
