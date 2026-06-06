"use strict";

// secret-canary report processor.
//
// Reads a scanner's raw output, normalizes it into a REDACTED finding shape
// ({rule, file, line, commit?}), writes the action outputs, optionally upserts
// a single pull-request comment, and decides the verdict.
//
// By construction this module never emits the secret value or the matched
// text: parse* keeps only rule/file/line/commit, and nothing downstream has
// access to the raw match. Node builtins only (global fetch on Node 20).

const fs = require("node:fs");

const COMMENT_MARKER = "<!-- secret-canary-report -->";

// --- Parsing -------------------------------------------------------------

// gitleaks JSON report: an array of objects with RuleID, File, StartLine,
// Commit, Secret, Match. We keep only RuleID/File/StartLine/Commit and drop
// the secret-bearing fields entirely.
function parseGitleaksReport(text) {
  const trimmed = (text || "").trim();
  if (trimmed === "") return [];
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`gitleaks report is not valid JSON: ${err.message}`);
  }
  if (parsed === null) return [];
  if (!Array.isArray(parsed)) {
    throw new Error("gitleaks report must be a JSON array");
  }
  return parsed.map((f) => {
    const finding = {
      rule: String(f.RuleID ?? ""),
      file: String(f.File ?? ""),
      line: Number(f.StartLine ?? 0),
    };
    if (f.Commit != null && String(f.Commit) !== "") {
      finding.commit = String(f.Commit);
    }
    return finding;
  });
}

// trufflehog filesystem --json output: NDJSON (one JSON object per line) with
// DetectorName and SourceMetadata.Data.Filesystem.{file,line}. Non-JSON lines
// (e.g. log noise) are ignored.
function parseTrufflehogReport(text) {
  const findings = [];
  for (const rawLine of (text || "").split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue; // skip non-JSON log lines
    }
    if (obj == null || typeof obj !== "object") continue;
    // trufflehog emits objects without DetectorName for non-result events;
    // a finding always carries a DetectorName.
    if (obj.DetectorName == null && obj.DetectorType == null) continue;
    const fsMeta =
      obj.SourceMetadata &&
      obj.SourceMetadata.Data &&
      obj.SourceMetadata.Data.Filesystem;
    const finding = {
      rule: String(obj.DetectorName ?? obj.DetectorType ?? ""),
      file: String((fsMeta && fsMeta.file) ?? ""),
      line: Number((fsMeta && fsMeta.line) ?? 0),
    };
    findings.push(finding);
  }
  return findings;
}

function parseReport(scanner, text) {
  if (scanner === "gitleaks") return parseGitleaksReport(text);
  if (scanner === "trufflehog") return parseTrufflehogReport(text);
  throw new Error(`Input "scanner" must be one of: gitleaks, trufflehog`);
}

// --- Redaction -----------------------------------------------------------

// Defense in depth: even though parse* already drops secret-bearing fields,
// redactFindings rebuilds each finding from a fixed allowlist of keys so no
// stray field (Secret, Match, raw, etc.) can leak through.
function redactFindings(findings) {
  return findings.map((f) => {
    const out = {
      rule: String(f.rule ?? ""),
      file: String(f.file ?? ""),
      line: Number.isFinite(Number(f.line)) ? Number(f.line) : 0,
    };
    if (f.commit != null && String(f.commit) !== "") {
      out.commit = String(f.commit);
    }
    return out;
  });
}

// --- Comment rendering ---------------------------------------------------

function renderComment(findings, scanner) {
  const lines = [];
  lines.push(COMMENT_MARKER);
  lines.push("## secret-canary");
  lines.push("");
  if (findings.length === 0) {
    lines.push(`No potential secrets found (scanner: \`${scanner}\`).`);
    return lines.join("\n");
  }
  lines.push(
    `Found **${findings.length}** potential secret${
      findings.length === 1 ? "" : "s"
    } (scanner: \`${scanner}\`). Values are redacted; only rule, file, and line are shown.`
  );
  lines.push("");
  lines.push("| Rule | File | Line |");
  lines.push("|---|---|---|");
  for (const f of findings) {
    lines.push(`| ${f.rule} | \`${f.file}\` | ${f.line} |`);
  }
  return lines.join("\n");
}

