<div align="center">

# ⚡ matrix-shrinker

**Shrink a CI job matrix down to only the entries whose paths actually changed.**

Stop running your entire test matrix on a one-line docs edit.

<br>

[![Marketplace](https://img.shields.io/badge/Marketplace-matrix--shrinker-2088FF?logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/matrix-shrinker)
[![CI](https://github.com/builtbyadam/actions/actions/workflows/test-matrix-shrinker.yml/badge.svg)](https://github.com/builtbyadam/actions/actions/workflows/test-matrix-shrinker.yml)
[![Release](https://img.shields.io/github/v/release/builtbyadam/matrix-shrinker?sort=semver)](https://github.com/builtbyadam/matrix-shrinker/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Stars](https://img.shields.io/github/stars/builtbyadam/matrix-shrinker?style=social)](https://github.com/builtbyadam/matrix-shrinker/stargazers)

</div>

---

## The problem

A monorepo with `api/`, `web/`, and `docs/` runs all three test suites on every PR — even when only the docs changed. CI minutes burn, queues back up, and reviewers wait on jobs that couldn't possibly be affected.

## What it does

You pass in your full matrix and a set of **path → entry** rules. The action diffs the changed files, figures out which rules are active, and emits a shrunk matrix containing only the relevant entries. Feed it straight to `fromJSON()`.

## Usage

```yaml
jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.shrink.outputs.matrix }}
      count: ${{ steps.shrink.outputs.count }}
    steps:
      - id: shrink
        uses: builtbyadam/actions/matrix-shrinker@<commit-sha>
        with:
          matrix: |
            {"include": [
              {"name": "api",  "dir": "packages/api"},
              {"name": "web",  "dir": "packages/web"},
              {"name": "docs", "dir": "docs"}
            ]}
          rules: |
            [
              {"paths": ["packages/api/**", "packages/shared/**"], "select": {"name": "api"}},
              {"paths": ["packages/web/**", "packages/shared/**"], "select": {"name": "web"}},
              {"paths": ["docs/**"],                               "select": {"name": "docs"}},
              {"paths": [".github/workflows/**"]}
            ]

  test:
    needs: plan
    if: needs.plan.outputs.count != '0'
    runs-on: ubuntu-latest
    strategy:
      matrix: ${{ fromJSON(needs.plan.outputs.matrix) }}
    steps:
      - uses: actions/checkout@<sha>
      - run: cd ${{ matrix.dir }} && make test
```

A rule with **no `select`** (the `.github/workflows/**` rule above) is a catch-all: when it's active, *every* entry is kept. Use it for "infra changed, run everything."

The `if:` guard on the consuming job matters: GitHub Actions fails a job whose matrix expands to zero entries, so skip it when `count` is `0`.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `matrix` | ✅ | — | Full matrix JSON: `{"include":[...]}` or a bare array of entry objects. |
| `rules` | ✅ | — | JSON array of `{"paths":[globs], "select":{...}}`. Omit `select` to keep all entries. |
| `changed-files` | | `""` | Newline-separated paths. When empty, derived from the PR/push via the API. |
| `github-token` | | `${{ github.token }}` | Used to derive changed files when `changed-files` is omitted. |
| `fallback` | | `full` | When changed files can't be determined: `full` (whole matrix, safe) or `empty`. |

## Outputs

| Output | Description |
|---|---|
| `matrix` | Shrunk matrix as `{"include":[...]}`. Feed to `fromJSON()`. |
| `count` | Number of entries kept. Use it to skip the consuming job when `0`. |
| `skipped` | Number of entries dropped. |

## Glob syntax

`*` matches within a path segment, `?` a single character, `**/` zero or more leading directories, trailing/bare `**` matches recursively. Globs match full repo-relative paths.

## How it works

A rule is **active** when any changed file matches any of its globs. An entry is **kept** when any active rule selects it (string-compared key/value pairs; empty/omitted `select` matches everything). Entries are never duplicated. Pure matching logic is unit-tested independently of the GitHub API.

The changed file list comes from `changed-files`, or is derived from the triggering event: `pulls.listFiles` for pull requests (paginated, so large PRs are fine), `compareCommits` between `before...after` for pushes. Derivation needs `permissions: pull-requests: read` (PRs) or `contents: read` (pushes) on the calling job — without it the action logs a warning and applies `fallback`.

## Safety

Failure mode is deliberately safe: if the changed files can't be determined (e.g. a `workflow_dispatch` event, a force-push with an unknown `before`, or an API error), the action emits the **full** matrix by default rather than silently skipping tests. Set `fallback: empty` to invert that.

## Limitations

- Only the `include` form of a matrix is supported, not the cross-product `matrix: {os: [...], node: [...]}` form — express the product as explicit `include` entries.
- Rules match changed *paths* only; it does not inspect file contents or build graphs. For dependency-aware selection, generate the `rules` input from your build tool.

## License

[MIT](../../LICENSE)
