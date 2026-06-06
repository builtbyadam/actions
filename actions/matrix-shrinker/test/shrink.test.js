const { test, describe } = require("node:test");
const assert = require("node:assert");
const {
  globToRegExp,
  parseMatrix,
  parseRules,
  entryMatchesSelect,
  shrinkMatrix,
} = require("../src/shrink");

describe("globToRegExp", () => {
  test("* matches within a path segment only", () => {
    assert.ok(globToRegExp("api/*.js").test("api/server.js"));
    assert.ok(!globToRegExp("api/*.js").test("api/sub/server.js"));
  });

  test("? matches a single non-separator character", () => {
    assert.ok(globToRegExp("file?.txt").test("file1.txt"));
    assert.ok(!globToRegExp("file?.txt").test("file12.txt"));
    assert.ok(!globToRegExp("file?.txt").test("file/.txt"));
  });

  test("trailing ** matches recursively", () => {
    assert.ok(globToRegExp("api/**").test("api/server.js"));
    assert.ok(globToRegExp("api/**").test("api/deep/nested/file.js"));
    assert.ok(!globToRegExp("api/**").test("api"));
    assert.ok(!globToRegExp("api/**").test("web/api/file.js"));
  });

  test("leading **/ matches at any depth including root", () => {
    assert.ok(globToRegExp("**/test/**").test("test/x.js"));
    assert.ok(globToRegExp("**/test/**").test("a/b/test/x.js"));
    assert.ok(!globToRegExp("**/test/**").test("a/b/tests/x.js"));
  });

  test("bare ** matches everything", () => {
    assert.ok(globToRegExp("**").test("anything/at/all.txt"));
  });

  test("regex metacharacters in literals are escaped", () => {
    assert.ok(globToRegExp("pkg/file.name+x.js").test("pkg/file.name+x.js"));
    assert.ok(!globToRegExp("pkg/file.js").test("pkg/fileXjs"));
  });

  test("exact paths match exactly", () => {
    assert.ok(globToRegExp("package.json").test("package.json"));
    assert.ok(!globToRegExp("package.json").test("sub/package.json"));
  });
});

describe("parseMatrix", () => {
  test('accepts {"include": [...]} form', () => {
    assert.deepStrictEqual(parseMatrix('{"include":[{"a":1}]}'), [{ a: 1 }]);
  });

  test("accepts bare array form", () => {
    assert.deepStrictEqual(parseMatrix('[{"a":1}]'), [{ a: 1 }]);
  });

  test("rejects invalid JSON", () => {
    assert.throws(() => parseMatrix("{nope"), /not valid JSON/);
  });

  test("rejects shapes without an include array", () => {
    assert.throws(() => parseMatrix('{"foo":1}'), /must be a JSON array/);
  });

  test("rejects non-object entries", () => {
    assert.throws(() => parseMatrix('["str"]'), /must be a JSON object/);
  });
});

describe("parseRules", () => {
  test("accepts valid rules", () => {
    const rules = parseRules('[{"paths":["a/**"],"select":{"k":"v"}}]');
    assert.strictEqual(rules.length, 1);
  });

  test("rejects empty arrays", () => {
    assert.throws(() => parseRules("[]"), /non-empty JSON array/);
  });

  test("rejects rules without paths", () => {
    assert.throws(() => parseRules('[{"select":{}}]'), /"paths" array/);
  });

  test("rejects non-object select", () => {
    assert.throws(() => parseRules('[{"paths":["a"],"select":[1]}]'), /not an object/);
  });
});

describe("entryMatchesSelect", () => {
  test("empty or omitted select matches everything", () => {
    assert.ok(entryMatchesSelect({ a: 1 }, undefined));
    assert.ok(entryMatchesSelect({ a: 1 }, {}));
  });

  test("all select pairs must match (string-compared)", () => {
    assert.ok(entryMatchesSelect({ name: "api", os: "linux" }, { name: "api" }));
    assert.ok(entryMatchesSelect({ port: 8080 }, { port: "8080" }));
    assert.ok(!entryMatchesSelect({ name: "api" }, { name: "api", os: "linux" }));
  });
});

describe("shrinkMatrix", () => {
  const include = [
    { name: "api", dir: "api" },
    { name: "web", dir: "web" },
    { name: "docs", dir: "docs" },
  ];
  const rules = [
    { paths: ["api/**", "shared/**"], select: { name: "api" } },
    { paths: ["web/**", "shared/**"], select: { name: "web" } },
    { paths: ["docs/**"], select: { name: "docs" } },
  ];

  test("keeps only entries selected by active rules", () => {
    const result = shrinkMatrix(include, rules, ["api/server.js"]);
    assert.deepStrictEqual(result.include, [{ name: "api", dir: "api" }]);
    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.skipped, 2);
  });

  test("a shared path activates multiple rules", () => {
    const result = shrinkMatrix(include, rules, ["shared/util.js"]);
    assert.deepStrictEqual(
      result.include.map((e) => e.name),
      ["api", "web"]
    );
  });

  test("no matching files yields an empty matrix", () => {
    const result = shrinkMatrix(include, rules, [".gitignore"]);
    assert.deepStrictEqual(result.include, []);
    assert.strictEqual(result.count, 0);
    assert.strictEqual(result.skipped, 3);
  });

  test("a rule without select keeps every entry", () => {
    const catchAll = [...rules, { paths: [".github/**"] }];
    const result = shrinkMatrix(include, catchAll, [".github/workflows/ci.yml"]);
    assert.strictEqual(result.count, 3);
  });

  test("entries are never duplicated when multiple rules select them", () => {
    const result = shrinkMatrix(include, rules, ["api/a.js", "shared/b.js", "docs/c.md"]);
    assert.strictEqual(result.count, 3);
    assert.strictEqual(new Set(result.include.map((e) => e.name)).size, 3);
  });
});
