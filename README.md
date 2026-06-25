<div align="center">

# ⚡ actions

**A curated monorepo of high-quality, public GitHub Actions — custom and standard, condensed and maintained in one place.**

No abandoned slop. Every action is self-contained, documented, and backed by a test workflow that proves it runs.

<br>

[![CI](https://github.com/builtbyadam/actions/actions/workflows/ci.yml/badge.svg)](https://github.com/builtbyadam/actions/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Dependabot](https://img.shields.io/badge/Dependabot-enabled-025E8C?logo=dependabot)](.github/dependabot.yml)
[![SHA-pinned](https://img.shields.io/badge/deps-SHA--pinned-2ea44f)](#-principles)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Node](https://img.shields.io/badge/node-24-339933?logo=node.js&logoColor=white)](.nvmrc)

</div>

---

## 📦 Using an action

Reference any action directly from this repo, pinned to a commit SHA:

```yaml
- uses: builtbyadam/actions/matrix-shrinker@<commit-sha>
  with:
    matrix: ${{ needs.setup.outputs.matrix }}
    rules: '[{"paths":["api/**"],"select":{"name":"api"}}]'
```

> **Why SHA-pin?** Tags and branches are mutable; a pinned commit SHA can't be swapped under you. It's the recommended supply-chain practice — and Dependabot keeps the pins current automatically.

Flagship actions are also mirrored to standalone repos and published on the **GitHub Marketplace** — each row below links to its mirror.

---

## 🧰 Available actions

| Action | What it does | Type | Mirror |
|---|---|---|---|
| [**matrix-shrinker**](actions/matrix-shrinker) | Shrink a CI matrix to only the entries whose paths changed. | JS | [↗](https://github.com/builtbyadam/matrix-shrinker) |
| [**artifact-sweeper**](actions/artifact-sweeper) | Delete old artifacts & caches to reclaim storage; reports bytes freed. | JS | [↗](https://github.com/builtbyadam/artifact-sweeper) |
| [**license-auditor**](actions/license-auditor) | Fail the build on disallowed dependency licenses — no heavy SaaS scanner. | Composite | [↗](https://github.com/builtbyadam/license-auditor) |
| [**pr-size-tagger**](actions/pr-size-tagger) | Bin PRs by lines changed into size labels; warn past a threshold. | JS | [↗](https://github.com/builtbyadam/pr-size-tagger) |
| [**secret-canary**](actions/secret-canary) | Secret scanning with a curated allowlist and a PR comment, not a silent fail. | Composite | [↗](https://github.com/builtbyadam/secret-canary) |
| [**stale-branch-reaper**](actions/stale-branch-reaper) | List (optionally delete) merged branches older than N days. Dry-run by default. | JS | [↗](https://github.com/builtbyadam/stale-branch-reaper) |
| [**changelog-from-commits**](actions/changelog-from-commits) | Build a changelog from conventional commits and open a PR. | JS | [↗](https://github.com/builtbyadam/changelog-from-commits) |
| [**downstream-canary**](actions/downstream-canary) | Build a downstream consumer against your latest `main` to catch breaks early. | Composite | [↗](https://github.com/builtbyadam/downstream-canary) |
| [**runner-cost-reporter**](actions/runner-cost-reporter) | Total runner minutes per workflow; post a weekly summary issue. | JS | [↗](https://github.com/builtbyadam/runner-cost-reporter) |
| [**reaction-triage**](actions/reaction-triage) | Label or close issues when emoji reactions cross a threshold. | JS | [↗](https://github.com/builtbyadam/reaction-triage) |
| [**auto-wiki-sync**](actions/auto-wiki-sync) | Mirror a docs folder to the repo's GitHub wiki, rewriting `.md` links. Additive by default. | Composite | [↗](https://github.com/builtbyadam/auto-wiki-sync) |
| [**concurrency-deploy-gate**](.github/workflows/concurrency-deploy-gate.yml) | Serialize deploys per environment so they can never race. | Reusable workflow | — |

> Mirrors and Marketplace listings roll out per action; a mirror link may 404 until that action is published. Every listed action ships in this repo with a green test workflow first.

---

## 🗂️ Repository layout

```
actions/            One folder per action (action.yml, README, tests)
templates/          Copy-to-start scaffold for new actions
scripts/            Sync tooling for the Marketplace mirror repos
.github/workflows/  CI, one test workflow per action, and reusable workflows
```

---

## 🧭 Principles

These are why this repo stays trustworthy:

1. **Every action ships with a passing test workflow.** The green check is the credibility.
2. **Everything is pinned to commit SHAs**, kept current by Dependabot.
3. **One action per directory**, fully self-contained with its own README.
4. **Destructive actions default to dry-run** — they report before they act.

---

## 🤝 Contributing

Contributions are welcome. See **[CONTRIBUTING.md](CONTRIBUTING.md)** — there's a template to copy and a short checklist. The bar is simply: **it works, it's documented, and it has a test.**

```bash
cp -r templates/new-action actions/<your-action-name>
```

---

## 📄 License

[MIT](LICENSE) — free to use, modify, and distribute.

<div align="center">
<sub>Built and maintained with a strict no-slop policy. If it's listed, it has a green check.</sub>
</div>
