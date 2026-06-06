# actions

A curated monorepo of high-quality, publicly usable GitHub Actions — custom and standard, condensed and maintained in one place. Every action here is self-contained, documented, and backed by a test workflow that proves it runs.

No abandoned slop. If it's listed below, it has a green check.

## Using an action

Reference any action directly from this repo by path, pinned to a commit SHA:

```yaml
- uses: builtbyadam/actions/<action-name>@<commit-sha>
  with:
    some-input: value
```

Pinning to a full commit SHA (rather than a tag or branch) is the recommended practice for supply-chain safety. Each action's README shows its exact inputs and a copy-paste example.

A few flagship actions are also mirrored to standalone repositories and published on the GitHub Marketplace; where that's the case, the action's README links to the mirror.

## Available actions

> Filled in as actions land. Each row links to the action's own README.

| Action | Description | Type |
|---|---|---|
| [matrix-shrinker](actions/matrix-shrinker) | Emits a job matrix containing only the entries relevant to the changed paths. | JS |
| [artifact-sweeper](actions/artifact-sweeper) | Deletes old workflow artifacts and caches to reclaim storage; dry-run by default. | JS |
| [license-auditor](actions/license-auditor) | Fails the build when a dependency's license violates an allow/deny SPDX policy. | Composite |
| [pr-size-tagger](actions/pr-size-tagger) | Labels a pull request by size bin (size/XS–XL) with an optional too-large warning. | JS |
| [secret-canary](actions/secret-canary) | Scans for leaked secrets (gitleaks/trufflehog) and posts a redacted PR comment. | Composite |
| [stale-branch-reaper](actions/stale-branch-reaper) | Lists (optionally deletes) merged branches older than N days; dry-run by default. | JS |
| [changelog-from-commits](actions/changelog-from-commits) | Builds a changelog from conventional commits and opens a PR. | JS |
| [downstream-canary](actions/downstream-canary) | Builds a downstream consumer against your latest main to catch breaking changes early. | Composite |
| [runner-cost-reporter](actions/runner-cost-reporter) | Totals runner minutes per workflow and posts a weekly summary issue. | JS |
| [reaction-triage](actions/reaction-triage) | Labels or closes issues when emoji reactions cross a threshold. | JS |
| [concurrency-deploy-gate](.github/workflows/concurrency-deploy-gate.yml) | Serializes deploys per environment so they can never race. | Reusable workflow |

## Repository layout

```
actions/            One folder per action (action.yml, README, tests)
templates/          Copy-to-start scaffold for new actions
scripts/            Sync tooling for mirrored flagship actions
.github/workflows/  CI plus one test workflow per action
```

## Principles

These are why this repo stays trustworthy:

1. **Every action ships with a passing test workflow.** The green check is the credibility.
2. **Everything is pinned to commit SHAs**, kept current by Dependabot.
3. **One action per directory**, fully self-contained with its own README.
4. **Destructive actions default to dry-run** — they report before they act.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or improve an action — there's a template to copy and a short checklist. The bar is simply: it works, it's documented, and it has a test.

## License

[MIT](LICENSE) — free to use, modify, and distribute.
