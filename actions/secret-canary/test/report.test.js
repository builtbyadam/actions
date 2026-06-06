const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const {
  COMMENT_MARKER,
  parseGitleaksReport,
  parseTrufflehogReport,
  parseReport,
  redactFindings,
  renderComment,
  getPullRequest,
} = require("../src/report");

const FIXTURES = path.join(__dirname, "fixtures");
const GITLEAKS = fs.readFileSync(path.join(FIXTURES, "gitleaks.json"), "utf8");
const TRUFFLEHOG = fs.readFileSync(path.join(FIXTURES, "trufflehog.ndjson"), "utf8");

// The placeholder "secret" string that must NEVER appear in any output.
const FIXTURE_SECRET = "fixture-value-redacted";

describe("parseGitleaksReport", () => {
  test("maps RuleID/File/StartLine/Commit only", () => {
    const findings = parseGitleaksReport(GITLEAKS);
    assert.strictEqual(findings.length, 2);
    assert.deepStrictEqual(findings[0], {
      rule: "generic-api-key",
      file: "config/settings.py",
      line: 12,
      commit: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    });
  });

  test("drops Secret and Match fields", () => {
    const findings = parseGitleaksReport(GITLEAKS);
    for (const f of findings) {
      assert.ok(!("Secret" in f) && !("secret" in f));
      assert.ok(!("Match" in f) && !("match" in f));
    }
  });

  test("empty input yields no findings", () => {
    assert.deepStrictEqual(parseGitleaksReport(""), []);
    assert.deepStrictEqual(parseGitleaksReport("   "), []);
  });

  test("rejects invalid JSON", () => {
    assert.throws(() => parseGitleaksReport("{nope"), /not valid JSON/);
  });

  test("rejects non-array shapes", () => {
    assert.throws(() => parseGitleaksReport('{"a":1}'), /must be a JSON array/);
  });
});

describe("parseTrufflehogReport", () => {
  test("maps DetectorName + filesystem file/line, skips log lines", () => {
    const findings = parseTrufflehogReport(TRUFFLEHOG);
    assert.strictEqual(findings.length, 2);
    assert.deepStrictEqual(findings[0], {
      rule: "Generic",
      file: "config/settings.py",
      line: 12,
    });
    assert.deepStrictEqual(findings[1], {
      rule: "AWS",
      file: "deploy/env.sh",
      line: 5,
    });
  });

  test("drops Raw and Redacted fields", () => {
    const findings = parseTrufflehogReport(TRUFFLEHOG);
    for (const f of findings) {
      assert.ok(!("Raw" in f));
      assert.ok(!("Redacted" in f));
    }
  });

  test("empty input yields no findings", () => {
    assert.deepStrictEqual(parseTrufflehogReport(""), []);
  });
});

describe("parseReport", () => {
  test("dispatches by scanner", () => {
    assert.strictEqual(parseReport("gitleaks", GITLEAKS).length, 2);
    assert.strictEqual(parseReport("trufflehog", TRUFFLEHOG).length, 2);
  });

  test("rejects unknown scanner", () => {
    assert.throws(() => parseReport("nope", ""), /must be one of/);
  });
});

describe("redactFindings", () => {
  test("rebuilds findings from an allowlist of keys", () => {
    const dirty = [
      {
        rule: "r",
        file: "f",
        line: 3,
        commit: "abc",
        Secret: FIXTURE_SECRET,
        Match: `x=${FIXTURE_SECRET}`,
        raw: FIXTURE_SECRET,
      },
    ];
    const clean = redactFindings(dirty);
    assert.deepStrictEqual(clean, [{ rule: "r", file: "f", line: 3, commit: "abc" }]);
  });

  test("omits commit when absent", () => {
    const clean = redactFindings([{ rule: "r", file: "f", line: 1 }]);
    assert.ok(!("commit" in clean[0]));
  });
});

describe("renderComment", () => {
  test("includes the upsert marker", () => {
    assert.ok(renderComment([], "gitleaks").includes(COMMENT_MARKER));
    assert.ok(
      renderComment(parseReport("gitleaks", GITLEAKS), "gitleaks").includes(COMMENT_MARKER)
    );
  });

  test("renders rule/file/line table for findings", () => {
    const body = renderComment(parseReport("gitleaks", GITLEAKS), "gitleaks");
    assert.ok(body.includes("generic-api-key"));
    assert.ok(body.includes("config/settings.py"));
    assert.ok(body.includes("Found **2** potential secrets"));
  });

  test("renders a clean message when empty", () => {
    assert.ok(renderComment([], "trufflehog").includes("No potential secrets found"));
  });
});

describe("getPullRequest", () => {
  test("returns the PR when present", () => {
    assert.strictEqual(getPullRequest({ pull_request: { number: 7 } }).number, 7);
  });
  test("returns null for non-PR events", () => {
    assert.strictEqual(getPullRequest({}), null);
    assert.strictEqual(getPullRequest(null), null);
    assert.strictEqual(getPullRequest({ pull_request: {} }), null);
  });
});

describe("no-secret-leakage (redaction guarantee)", () => {
  test("redacted findings and rendered comment contain NO fixture secret", () => {
    for (const scanner of ["gitleaks", "trufflehog"]) {
      const raw = scanner === "gitleaks" ? GITLEAKS : TRUFFLEHOG;
      // Sanity: the fixture itself DOES contain the placeholder secret.
      assert.ok(raw.includes(FIXTURE_SECRET), "fixture should contain the placeholder secret");

      const findings = redactFindings(parseReport(scanner, raw));
      const reportJson = JSON.stringify(findings);
      const comment = renderComment(findings, scanner);

      assert.strictEqual(
        reportJson.includes(FIXTURE_SECRET),
        false,
        `${scanner}: redacted report leaked the fixture secret`
      );
      assert.strictEqual(
        comment.includes(FIXTURE_SECRET),
        false,
        `${scanner}: rendered comment leaked the fixture secret`
      );
    }
  });
});
