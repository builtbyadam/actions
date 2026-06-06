<div align="center">

# 🏷️ pr-size-tagger

**Automatically label pull requests by size, and nudge reviewers when one gets too big to review well.**

*Named `pr-size-tagger` because `pr-size-labeler` was already taken on the GitHub Marketplace.*

<br>

[![Marketplace](https://img.shields.io/badge/Marketplace-pr--size--tagger-2088FF?logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/pr-size-tagger)
[![CI](https://github.com/builtbyadam/actions/actions/workflows/test-pr-size-tagger.yml/badge.svg)](https://github.com/builtbyadam/actions/actions/workflows/test-pr-size-tagger.yml)
[![Release](https://img.shields.io/github/v/release/builtbyadam/pr-size-tagger?sort=semver)](https://github.com/builtbyadam/pr-size-tagger/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Stars](https://img.shields.io/github/stars/builtbyadam/pr-size-tagger?style=social)](https://github.com/builtbyadam/pr-size-tagger/stargazers)

</div>

---

## The problem

Giant PRs get rubber-stamped because nobody wants to review 2,000 lines. A visible size label sets expectations and encourages smaller, reviewable changes.

## What it does

Reads the PR diff stat, bins it into a size label (`size/XS` … `size/XL`), swaps out any previous size label so they never pile up, and optionally flags PRs over a threshold.

## Usage

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  tag:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      issues: write          # GitHub labels are managed through the issues API
    steps:
      - id: size
        uses: builtbyadam/actions/pr-size-tagger@<commit-sha>
        with:
          warn-threshold: "800"
      - run: echo "Labelled ${{ steps.size.outputs.label }} (${{ steps.size.outputs.lines }} lines)"
```

### Custom bins

```yaml
      - uses: builtbyadam/actions/pr-size-tagger@<commit-sha>
        with:
          bins: '{"size/S":50,"size/M":250,"size/L":999999999}'
          count: additions
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `bins` | | `{"size/XS":10,"size/S":100,"size/M":500,"size/L":1000,"size/XL":999999999}` | JSON object mapping `label → inclusive max changed-line count`. The bin with the largest max is the catch-all for anything bigger. |
| `count` | | `changed` | `changed` (additions + deletions) or `additions` (additions only). |
| `warn-threshold` | | `""` | Optional positive integer. Post a warning and set `over-threshold` when the line count exceeds it. Empty disables it. |
| `github-token` | | `${{ github.token }}` | Token with `pull-requests: write` (and `issues: write` to mutate labels). |

## Outputs

| Output | Description |
|---|---|
| `label` | The size label applied, or `""` when the action was a no-op. |
| `lines` | The computed changed-line count (per `count`). |
| `over-threshold` | `"true"` when the count exceeded `warn-threshold`, otherwise `"false"`. |

## How it works

1. Additions and deletions come straight from the `pull_request` event payload (`additions` / `deletions`) — no extra API call. `count` decides whether deletions are included.
2. `bins` is sorted ascending by max; the chosen label is the smallest bin whose max is `>=` the line count. A count larger than every bin clamps to the largest bin's label (the catch-all).
3. Current labels are read from the payload. Every label that is a `bins` key and is **not** the chosen label is removed (via the issues API; 404 races tolerated with a warning). The chosen label is added only if not already present — so re-running converges to exactly one size label.

## Safety

Idempotent — re-running converges to exactly one size label. Runs only on `pull_request` / `pull_request_target` events; on any other event, or when no token is available, it **fails open**: it emits `label: ""`, `lines: "0"`, `over-threshold: "false"` and never fails CI. Label mutation only — it never edits PR contents, comments, or status.

## Limitations

- Line counts are GitHub's reported `additions`/`deletions`, which include generated files, lockfiles, vendored code, etc. — there is no path-based exclusion. Filter those in review conventions, not here.

## License

[MIT](../../LICENSE)
