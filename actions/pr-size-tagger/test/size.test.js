const { test, describe } = require("node:test");
const assert = require("node:assert");
const { parseBins, pickLabel, computeLines, labelsToRemove } = require("../src/size");

const DEFAULT_BINS_JSON =
  '{"size/XS":10,"size/S":100,"size/M":500,"size/L":1000,"size/XL":999999999}';

describe("parseBins", () => {
  test("parses and sorts ascending by max", () => {
    const bins = parseBins('{"big":100,"small":10,"mid":50}');
    assert.deepStrictEqual(bins, [
      { label: "small", max: 10 },
      { label: "mid", max: 50 },
      { label: "big", max: 100 },
    ]);
  });

  test("parses the default bins", () => {
    const bins = parseBins(DEFAULT_BINS_JSON);
    assert.deepStrictEqual(
      bins.map((b) => b.label),
      ["size/XS", "size/S", "size/M", "size/L", "size/XL"]
    );
  });

  test("rejects invalid JSON", () => {
    assert.throws(() => parseBins("{nope"), /is not valid JSON/);
  });

  test("rejects non-object JSON", () => {
    assert.throws(() => parseBins("[1,2]"), /must be a JSON object/);
    assert.throws(() => parseBins("42"), /must be a JSON object/);
  });

  test("rejects empty object", () => {
    assert.throws(() => parseBins("{}"), /non-empty JSON object/);
  });

  test("rejects non-positive or non-integer values", () => {
    assert.throws(() => parseBins('{"x":0}'), /must be a positive integer/);
    assert.throws(() => parseBins('{"x":-5}'), /must be a positive integer/);
    assert.throws(() => parseBins('{"x":1.5}'), /must be a positive integer/);
    assert.throws(() => parseBins('{"x":"10"}'), /must be a positive integer/);
  });
});

describe("pickLabel", () => {
  const bins = parseBins(DEFAULT_BINS_JSON);

  test("zero lines lands in the smallest bin", () => {
    assert.strictEqual(pickLabel(bins, 0), "size/XS");
  });

  test("exactly at a bin max picks that bin", () => {
    assert.strictEqual(pickLabel(bins, 10), "size/XS");
    assert.strictEqual(pickLabel(bins, 100), "size/S");
    assert.strictEqual(pickLabel(bins, 500), "size/M");
  });

  test("max+1 rolls up to the next bin", () => {
    assert.strictEqual(pickLabel(bins, 11), "size/S");
    assert.strictEqual(pickLabel(bins, 101), "size/M");
    assert.strictEqual(pickLabel(bins, 501), "size/L");
    assert.strictEqual(pickLabel(bins, 1001), "size/XL");
  });

  test("counts beyond every bin clamp to the largest bin", () => {
    const smallBins = parseBins('{"a":10,"b":20}');
    assert.strictEqual(pickLabel(smallBins, 1000), "b");
  });

  test("custom bins work", () => {
    const custom = parseBins('{"tiny":5,"huge":50}');
    assert.strictEqual(pickLabel(custom, 3), "tiny");
    assert.strictEqual(pickLabel(custom, 5), "tiny");
    assert.strictEqual(pickLabel(custom, 6), "huge");
    assert.strictEqual(pickLabel(custom, 49), "huge");
  });
});

describe("computeLines", () => {
  test('"changed" mode sums additions and deletions', () => {
    assert.strictEqual(computeLines(120, 30, "changed"), 150);
  });

  test('"additions" mode counts additions only', () => {
    assert.strictEqual(computeLines(120, 30, "additions"), 120);
  });

  test("missing/undefined values coerce to zero", () => {
    assert.strictEqual(computeLines(undefined, undefined, "changed"), 0);
    assert.strictEqual(computeLines(10, undefined, "changed"), 10);
  });
});

describe("labelsToRemove", () => {
  const binLabels = ["size/XS", "size/S", "size/M", "size/L", "size/XL"];

  test("removes other bin labels", () => {
    assert.deepStrictEqual(
      labelsToRemove(["size/XS", "size/L"], binLabels, "size/M"),
      ["size/XS", "size/L"]
    );
  });

  test("keeps unrelated labels", () => {
    assert.deepStrictEqual(
      labelsToRemove(["bug", "size/S", "needs-review"], binLabels, "size/M"),
      ["size/S"]
    );
  });

  test("keeps the chosen label if already present", () => {
    assert.deepStrictEqual(
      labelsToRemove(["size/M", "bug"], binLabels, "size/M"),
      []
    );
  });

  test("removes the others but keeps the chosen one", () => {
    assert.deepStrictEqual(
      labelsToRemove(["size/XS", "size/M", "docs"], binLabels, "size/M"),
      ["size/XS"]
    );
  });

  test("no bin labels present yields nothing to remove", () => {
    assert.deepStrictEqual(labelsToRemove(["bug", "docs"], binLabels, "size/M"), []);
  });
});
