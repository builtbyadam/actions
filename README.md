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
