<div align="center">

# 📖 auto-wiki-sync

**Generate your GitHub wiki from version-controlled Markdown instead of editing it by hand.**

Mirror a docs folder into the repository's wiki on every push, rewriting relative `.md` links to extensionless wiki links.

<br>

[![Marketplace](https://img.shields.io/badge/Marketplace-auto--wiki--sync-2088FF?logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/auto-wiki-sync)
[![CI](https://github.com/builtbyadam/actions/actions/workflows/test-auto-wiki-sync.yml/badge.svg)](https://github.com/builtbyadam/actions/actions/workflows/test-auto-wiki-sync.yml)
[![Release](https://img.shields.io/github/v/release/builtbyadam/auto-wiki-sync?sort=semver)](https://github.com/builtbyadam/auto-wiki-sync/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Stars](https://img.shields.io/github/stars/builtbyadam/auto-wiki-sync?style=social)](https://github.com/builtbyadam/auto-wiki-sync/stargazers)

</div>

---

## The problem

GitHub wikis are a separate git repo you're supposed to edit by hand — so docs drift from the code, never get PR review, and can't be generated. You want your wiki to be a published view of Markdown that lives next to the code and goes through review like everything else.

## What it does

Mirrors a docs folder in your repository into that repository's **wiki**: clones `<repo>.wiki.git`, `rsync`s the folder in, rewrites relative `.md` links into the extensionless form wikis serve (preserving `#anchors`, leaving external URLs alone), and commits/pushes as `github-actions[bot]` — only when something actually changed. Additive by default; the destructive exact-mirror is opt-in.

Two facts worth knowing before your first run:

1. **The built-in `GITHUB_TOKEN` is enough for a same-repo sync** — just grant the job `permissions: contents: write`. A PAT is only needed to push into a *different* repo's wiki.
2. **An uninitialized wiki cannot be created by a push.** GitHub only provisions the wiki remote after the first page is created through the web UI. Until then, cloning `<repo>.wiki.git` returns `Repository not found`. Visit `https://github.com/<owner>/<repo>/wiki` once and create any page — this action fails loudly with that exact guidance otherwise.

## Usage

### Minimal (same-repo, built-in token)

```yaml
name: Wiki Sync
on:
  push:
    branches: [main]
    paths:
      - "docs/**"
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: wiki-sync
  cancel-in-progress: false

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>
      - uses: builtbyadam/actions/auto-wiki-sync@<commit-sha>
        with:
          docs-folder: docs
```

### Cross-repo (sync into another repo's wiki, requires a PAT)

The built-in `GITHUB_TOKEN` only has rights to its own repo. To push into a **different** repository's wiki, supply a PAT (classic with `repo` scope, or fine-grained with Contents: write on the target) and set `repository`:

```yaml
      - uses: builtbyadam/actions/auto-wiki-sync@<commit-sha>
        with:
          docs-folder: docs
          repository: some-owner/some-other-repo
          token: ${{ secrets.WIKI_PAT }}
```

### Exact mirror (destructive) or preview (dry-run)

```yaml
      - uses: builtbyadam/actions/auto-wiki-sync@<commit-sha>
        with:
          docs-folder: docs
          clean: "true"     # delete wiki pages not present in docs-folder
          dry-run: "true"   # report what would change, push nothing
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `docs-folder` | ✅ | — | Path (relative to the workspace) of the folder to mirror into the wiki. Run `actions/checkout` first so it exists. |
| `token` | | `${{ github.token }}` | Token used to clone and push the wiki. Needs `contents: write` on the target. For cross-repo syncs, supply a PAT with access to the target. |
| `repository` | | `${{ github.repository }}` | Target repository (`owner/name`) whose wiki to sync. Cross-repo syncs require a PAT in `token`. |
| `wiki-remote` | | `""` | Advanced: override the wiki git remote URL (GitHub Enterprise Server, or local testing). When empty, it's derived from `repository` + `token`. |
| `commit-message` | | `docs: sync wiki ({sha})` | Wiki commit message. The literal token `{sha}` is replaced with the short (7-char) commit SHA. |
| `strip-md-extensions` | | `"true"` | When `"true"`, rewrite relative `.md` links to extensionless wiki links. |
| `clean` | | `"false"` | When `"true"`, use `rsync --delete` so the wiki **exactly** mirrors the source — pages absent from `docs-folder` are **deleted** (destructive). Default is additive. |
| `dry-run` | | `"false"` | When `"true"`, report what would change (and set outputs) **without** committing or pushing. |

## Outputs

| Output | Description |
|---|---|
| `changed` | `"true"` if the wiki content changed (or, under `dry-run`, would change); otherwise `"false"`. |
| `files-synced` | Number of files copied from `docs-folder` into the wiki working tree. |

## Link-rewrite behavior (`strip-md-extensions: "true"`)

| Source link | Rewritten to | Why |
|---|---|---|
| `[Page One](Page-One.md)` | `[Page One](Page-One)` | Wikis serve pages without `.md`. |
| `[Section](Page-One.md#some-heading)` | `[Section](Page-One#some-heading)` | Trailing `.md` stripped, `#anchor` preserved. |
| `[example](https://example.org)` | unchanged | External URL — the `:` in `https://` excludes it from the match. |
| `[deep](https://example.org/page#frag)` | unchanged | External URL with anchor — left fully intact. |

## How it works

1. **Validate** the inputs: `docs-folder` must exist; `strip-md-extensions`, `clean`, and `dry-run` must each be `"true"`/`"false"`; a token (or `wiki-remote`) must be present.
2. **Clone** the wiki into a temp dir (not the workspace, so repeated runs and your own files never collide). The remote is `https://x-access-token:<token>@github.com/<repository>.wiki.git` unless `wiki-remote` overrides it. A failed clone prints the exact "initialize the wiki via the web UI" guidance.
3. **Rsync** `docs-folder` into the wiki working tree — with `--delete` when `clean: "true"`, additively otherwise.
4. **Rewrite** relative `.md` links via `src/rewrite-links.js` (a small dependency-free Node module, so the rules are unit-tested directly), unless `strip-md-extensions: "false"`.
5. **Commit & push** as `github-actions[bot]`, but only when `git diff --cached` is non-empty — so unchanged runs are a clean no-op. Under `dry-run` the pending changes are printed and nothing is pushed.
6. **Outputs** `changed` and `files-synced` are written for downstream steps.

## Safety

The sync is **additive by default** (`clean: "false"`): it only adds and updates pages, never deletes. Set `clean: "true"` for an exact mirror — any page present in the wiki but **not** in `docs-folder` is then removed. Use `dry-run: "true"` to preview either mode without writing. All side effects are confined to the target wiki and a temp dir under `$RUNNER_TEMP`.

## Limitations

- **Linux runners.** Requires `rsync` and `git`, present on GitHub-hosted Ubuntu runners.
- **The wiki must be initialized once via the web UI** before the first run — a push cannot create an uninitialized wiki.
- Same-repo syncs work with the built-in token; cross-repo syncs require a PAT with Contents: write on the target.

## License

[MIT](../../LICENSE)
