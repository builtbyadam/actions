const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  MAX_LINES,
  lastLines,
  safeDelimiter,
  writeOutput,
  passedFromExit,
  summaryLine,
} = require("../src/excerpt");

describe("lastLines", () => {
  test("returns all lines when fewer than the limit", () => {
    assert.strictEqual(lastLines("a\nb\nc", 50), "a\nb\nc");
  });

  test("truncates to the last N lines", () => {
    const input = Array.from({ length: 120 }, (_, i) => `line ${i}`).join("\n");
    const out = lastLines(input, 50);
    const outLines = out.split("\n");
    assert.strictEqual(outLines.length, 50);
    assert.strictEqual(outLines[0], "line 70");
    assert.strictEqual(outLines[49], "line 119");
  });

  test("drops a single trailing newline so the last real line is kept", () => {
    assert.strictEqual(lastLines("a\nb\n", 50), "a\nb");
  });

  test("empty / null inputs yield empty string", () => {
    assert.strictEqual(lastLines("", 50), "");
    assert.strictEqual(lastLines(null, 50), "");
    assert.strictEqual(lastLines("\n", 50), "");
  });

  test("MAX_LINES is 50", () => {
    assert.strictEqual(MAX_LINES, 50);
  });
});

describe("safeDelimiter", () => {
  test("returns the base delimiter when there is no collision", () => {
    assert.strictEqual(safeDelimiter("some\noutput"), "DOWNSTREAM_CANARY_EOF");
  });

  test("extends the delimiter when the value contains it as a line", () => {
    const value = "before\nDOWNSTREAM_CANARY_EOF\nafter";
    const d = safeDelimiter(value);
    assert.notStrictEqual(d, "DOWNSTREAM_CANARY_EOF");
    assert.ok(!value.split("\n").includes(d));
  });

  test("extends repeatedly when multiple candidate delimiters collide", () => {
    const value = "DOWNSTREAM_CANARY_EOF\nDOWNSTREAM_CANARY_EOF_";
    const d = safeDelimiter(value);
    assert.ok(!value.split("\n").includes(d));
  });
});

describe("passedFromExit", () => {
  test("0 is a pass", () => {
    assert.strictEqual(passedFromExit(0), true);
    assert.strictEqual(passedFromExit("0"), true);
  });
  test("non-zero is a fail", () => {
    assert.strictEqual(passedFromExit(1), false);
    assert.strictEqual(passedFromExit("137"), false);
  });
});

describe("summaryLine", () => {
  test("passed verdict", () => {
    assert.strictEqual(summaryLine(true, 0), "Downstream build PASSED (exit 0)");
  });
  test("failed verdict", () => {
    assert.strictEqual(summaryLine(false, 1), "Downstream build FAILED (exit 1)");
  });
});

describe("writeOutput", () => {
  test("single-line value uses key=value form", () => {
    const file = path.join(os.tmpdir(), `dc-out-${process.pid}-${Date.now()}-a`);
    writeOutput("passed", "true", file);
    const contents = fs.readFileSync(file, "utf8");
    fs.unlinkSync(file);
    assert.strictEqual(contents, "passed=true\n");
  });

  test("multiline value uses a heredoc with a safe delimiter", () => {
    const file = path.join(os.tmpdir(), `dc-out-${process.pid}-${Date.now()}-b`);
    writeOutput("log-excerpt", "line1\nline2", file);
    const contents = fs.readFileSync(file, "utf8");
    fs.unlinkSync(file);
    assert.strictEqual(
      contents,
      "log-excerpt<<DOWNSTREAM_CANARY_EOF\nline1\nline2\nDOWNSTREAM_CANARY_EOF\n"
    );
  });

  test("multiline value containing the delimiter does not corrupt the file", () => {
    const file = path.join(os.tmpdir(), `dc-out-${process.pid}-${Date.now()}-c`);
    const value = "x\nDOWNSTREAM_CANARY_EOF\ny";
    writeOutput("log-excerpt", value, file);
    const contents = fs.readFileSync(file, "utf8");
    fs.unlinkSync(file);
    // The chosen delimiter must appear exactly twice (open + close) and never
    // as a bare line inside the value region.
    const lines = contents.split("\n");
    const header = lines[0];
    const delim = header.slice("log-excerpt<<".length);
    assert.ok(!value.split("\n").includes(delim));
  });
});
