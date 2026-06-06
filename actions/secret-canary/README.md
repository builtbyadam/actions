<div align="center">

# 🐤 secret-canary

**Secret scanning that posts a readable PR comment with a curated allowlist — instead of a cryptic silent failure.**

<br>

[![Marketplace](https://img.shields.io/badge/Marketplace-secret--canary-2088FF?logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/secret-canary)
[![CI](https://github.com/builtbyadam/actions/actions/workflows/test-secret-canary.yml/badge.svg)](https://github.com/builtbyadam/actions/actions/workflows/test-secret-canary.yml)
[![Release](https://img.shields.io/github/v/release/builtbyadam/secret-canary?sort=semver)](https://github.com/builtbyadam/secret-canary/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Stars](https://img.shields.io/github/stars/builtbyadam/secret-canary?style=social)](https://github.com/builtbyadam/secret-canary/stargazers)

</div>

---

## The problem

Raw secret scanners fail the build with a wall of log output, no allowlist for known-safe test fixtures, and no clear pointer to *what* tripped *where*. Reviewers tune them out.

## What it does

Runs gitleaks or trufflehog with a curated allowlist and posts a single, tidy PR comment summarizing findings — location and rule, never the secret value itself.

## Usage

```yaml
on:
  pull_request:

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write   # required so the action can comment on the PR
    steps:
      - uses: actions/checkout@<sha>
        with:
          fetch-depth: 0
      - uses: builtbyadam/actions/secret-canary@<commit-sha>
        with:
          scanner: gitleaks
          # scanner-version defaults to the pinned release for the selected scanner
          allowlist-path: .gitleaks.toml   # optional
```

To use trufflehog instead:

```yaml
      - uses: builtbyadam/actions/secret-canary@<commit-sha>
        with:
          scanner: trufflehog
          # scanner-version defaults to the pinned trufflehog release (v3.95.5)
          allowlist-path: .trufflehog-exclude.txt   # optional, exclude-paths format
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `scanner` | | `gitleaks` | `gitleaks` or `trufflehog`. |
| `scanner-version` | | `""` | Release tag of the **selected** scanner to download. When empty, the per-scanner pinned default is used: gitleaks `v8.30.1`, trufflehog `v3.95.5`. |
| `allowlist-path` | | `""` | Optional allowlist file. For **gitleaks** passed as `--config` (TOML config with an `[allowlist]` section); for **trufflehog** passed as `--exclude-paths` (newline-separated path globs). The two formats differ. |
| `comment-on-pr` | | `true` | Upsert a single summary comment on the PR (when the event is a PR with a token). |
| `fail-on-findings` | | `true` | Fail the job when findings remain after the allowlist. Set `false` to report without blocking. |
| `github-token` | | `${{ github.token }}` | Token with `pull-requests: write`. |

### Pinned scanner defaults

The download is hard-pinned to a specific release tag:

- **gitleaks:** `v8.30.1`
- **trufflehog:** `v3.95.5`

When `scanner-version` is left empty, the pin for the **selected** scanner is used automatically — selecting trufflehog without a version no longer needs a manual override. Set `scanner-version` explicitly to use a different release.

## Outputs

| Output | Description |
|---|---|
| `findings-count` | Number of potential secrets found. |
| `report` | **Redacted** JSON array of findings, each `{rule, file, line, commit?}`. Never contains the secret value or matched text. |

## How it works

1. **Validate + resolve.** Inputs are validated and the runner is checked: only Linux x64 is supported. The linux/x64 release tarball URL for the selected scanner and version is resolved.
2. **Download + verify.** The pinned release tarball is fetched with `curl -sSL` into `$RUNNER_TEMP`, extracted, and run with `--version` to confirm the binary works.
3. **Scan.** gitleaks runs `gitleaks detect --source . --no-banner --redact --report-format json --report-path … --exit-code 0` (adding `--config <allowlist-path>` when provided). trufflehog runs `trufflehog filesystem . --json --no-update` (adding `--exclude-paths` when provided); its nonzero exit codes are tolerated and the processor decides the verdict.
4. **Process + redact.** `src/report.js` parses scanner output into `{rule, file, line, commit?}`, dropping the secret value and match text at parse time and again via a redaction allowlist (defense in depth). It writes `findings-count` and `report` to `$GITHUB_OUTPUT`.
5. **Comment upsert.** When `comment-on-pr` is `"true"`, the event has a `pull_request`, and a token is present, it finds an existing comment by the marker `<!-- secret-canary-report -->` and PATCHes it, otherwise POSTs a new one. With no token or on a non-PR event it logs and skips — it fails open on the comment, not on the verdict.
6. **Verdict.** When `fail-on-findings` is `"true"` and the count is greater than zero, the action exits 1 **after** writing outputs and posting the comment.

## Safety

Secret values are **never** printed to logs or comments — only the file, line, and rule that matched. The PR comment is edited in place, not re-posted, so it never spams the thread. PR commenting needs `permissions: pull-requests: write`; without it (or without a token, or on a non-PR event) the comment step is skipped, but the scan and verdict still run.

## Limitations

- **Linux x64 runners only.** The action downloads the linux/x64 release binary and fails fast on any other OS/arch.
- The redacted `report` and PR comment intentionally never include the secret value or matched text. To inspect a match you must reproduce the scan locally.

## License

[MIT](../../LICENSE)
