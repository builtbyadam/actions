"use strict";

const fs = require("node:fs");
const path = require("node:path");

// Strip a trailing `.md` from RELATIVE markdown link targets so they resolve as
// GitHub wiki pages (which are served without the `.md` suffix):
//
//   [text](Page-One.md)              -> [text](Page-One)
//   [text](Page-One.md#some-heading) -> [text](Page-One#some-heading)
//
// The character class [^):#?]+ excludes ':' so absolute URLs (https://...) never
// match, and excludes '#'/'?' so anchors/query strings are captured by the
// optional second group rather than swallowed by the path. An unmatched optional
// group expands to "" in String.prototype.replace, so anchorless links are fine.
const LINK_RE = /\]\(([^):#?]+)\.md(#[^)]*)?\)/g;

function rewriteLinks(text) {
  if (text == null) return "";
  return String(text).replace(LINK_RE, "]($1$2)");
}

// Recursively yield every *.md file path under `dir`.
function findMarkdownFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git") continue;
      out.push(...findMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

// Rewrite every markdown file under `dir` in place. Returns the number of files
// whose content actually changed.
function rewriteTree(dir) {
  let changed = 0;
  for (const file of findMarkdownFiles(dir)) {
    const before = fs.readFileSync(file, "utf8");
    const after = rewriteLinks(before);
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed += 1;
    }
  }
  return changed;
}

// Entrypoint. Reads the wiki working-tree path from the env var the composite
// step sets, rewrites in place, and logs how many files changed.
function main() {
  const dir = process.env.AUTO_WIKI_SYNC_DIR;
  if (!dir) {
    console.error("AUTO_WIKI_SYNC_DIR is not set; nothing to rewrite.");
    process.exit(1);
  }
  const changed = rewriteTree(dir);
  console.log(`Rewrote .md links in ${changed} file(s).`);
}

if (require.main === module) {
  main();
}

module.exports = { LINK_RE, rewriteLinks, findMarkdownFiles, rewriteTree };
