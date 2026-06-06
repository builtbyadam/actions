# Contributing

Thanks for considering a contribution. This repo has one rule that everything else follows from: **an action only lands if it actually works, is documented, and has a test that proves it.** That's what keeps this collection trustworthy.

## What belongs here

- Actions that solve a real, specific problem well.
- Both novel/custom actions and clean reference versions of common ones.
- Anything you'd be comfortable depending on in production.

What doesn't belong: untested snippets, thin wrappers with no added value, or anything that can't demonstrate it runs.

## Adding a new action

1. **Copy the template.** Start from `templates/new-action/` — don't build from scratch:
   ```bash
   cp -r templates/new-action actions/<your-action-name>
   ```
2. **Name it.** Set a clear, lowercase, hyphenated directory name. The `name:` in `action.yml` must be descriptive. If the action might ever be published to the Marketplace, the `name:` has to be globally unique across the Marketplace (and can't collide with a GitHub user, org, category, or feature name) — worth checking early.
3. **Implement it.**
   - **JavaScript actions:** write source in `src/`, bundle to `dist/` with `ncc` (`npx @vercel/ncc build src/index.js -o dist`), and **commit the `dist/` output** — actions run the committed bundle.
   - **Composite actions:** put the `steps:` directly in `action.yml`; no build step.
4. **Write the README.** Each action has its own `README.md` covering: what it solves, an inputs/outputs table, and a copy-paste usage example. Mention the concrete error messages or use cases someone would search for — that's how people find it.
5. **Write the test workflow.** Add `.github/workflows/test-<your-action-name>.yml` that runs on PRs touching `actions/<your-action-name>/**`, invokes the action against a realistic input, and **asserts on the result** (the job must fail if the output is wrong). This is non-negotiable — the test is what proves the action works.
6. **Pin everything to commit SHAs.** Every `uses:` in your test workflow must reference a full commit SHA, not a tag or branch.
7. **Open a PR.** Your test workflow runs automatically and self-validates the action.

## Non-negotiables

These are the standards every action must meet:

- **A passing test workflow.** No exceptions.
- **SHA-pinned dependencies.** Tags and branches are mutable; SHAs aren't.
- **Dry-run by default for anything destructive.** If the action deletes, closes, or otherwise mutates state, the default behavior must be to report what it *would* do, with the destructive path gated behind an explicit input.
- **Its own README** with inputs, outputs, and a usage example.

## Improving an existing action

Bug fixes and improvements are very welcome. Keep changes scoped to one action per PR where possible, update its README if behavior changes, and make sure its test still passes (extend the test if you're adding behavior).

## Review

PRs are reviewed as quickly as I can manage. Expect questions aimed at keeping the quality bar consistent, not at gatekeeping — the goal is to get good actions merged. Be patient and kind, and I'll do the same.

## License

By contributing, you agree that your contributions are licensed under the repository's [MIT License](LICENSE).