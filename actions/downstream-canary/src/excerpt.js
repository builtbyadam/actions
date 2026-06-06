"use strict";

const fs = require("node:fs");

// Maximum number of trailing log lines to surface as the log-excerpt output.
const MAX_LINES = 50;

// Read a log file and return the last `maxLines` lines as a single string.
// Trailing newlines are ignored so the last real line of output is included
// rather than an empty final line. Missing/empty files yield "".
function lastLines(text, maxLines) {
  if (text == null) return "";
  // Drop a single trailing newline so the final line of real output is kept.
  let s = String(text);
  if (s.endsWith("\n")) s = s.slice(0, -1);
  if (s === "") return "";
  const lines = s.split("\n");
  const tail = lines.slice(Math.max(0, lines.length - maxLines));
  return tail.join("\n");
}

// Pick a heredoc delimiter that does not collide with any line in the value.
// $GITHUB_OUTPUT multiline syntax is `name<<DELIM\n<value>\nDELIM`; if the
// value contained a line exactly equal to DELIM, the file would be corrupted.
// We start from a fixed token and append underscores until it is unique.
function safeDelimiter(value) {
  let delim = "DOWNSTREAM_CANARY_EOF";
  const lines = new Set(String(value).split("\n"));
  while (lines.has(delim)) {
    delim += "_";
  }
  return delim;
}

// Append a key=value (single line) or heredoc (multiline) entry to a
// $GITHUB_OUTPUT-style file. When the env var is unset (local runs) the value
// is printed to stdout so it is observable.
function writeOutput(name, value, outputFile) {
  const file = outputFile || process.env.GITHUB_OUTPUT;
  const v = value == null ? "" : String(value);
  if (!file) {
    process.stdout.write(`${name}=${v}\n`);
    return;
  }
  if (v.includes("\n")) {
    const delim = safeDelimiter(v);
    fs.appendFileSync(file, `${name}<<${delim}\n${v}\n${delim}\n`);
  } else {
    fs.appendFileSync(file, `${name}=${v}\n`);
  }
}

// Compute the "passed" flag from a build exit code. Only a 0 exit is a pass.
function passedFromExit(exitCode) {
  return Number(exitCode) === 0;
}

// Build the human-readable summary line for the job log.
function summaryLine(passed, exitCode) {
  const verdict = passed ? "PASSED" : "FAILED";
  return `Downstream build ${verdict} (exit ${exitCode})`;
}

// Main entrypoint. Reads config from env vars set by the composite step:
//   DOWNSTREAM_CANARY_LOG       - path to the combined link+build log file
//   DOWNSTREAM_CANARY_EXIT_CODE - exit code of the link+build sequence
function main() {
  const logPath = process.env.DOWNSTREAM_CANARY_LOG || "";
  const exitRaw = process.env.DOWNSTREAM_CANARY_EXIT_CODE;
  const exitCode = exitRaw === undefined || exitRaw === "" ? 1 : Number(exitRaw);

  let logText = "";
  if (logPath && fs.existsSync(logPath)) {
    logText = fs.readFileSync(logPath, "utf8");
  }

  const excerpt = lastLines(logText, MAX_LINES);
  const passed = passedFromExit(exitCode);

  writeOutput("passed", passed ? "true" : "false");
  writeOutput("log-excerpt", excerpt);

  // Human summary + the excerpt, so the verdict and tail are visible in the
  // job log even without expanding the build step.
  console.log(summaryLine(passed, exitCode));
  if (excerpt) {
    console.log("----- downstream build log (last 50 lines) -----");
    console.log(excerpt);
    console.log("------------------------------------------------");
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  MAX_LINES,
  lastLines,
  safeDelimiter,
  writeOutput,
  passedFromExit,
  summaryLine,
};
