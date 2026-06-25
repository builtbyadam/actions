const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { rewriteLinks, findMarkdownFiles, rewriteTree } = require("../src/rewrite-links");

describe("rewriteLinks", () => {
  test("strips a trailing .md from a relative link", () => {
    assert.strictEqual(rewriteLinks("[Page One](Page-One.md)"), "[Page One](Page-One)");
  });

  test("preserves an #anchor while stripping .md", () => {
    assert.strictEqual(
      rewriteLinks("[Section](Page-One.md#some-heading)"),
      "[Section](Page-One#some-heading)"
    );
  });

  test("leaves an absolute http(s) URL untouched", () => {
    assert.strictEqual(rewriteLinks("[ex](https://example.org)"), "[ex](https://example.org)");
  });

  test("leaves an absolute URL with a fragment untouched", () => {
    const s = "[deep](https://example.org/page#frag)";
    assert.strictEqual(rewriteLinks(s), s);
  });

  test("does not touch a .markdown that merely ends in md-like text", () => {
    // Only a literal `.md` extension is stripped; other text is preserved.
    assert.strictEqual(rewriteLinks("[x](readme.md)"), "[x](readme)");
    assert.strictEqual(rewriteLinks("[x](notes.txt)"), "[x](notes.txt)");
  });

  test("rewrites multiple links in one line", () => {
    assert.strictEqual(
      rewriteLinks("see [a](A.md) and [b](B.md#h)"),
      "see [a](A) and [b](B#h)"
    );
  });

  test("null / empty inputs yield empty string", () => {
    assert.strictEqual(rewriteLinks(null), "");
    assert.strictEqual(rewriteLinks(""), "");
  });
});

describe("findMarkdownFiles / rewriteTree", () => {
  function mkTree() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "aws-test-"));
    fs.mkdirSync(path.join(root, "sub"));
    fs.mkdirSync(path.join(root, ".git"));
    fs.writeFileSync(path.join(root, "Home.md"), "[P1](Page-One.md) [ext](https://x.io)");
    fs.writeFileSync(path.join(root, "sub", "Page-One.md"), "back to [Home](Home.md#top)");
    fs.writeFileSync(path.join(root, "notes.txt"), "[skip](Other.md)");
    fs.writeFileSync(path.join(root, ".git", "config"), "[core] x = 1");
    return root;
  }

  test("finds .md files recursively but skips .git and non-md", () => {
    const root = mkTree();
    const found = findMarkdownFiles(root).map((p) => path.relative(root, p)).sort();
    assert.deepStrictEqual(found, ["Home.md", path.join("sub", "Page-One.md")]);
  });

  test("rewrites only files that change and returns the count", () => {
    const root = mkTree();
    const changed = rewriteTree(root);
    assert.strictEqual(changed, 2);
    assert.strictEqual(
      fs.readFileSync(path.join(root, "Home.md"), "utf8"),
      "[P1](Page-One) [ext](https://x.io)"
    );
    assert.strictEqual(
      fs.readFileSync(path.join(root, "sub", "Page-One.md"), "utf8"),
      "back to [Home](Home#top)"
    );
    // .txt and .git untouched.
    assert.strictEqual(fs.readFileSync(path.join(root, "notes.txt"), "utf8"), "[skip](Other.md)");
    // Second pass is a no-op (idempotent).
    assert.strictEqual(rewriteTree(root), 0);
  });
});
