const { test, describe } = require("node:test");
const assert = require("node:assert");
const {
  REACTIONS,
  COMMENT_MARKER,
  parseInputs,
  alreadyActed,
  selectCrossed,
  renderComment,
  toReportRow,
} = require("../src/triage");

function rawInputs(overrides = {}) {
  return {
    reaction: "+1",
    threshold: "5",
    onCross: "label",
    labelName: "popular",
    commentBody: "{count} :{reaction}:",
    confirm: "false",
    ...overrides,
  };
}

describe("parseInputs", () => {
  test("accepts defaults and a valid configuration", () => {
    const opts = parseInputs(rawInputs());
    assert.strictEqual(opts.reaction, "+1");
    assert.strictEqual(opts.threshold, 5);
    assert.strictEqual(opts.onCross, "label");
    assert.strictEqual(opts.labelName, "popular");
    assert.strictEqual(opts.confirm, false);
  });

  test("reaction enum is validated", () => {
    for (const r of REACTIONS) {
      assert.strictEqual(parseInputs(rawInputs({ reaction: r })).reaction, r);
    }
    assert.throws(() => parseInputs(rawInputs({ reaction: "thumbsup" })), /must be one of/);
    assert.throws(() => parseInputs(rawInputs({ reaction: "+2" })), /must be one of/);
  });

  test("empty reaction falls back to +1", () => {
    assert.strictEqual(parseInputs(rawInputs({ reaction: "" })).reaction, "+1");
  });

  test("threshold must be a positive integer", () => {
    assert.strictEqual(parseInputs(rawInputs({ threshold: "1" })).threshold, 1);
    assert.throws(() => parseInputs(rawInputs({ threshold: "0" })), /positive integer/);
    assert.throws(() => parseInputs(rawInputs({ threshold: "-3" })), /positive integer/);
    assert.throws(() => parseInputs(rawInputs({ threshold: "3.5" })), /positive integer/);
    assert.throws(() => parseInputs(rawInputs({ threshold: "abc" })), /positive integer/);
  });

  test("on-cross enum is validated", () => {
    for (const mode of ["label", "close", "comment"]) {
      assert.strictEqual(parseInputs(rawInputs({ onCross: mode })).onCross, mode);
    }
    assert.throws(() => parseInputs(rawInputs({ onCross: "delete" })), /must be one of/);
  });

  test("confirm must be a boolean string", () => {
    assert.strictEqual(parseInputs(rawInputs({ confirm: "true" })).confirm, true);
    assert.throws(() => parseInputs(rawInputs({ confirm: "yes" })), /"true" or "false"/);
  });
});

describe("selectCrossed", () => {
  const issues = [
    { number: 1, title: "low", reactions: { "+1": 2 } },
    { number: 2, title: "exact", reactions: { "+1": 5 } },
    { number: 3, title: "high", reactions: { "+1": 14 } },
    { number: 4, title: "a pr", reactions: { "+1": 99 }, pull_request: { url: "x" } },
    { number: 5, title: "no reactions object" },
    { number: 6, title: "other reaction", reactions: { heart: 10, "+1": 1 } },
  ];

  test("count == threshold counts as crossed", () => {
    const crossed = selectCrossed(issues, "+1", 5);
    assert.deepStrictEqual(
      crossed.map((c) => c.issue.number),
      [2, 3]
    );
    assert.strictEqual(crossed.find((c) => c.issue.number === 2).count, 5);
  });

  test("below threshold is excluded", () => {
    const crossed = selectCrossed(issues, "+1", 100);
    assert.deepStrictEqual(crossed, []);
  });

  test("pull requests are excluded even when over threshold", () => {
    const crossed = selectCrossed(issues, "+1", 1);
    assert.ok(!crossed.some((c) => c.issue.number === 4));
  });

  test("reads the count for the requested reaction only", () => {
    const crossed = selectCrossed(issues, "heart", 10);
    assert.deepStrictEqual(
      crossed.map((c) => c.issue.number),
      [6]
    );
  });

  test("missing reactions object reads as zero", () => {
    const crossed = selectCrossed(issues, "+1", 1);
    assert.ok(!crossed.some((c) => c.issue.number === 5));
  });
});

describe("alreadyActed", () => {
  test("label mode: already-labeled issues are excluded", () => {
    const labeled = { number: 1, labels: [{ name: "popular" }, { name: "bug" }] };
    const unlabeled = { number: 2, labels: [{ name: "bug" }] };
    assert.strictEqual(alreadyActed(labeled, "label", "popular"), true);
    assert.strictEqual(alreadyActed(unlabeled, "label", "popular"), false);
  });

  test("label mode: supports string labels", () => {
    const issue = { number: 1, labels: ["popular"] };
    assert.strictEqual(alreadyActed(issue, "label", "popular"), true);
  });

  test("label mode: missing labels array is not acted", () => {
    assert.strictEqual(alreadyActed({ number: 1 }, "label", "popular"), false);
  });

  test("comment mode: uses the caller-supplied flag", () => {
    assert.strictEqual(alreadyActed({ number: 1 }, "comment", "popular", true), true);
    assert.strictEqual(alreadyActed({ number: 1 }, "comment", "popular", false), false);
  });

  test("close mode: open issues are never pre-acted", () => {
    assert.strictEqual(alreadyActed({ number: 1 }, "close", "popular"), false);
  });
});

describe("renderComment", () => {
  test("templates {count} and {reaction} and appends the marker", () => {
    const body = renderComment("Crossed {count} :{reaction}: reactions.", 14, "+1");
    assert.ok(body.includes("Crossed 14 :+1: reactions."));
    assert.ok(body.includes(COMMENT_MARKER));
  });

  test("replaces every occurrence", () => {
    const body = renderComment("{count}/{count} {reaction}{reaction}", 3, "heart");
    assert.ok(body.startsWith("3/3 heartheart"));
  });
});

describe("toReportRow", () => {
  test("shapes a report row with the documented fields", () => {
    const row = toReportRow({ number: 12, title: "Add dark mode" }, 14, "labeled");
    assert.deepStrictEqual(row, {
      number: 12,
      title: "Add dark mode",
      reactions: 14,
      action: "labeled",
    });
  });

  test("carries each documented action verbatim", () => {
    for (const action of [
      "labeled",
      "commented",
      "closed",
      "would-close",
      "skipped-already-acted",
    ]) {
      assert.strictEqual(toReportRow({ number: 1, title: "t" }, 5, action).action, action);
    }
  });
});
