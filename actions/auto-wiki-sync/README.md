# auto-wiki-sync

[![test-auto-wiki-sync](https://github.com/builtbyadam/actions/actions/workflows/test-auto-wiki-sync.yml/badge.svg)](https://github.com/builtbyadam/actions/actions/workflows/test-auto-wiki-sync.yml)

Mirror a docs folder in your repository to that repository's GitHub **wiki**, so
the wiki is generated from version-controlled Markdown instead of edited by hand.
Reach for it when you want PR-reviewed docs that publish to the wiki on merge —
searching for *"sync docs folder to GitHub wiki"*, *"publish markdown to wiki in
Actions"*, or *"`Repository not found` when pushing to `<repo>.wiki.git`"*.

On each run the action:

1. Clones the target repo's wiki (`<repo>.wiki.git`) over HTTPS using a token.
2. `rsync`s your docs folder into the wiki working tree (additive by default; set
   `clean: "true"` for an exact, destructive mirror).
3. Optionally rewrites relative `.md` links into extensionless wiki links
   (GitHub wikis serve pages without the `.md` suffix), preserving `#anchors` and
   leaving external URLs untouched.
4. Commits as `github-actions[bot]` and pushes — only if something actually changed.

## Two facts to know before you start

1. **The built-in `GITHUB_TOKEN` is enough for a same-repo sync.** Just grant the
   job `permissions: contents: write`. No PAT is required when the wiki belongs to
   the repository running the workflow.
2. **An uninitialized wiki cannot be created by a push.** GitHub only provisions a
   repo's wiki Git remote after the **first page is created through the web UI**.
   Until then, cloning/pushing `<repo>.wiki.git` returns `Repository not found`.
   Visit `https://github.com/<owner>/<repo>/wiki` once and create any page. This
   action fails loudly with that exact guidance if the wiki was never initialized.

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
      - uses: actions/checkout@<commit-sha>
      - uses: builtbyadam/actions/auto-wiki-sync@<commit-sha>
        with:
          docs-folder: docs
```

### Cross-repo (sync into another repo's wiki, requires a PAT)

The built-in `GITHUB_TOKEN` only has rights to its own repo. To push into a
**different** repository's wiki, supply a Personal Access Token (classic, `repo`
scope — or a fine-grained PAT with Contents: write on the target) and set
`repository`.

```yaml
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<commit-sha>
      - uses: builtbyadam/actions/auto-wiki-sync@<commit-sha>
        with:
          docs-folder: docs
          repository: some-owner/some-other-repo
          token: ${{ secrets.WIKI_PAT }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `docs-folder` | yes | — | Path (relative to the workspace) of the folder to mirror into the wiki. |
| `token` | no | `${{ github.token }}` | Token used to clone and push the wiki. Needs `contents: write`. For cross-repo syncs, supply a PAT with access to the target. |
| `repository` | no | `${{ github.repository }}` | Target repository (`owner/name`) whose wiki to sync. Cross-repo syncs require a PAT in `token`. |
| `wiki-remote` | no | `""` | Advanced: override the wiki git remote URL (for GitHub Enterprise Server or local testing). When empty, the remote is derived from `repository` + `token`. |
| `commit-message` | no | `docs: sync wiki ({sha})` | Wiki commit message. The literal token `{sha}` is replaced with the short (7-char) commit SHA. |
| `strip-md-extensions` | no | `"true"` | When `true`, rewrite relative `.md` links to extensionless wiki links. |
| `clean` | no | `"false"` | When `true`, use `rsync --delete` so the wiki **exactly** mirrors the source — pages absent from `docs-folder` are **deleted** (destructive). Default is additive. |
| `dry-run` | no | `"false"` | When `true`, report what would change (and set outputs) **without** committing or pushing. |

## Outputs

| Output | Description |
|---|---|
| `changed` | `"true"` if the wiki content changed (or, under `dry-run`, would change); otherwise `"false"`. |
| `files-synced` | Number of files copied from `docs-folder` into the wiki working tree. |

## Link-rewrite behavior (`strip-md-extensions: true`)

| Source link | Rewritten to | Why |
|---|---|---|
| `[Page One](Page-One.md)` | `[Page One](Page-One)` | Wikis serve pages without `.md`. |
| `[Section](Page-One.md#some-heading)` | `[Section](Page-One#some-heading)` | Trailing `.md` stripped, `#anchor` preserved. |
| `[example](https://example.org)` | unchanged | External URL — the `:` in `https://` excludes it from the match. |
| `[deep](https://example.org/page#frag)` | unchanged | External URL with anchor — left fully intact. |

## How it works

The clone/rsync/commit/push happens in the composite step; the link rewrite is a
small, dependency-free Node module (`src/rewrite-links.js`, Node builtins only) so
the rewrite rules are unit-tested directly. The push only happens when
`git diff --cached` is non-empty, so unchanged runs are a clean no-op.

## Limitations

- **Linux runners.** Requires `rsync` and `git`, present on GitHub-hosted Ubuntu
  runners.
- **`clean: "true"` is destructive.** Any page present in the wiki but **not** in
  `docs-folder` is removed so the wiki is an exact mirror. The default (`false`)
  is additive and never deletes.
- **The wiki must be initialized once via the web UI** before the first run (see
  above) — a push cannot create an uninitialized wiki.

## License

[MIT](../../LICENSE)
