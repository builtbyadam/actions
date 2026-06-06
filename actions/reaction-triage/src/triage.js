// Pure logic for reaction-triage. No GitHub API calls (and no @actions
// imports) here so it can be unit-tested directly (see test/triage.test.js).

// The reaction content types GitHub exposes on the issue.reactions object.
const REACTIONS = ["+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes"];
const ON_CROSS = ["label", "close", "comment"];

// Marker appended to every comment this action posts, so a later run can detect
// its own prior comment and skip re-commenting.
const COMMENT_MARKER = "<!-- reaction-triage -->";

/**
 * Parse and validate all raw inputs into a typed options object.
 *
 * @param {object} raw Raw string inputs.
 * @param {string} raw.reaction
 * @param {string} raw.threshold
 * @param {string} raw.onCross
 * @param {string} raw.labelName
 * @param {string} raw.commentBody
 * @param {string} raw.confirm
 * @returns {{reaction:string, threshold:number, onCross:string,
 *           labelName:string, commentBody:string, confirm:boolean}}
 */
function parseInputs(raw) {
  const reaction = raw.reaction || "+1";
  if (!REACTIONS.includes(reaction)) {
    throw new Error(`Input "reaction" must be one of ${REACTIONS.join(", ")}, got "${reaction}".`);
  }

  if (!/^\d+$/.test(raw.threshold) || Number(raw.threshold) < 1) {
    throw new Error(`Input "threshold" must be a positive integer, got "${raw.threshold}".`);
  }
  const threshold = Number(raw.threshold);

  const onCross = raw.onCross || "label";
  if (!ON_CROSS.includes(onCross)) {
    throw new Error(`Input "on-cross" must be one of ${ON_CROSS.join(", ")}, got "${onCross}".`);
  }

  return {
    reaction,
    threshold,
    onCross,
    labelName: raw.labelName || "popular",
    commentBody: raw.commentBody || "",
    confirm: parseBool("confirm", raw.confirm),
  };
}

/** Parse a boolean-string input ("true"/"false"). Throws on anything else. */
function parseBool(name, value) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Input "${name}" must be "true" or "false", got "${value}".`);
}

/** True when the listing entry is a pull request (issues.listForRepo includes PRs). */
function isPullRequest(issue) {
  return issue != null && issue.pull_request != null;
}

/** Read the count for a reaction off the embedded issue.reactions object. */
function reactionCount(issue, reaction) {
  if (!issue || !issue.reactions) return 0;
  const value = issue.reactions[reaction];
  return typeof value === "number" ? value : 0;
}

/**
 * Whether the issue has already been acted on for this mode and therefore
 * should be reported as "skipped-already-acted" rather than mutated again.
 *
 * - label mode: the issue already carries label-name.
 * - close mode: only open issues are listed, so closed ones never reappear;
 *   never treated as already-acted here (returns false).
 * - comment mode: the caller scans the issue's comments for the marker and
 *   passes the result via `commentedFlag` (we cannot fetch comments here).
 *
 * @param {object} issue Issue object from issues.listForRepo.
 * @param {string} mode on-cross value.
 * @param {string} labelName Label used in label mode.
 * @param {boolean} commentedFlag Pre-computed "already commented" flag (comment mode).
 * @returns {boolean}
 */
function alreadyActed(issue, mode, labelName, commentedFlag = false) {
  if (mode === "label") {
    const labels = Array.isArray(issue.labels) ? issue.labels : [];
    return labels.some((label) => {
      const name = typeof label === "string" ? label : label && label.name;
      return name === labelName;
    });
  }
  if (mode === "comment") {
    return Boolean(commentedFlag);
  }
  // close mode: open issues only, never pre-acted.
  return false;
}

/**
 * Select the open issues whose reaction count crosses the threshold (>=),
 * excluding pull requests. The returned list is the set of crossing issues;
 * already-acted handling is layered on top by the caller, but for label mode
 * (where we can decide statically) we still surface the count here.
 *
 * @param {object[]} issues Entries from issues.listForRepo.
 * @param {string} reaction Reaction name.
 * @param {number} threshold Minimum count (>=) to cross.
 * @returns {object[]} The subset of issues (non-PR) that cross the threshold,
 *                     each annotated with {issue, count}.
 */
function selectCrossed(issues, reaction, threshold) {
  const crossed = [];
  for (const issue of issues) {
    if (isPullRequest(issue)) continue;
    const count = reactionCount(issue, reaction);
    if (count >= threshold) {
      crossed.push({ issue, count });
    }
  }
  return crossed;
}

/** Template {count} and {reaction} into a comment body and append the marker. */
function renderComment(body, count, reaction) {
  const rendered = String(body)
    .replace(/\{count\}/g, String(count))
    .replace(/\{reaction\}/g, reaction);
  return `${rendered}\n\n${COMMENT_MARKER}`;
}

/**
 * Build a report row for an issue.
 *
 * @param {object} issue Issue object.
 * @param {number} count The crossing reaction count.
 * @param {string} action One of labeled|commented|closed|would-close|skipped-already-acted.
 * @returns {{number:number, title:string, reactions:number, action:string}}
 */
function toReportRow(issue, count, action) {
  return {
    number: issue.number,
    title: issue.title,
    reactions: count,
    action,
  };
}

module.exports = {
  REACTIONS,
  ON_CROSS,
  COMMENT_MARKER,
  parseInputs,
  parseBool,
  isPullRequest,
  reactionCount,
  alreadyActed,
  selectCrossed,
  renderComment,
  toReportRow,
};
