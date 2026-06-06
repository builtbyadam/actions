<div align="center">

# 👍 reaction-triage

**Let your community triage issues. Auto-label, comment, or close open issues based on emoji reactions crossing a threshold.**

Closing is gated behind a `confirm` flag and defaults to a dry-run, so you can preview the blast radius first.

<br>

[![Marketplace](https://img.shields.io/badge/Marketplace-reaction--triage-2088FF?logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/reaction-triage)
[![CI](https://github.com/builtbyadam/actions/actions/workflows/test-reaction-triage.yml/badge.svg)](https://github.com/builtbyadam/actions/actions/workflows/test-reaction-triage.yml)
[![Release](https://img.shields.io/github/v/release/builtbyadam/reaction-triage?sort=semver)](https://github.com/builtbyadam/reaction-triage/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Stars](https://img.shields.io/github/stars/builtbyadam/reaction-triage?style=social)](https://github.com/builtbyadam/reaction-triage/stargazers)

</div>

---

## The problem

Popular repos drown in feature requests. Maintainers can't tell signal from noise, and "+1" comments are useless for sorting. Reactions are the real signal — if something acts on them.

## What it does

Counts the emoji reactions already on each open issue and, when a chosen reaction crosses a threshold (`>=`), applies a label, posts a comment, or closes the issue. Comment mode is idempotent (a hidden marker stops it commenting twice), and close mode is semi-destructive — gated behind a `confirm` flag that defaults to a dry-run.

## Usage

Label issues that reach 10 thumbs-up (acts directly, reversible):

```yaml
on:
  schedule:
    - cron: "0 6 * * *"

jobs:
  triage:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - uses: builtbyadam/actions/reaction-triage@<commit-sha>
        with:
          reaction: "+1"
          threshold: "10"
          on-cross: label
          label-name: popular
```

Comment once on issues that reach 25 hearts (`{count}`/`{reaction}` are templated, never double-posts):

```yaml
      - uses: builtbyadam/actions/reaction-triage@<commit-sha>
        with:
          reaction: heart
          threshold: "25"
          on-cross: comment
          comment-body: "This issue crossed {count} :{reaction}: reactions and is on the triage radar."
```

Close unpopular issues — preview first, then flip `confirm` to `"true"`:

```yaml
      - uses: builtbyadam/actions/reaction-triage@<commit-sha>
        with:
          reaction: "-1"
          threshold: "5"
          on-cross: close
          confirm: "false" # dry-run: reports "would-close", mutates nothing
```

The job needs `permissions: issues: write` to label, comment, or close. A read-only run that only previews close mode (`confirm: "false"`) works with `issues: read`.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `reaction` | | `+1` | Reaction to count. One of `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`, `rocket`, `eyes`. |
| `threshold` | ✅ | — | Reaction count an issue must reach (`>=`) to be acted on. Positive integer. |
| `on-cross` | | `label` | What to do on crossing: `label`, `comment`, or `close`. |
| `label-name` | | `popular` | Label added in `label` mode. |
| `comment-body` | | (see below) | Comment posted in `comment` mode. `{count}` and `{reaction}` are templated; a hidden marker is appended. |
| `confirm` | | `false` | Set `"true"` to actually close in `close` mode. No effect on `label`/`comment`. |
| `github-token` | | `${{ github.token }}` | Token used to list issues and apply changes. Needs `issues:write` to mutate. |

Default `comment-body`: `This issue crossed {count} :{reaction}: reactions and has been flagged for triage.`

## Outputs

| Output | Description |
|---|---|
| `affected-count` | Number of issues actually acted on. `0` in close-mode dry-run. |
| `report` | JSON array of `{number, title, reactions, action}` where `action` is `labeled`, `commented`, `closed`, `would-close`, or `skipped-already-acted`. |

## How it works

1. Open issues are listed via `issues.listForRepo` (`state: open`, paginated). Reaction counts are read straight off the embedded `issue.reactions` object — no per-issue reactions API calls.
2. Pull requests are excluded (the issues endpoint returns them; entries with a `pull_request` key are skipped).
3. Any issue whose count for `reaction` is `>= threshold` crosses. The threshold is inclusive.
4. For each crossing issue the action acts according to `on-cross`:
   - **label** — adds `label-name`; issues already carrying that label are skipped (`skipped-already-acted`).
   - **comment** — posts `comment-body` with substitutions and a hidden `<!-- reaction-triage -->` marker; before commenting it paginates the issue's comments and skips any already carrying the marker, so re-runs never double-comment.
   - **close** — closes the issue. Semi-destructive and gated behind `confirm`: when `confirm != "true"` it is a dry-run that reports `would-close`, performs zero mutations, and emits `affected-count` `0`.
5. Per-issue mutation failures emit a warning and the run continues. The action never reopens anything and never acts twice. A missing `github-token` is a safe no-op.

## Safety

Acts once per issue (tracked via a label check or comment marker) so it won't churn. Scoped to open issues only — an already-closed issue never reappears, and there is no reopen behaviour. Label and comment modes are reversible and act directly; only `close` mode is gated behind `confirm`. Treat close as semi-destructive and test on a label first.

## Limitations

- Only the embedded `issue.reactions` counts are used; reactions on individual comments are not summed.
- This action triages issues, not PRs — pull requests returned by the issues endpoint are filtered out.

## License

[MIT](../../LICENSE)
