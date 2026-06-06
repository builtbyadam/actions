// Pure logic for matrix-shrinker. No GitHub API calls here so it can be
// unit-tested directly (see test/shrink.test.js).

/**
 * Convert a path glob to a RegExp.
 * Supported syntax:
 *   *   matches anything except "/"
 *   ?   matches a single character except "/"
 *   **  matches anything, including "/"
 * Globs are matched against full repo-relative paths.
 */
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?"; // "**/" — zero or more leading directories
          i += 2;
        } else {
          re += ".*"; // trailing or bare "**"
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

/** Parse the `matrix` input into an array of entry objects. */
function parseMatrix(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error(`Input "matrix" is not valid JSON: ${e.message}`);
  }
  const include = Array.isArray(parsed) ? parsed : parsed && parsed.include;
  if (!Array.isArray(include)) {
    throw new Error(
      'Input "matrix" must be a JSON array of entries or an object with an "include" array.'
    );
  }
  for (const entry of include) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error('Every "matrix" entry must be a JSON object.');
    }
  }
  return include;
}

/** Parse the `rules` input into an array of {paths, select} rules. */
function parseRules(json) {
  let rules;
  try {
    rules = JSON.parse(json);
  } catch (e) {
    throw new Error(`Input "rules" is not valid JSON: ${e.message}`);
  }
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error('Input "rules" must be a non-empty JSON array.');
  }
  rules.forEach((rule, i) => {
    if (typeof rule !== "object" || rule === null || Array.isArray(rule)) {
      throw new Error(`Rule ${i} must be an object with a "paths" array.`);
    }
    if (
      !Array.isArray(rule.paths) ||
      rule.paths.length === 0 ||
      !rule.paths.every((p) => typeof p === "string" && p.length > 0)
    ) {
      throw new Error(`Rule ${i} must have a non-empty "paths" array of glob strings.`);
    }
    if (
      rule.select !== undefined &&
      (typeof rule.select !== "object" || rule.select === null || Array.isArray(rule.select))
    ) {
      throw new Error(`Rule ${i} has a "select" that is not an object.`);
    }
  });
  return rules;
}

/** True when the entry matches every key/value pair in `select` (empty/omitted select matches all). */
function entryMatchesSelect(entry, select) {
  if (!select || Object.keys(select).length === 0) return true;
  return Object.entries(select).every(([key, value]) => String(entry[key]) === String(value));
}

/**
 * Shrink the matrix: a rule is "active" when any changed file matches any of
 * its path globs; an entry is kept when any active rule selects it.
 *
 * @param {object[]} include      Matrix entries (from parseMatrix).
 * @param {object[]} rules        Rules (from parseRules).
 * @param {string[]} changedFiles Repo-relative changed file paths.
 * @returns {{include: object[], count: number, skipped: number}}
 */
function shrinkMatrix(include, rules, changedFiles) {
  const activeRules = rules.filter((rule) => {
    const regexps = rule.paths.map(globToRegExp);
    return changedFiles.some((file) => regexps.some((re) => re.test(file)));
  });
  const kept = include.filter((entry) =>
    activeRules.some((rule) => entryMatchesSelect(entry, rule.select))
  );
  return { include: kept, count: kept.length, skipped: include.length - kept.length };
}

module.exports = { globToRegExp, parseMatrix, parseRules, entryMatchesSelect, shrinkMatrix };
