<div align="center">

# 🐦 downstream-canary

**Catch breaking changes before you ship them — by building a real consumer against your latest checkout.**

Reverse-dependency testing in CI: prove a known consumer still builds against your unreleased code.

<br>

[![Marketplace](https://img.shields.io/badge/Marketplace-downstream--canary-2088FF?logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/downstream-canary)
[![CI](https://github.com/builtbyadam/actions/actions/workflows/test-downstream-canary.yml/badge.svg)](https://github.com/builtbyadam/actions/actions/workflows/test-downstream-canary.yml)
[![Release](https://img.shields.io/github/v/release/builtbyadam/downstream-canary?sort=semver)](https://github.com/builtbyadam/downstream-canary/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Stars](https://img.shields.io/github/stars/builtbyadam/downstream-canary?style=social)](https://github.com/builtbyadam/downstream-canary/stargazers)

</div>

---

## The problem

Your library's own tests pass, you release, and a downstream consumer breaks because of a subtle API change. The break was discoverable — you just never built a real consumer against your unreleased code.

## What it does

Checks out a downstream repo, optionally points it at your local checkout, runs its build/test command, and fails if the consumer breaks — so you find out *before* the release, not after. The downstream repo is cloned strictly read-only.

## Usage

```yaml
on:
  push:
    branches: [main]

jobs:
  canary:
    runs-on: ubuntu-latest
    steps:
      # Your library checks out at the workspace root, so a relative link-step
      # like "npm link ../.." from inside the downstream work dir reaches it.
      - uses: actions/checkout@<sha>

      - id: canary
        uses: builtbyadam/actions/downstream-canary@<commit-sha>
        with:
          downstream-repo: my-org/example-consumer
          downstream-ref: main
          link-step: npm link ../..
          build-command: npm ci && npm test

      - run: echo "downstream passed=${{ steps.canary.outputs.passed }}"
```

For a private downstream repo, pass a token with read access:

```yaml
      - uses: builtbyadam/actions/downstream-canary@<commit-sha>
        with:
          downstream-repo: my-org/private-consumer
          build-command: ./gradlew build
          github-token: ${{ secrets.DOWNSTREAM_READ_TOKEN }}
```

To **report only** without failing the job — and gate on the output yourself:

```yaml
      - id: canary
        uses: builtbyadam/actions/downstream-canary@<commit-sha>
        with:
          downstream-repo: my-org/example-consumer
          build-command: npm ci && npm test
          fail-on-breakage: "false"   # report the breakage but exit 0
      - if: steps.canary.outputs.passed != 'true'
        run: echo "::warning::downstream broke — review before releasing"
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `downstream-repo` | ✅ | — | Downstream consumer repo in `owner/repo` form (e.g. `octocat/widget`). Cloned read-only. |
| `downstream-ref` | | `main` | Git ref (branch, tag, or SHA) of the downstream repo to check out. |
| `build-command` | ✅ | — | Command run in the downstream checkout to build/test it. Must be non-empty; a non-zero exit is treated as a breakage. |
| `link-step` | | `""` | Command run in the downstream checkout *before* `build-command`, used to point it at your code (e.g. `npm link ../..`). Empty = skipped. |
| `fail-on-breakage` | | `"true"` | `"true"` exits non-zero on breakage (after writing outputs); `"false"` reports only and exits 0 so you can gate on `passed`. |
| `work-path` | | `downstream-canary-work` | Workspace-relative path the downstream repo is checked out into. Override when running the action more than once in a job so checkouts don't collide. Must be relative and contain no `..`. |
| `github-token` | | `${{ github.token }}` | Token passed to checkout. The default works for public repos; supply a PAT with read access for private downstream repos. |

## Outputs

| Output | Description |
|---|---|
| `passed` | `"true"` if the downstream build exited 0, otherwise `"false"`. |
| `log-excerpt` | The last (up to) 50 lines of the combined link-step + build-command output. |

## How it works

1. **Validate** the inputs: `downstream-repo` must be `owner/repo`, `downstream-ref` and `build-command` must be non-empty, `fail-on-breakage` must be `"true"`/`"false"`, and `work-path` must be a relative path without `..`.
2. **Checkout** the downstream repo (read-only) into `work-path` inside the workspace via `actions/checkout`. Your own consumer-of-this-action checkout lives at the workspace root, so relative link-steps such as `npm link ../..` from inside the downstream dir can reach it.
3. **Run** the optional `link-step` and then `build-command` inside the downstream checkout, chained with `&&` so a failing link-step short-circuits the build. Combined stdout/stderr is captured to a log under `$RUNNER_TEMP`; the build's failure does not abort the step — the exit code is captured and handed on.
4. **Report** via `src/excerpt.js`: it reads the log, takes the last 50 lines, writes the `passed` and `log-excerpt` outputs, and prints a `Downstream build PASSED/FAILED (exit N)` summary plus the excerpt to the job log.
5. **Gate**: if the build failed and `fail-on-breakage` is `"true"`, the action exits non-zero; otherwise it exits 0 and you branch on the `passed` output.

## Safety

The action is strictly **read-only** against the downstream repo: it clones it and runs your build command, but never pushes, tags, or otherwise writes back. All side effects are confined to the runner workspace and `$RUNNER_TEMP`. Anything your `build-command` or `link-step` writes is your own responsibility — keep them read-only relative to anything outside the workspace.

Note that the action does not install toolchains — set up Node/Python/etc. (e.g. `actions/setup-node`) earlier in the job. Running the action multiple times in one job requires a distinct `work-path` per invocation to avoid checkout collisions.

## License

[MIT](../../LICENSE)