// --- GitHub comment upsert ----------------------------------------------

function getPullRequest(eventPayload) {
  if (!eventPayload || typeof eventPayload !== "object") return null;
  const pr = eventPayload.pull_request;
  if (pr && typeof pr.number === "number") return pr;
  return null;
}

async function listIssueComments(apiBase, repo, issueNumber, token) {
  const comments = [];
  let page = 1;
  for (;;) {
    const url = `${apiBase}/repos/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "secret-canary",
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub API listComments failed: ${res.status} ${res.statusText}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    comments.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return comments;
}

async function upsertComment(ctx, body) {
  const { apiBase, repo, issueNumber, token } = ctx;
  const existing = await listIssueComments(apiBase, repo, issueNumber, token);
  const found = existing.find(
    (c) => typeof c.body === "string" && c.body.includes(COMMENT_MARKER)
  );
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "secret-canary",
    "Content-Type": "application/json",
  };
  if (found) {
    const res = await fetch(`${apiBase}/repos/${repo}/issues/comments/${found.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      throw new Error(`GitHub API patchComment failed: ${res.status} ${res.statusText}`);
    }
    return "updated";
  }
  const res = await fetch(`${apiBase}/repos/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API createComment failed: ${res.status} ${res.statusText}`);
  }
  return "created";
}

// --- Output writing ------------------------------------------------------

function writeOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  // Multiline-safe heredoc form.
  const delimiter = `ghadelimiter_${name}_${Math.random().toString(36).slice(2)}`;
  fs.appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

// --- Main ----------------------------------------------------------------

async function run() {
  const scanner = process.env.SCANNER || "gitleaks";
  const reportPath = process.env.SCAN_REPORT_PATH;
  const commentOnPr = process.env.COMMENT_ON_PR === "true";
  const failOnFindings = process.env.FAIL_ON_FINDINGS === "true";
  const token = process.env.GITHUB_TOKEN || "";

  let rawText = "";
  try {
    rawText = fs.readFileSync(reportPath, "utf8");
  } catch {
    // No report file (e.g. scanner produced nothing) -> no findings.
    rawText = "";
  }

  const findings = redactFindings(parseReport(scanner, rawText));
  const reportJson = JSON.stringify(findings);

  writeOutput("findings-count", String(findings.length));
  writeOutput("report", reportJson);

  if (findings.length > 0) {
    console.log(`Found ${findings.length} potential secrets`);
  } else {
    console.log("No secrets found");
  }

  // Comment upsert (fail open on the comment, never on the verdict).
  if (commentOnPr) {
    try {
      const eventPath = process.env.GITHUB_EVENT_PATH;
      let payload = null;
      if (eventPath && fs.existsSync(eventPath)) {
        payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
      }
      const pr = getPullRequest(payload);
      if (!token) {
        console.log("Skipping PR comment: no github-token provided.");
      } else if (!pr) {
        console.log("Skipping PR comment: event payload has no pull_request.");
      } else {
        const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
        const repo = process.env.GITHUB_REPOSITORY;
        const body = renderComment(findings, scanner);
        const result = await upsertComment(
          { apiBase, repo, issueNumber: pr.number, token },
          body
        );
        console.log(`PR comment ${result}.`);
      }
    } catch (err) {
      console.log(`Skipping PR comment due to error (failing open): ${err.message}`);
    }
  }

  if (failOnFindings && findings.length > 0) {
    console.error(
      `secret-canary: failing because ${findings.length} potential secret(s) were found.`
    );
    process.exit(1);
  }
}

module.exports = {
  COMMENT_MARKER,
  parseGitleaksReport,
  parseTrufflehogReport,
  parseReport,
  redactFindings,
  renderComment,
  getPullRequest,
  upsertComment,
  listIssueComments,
};

if (require.main === module) {
  run().catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
}
