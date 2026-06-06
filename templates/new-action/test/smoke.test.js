const { test } = require("node:test");
const assert = require("node:assert");

// Example unit test of pure logic. Real actions should test their
// actual exported functions and/or run the built action in the
// test workflow (see .github/workflows/test-<action>.yml).
test("uppercases its input", () => {
  const input = "hello";
  assert.strictEqual(input.toUpperCase(), "HELLO");
});