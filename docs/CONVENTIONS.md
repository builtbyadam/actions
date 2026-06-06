# Conventions standard

Every action in this repo follows this standard. It's what keeps the quality bar consistent — PRs are reviewed against it.

## Structure

- One directory per action under `actions/<name>/`, fully self-contained.
- Required files: `action.yml`, `README.md`, and a test under `test/`.
- **JS actions:** pure logic in `src/<name>.js` (no Actions/Octokit calls — unit-testable), Actions glue in `src/index.js`, bundle committed to `dist/index.js`. Per-action `package.json` + `package-lock.json`.
- **Composite actions:** logic in `action.yml` `runs.steps`; scripts under `src/` use Node builtins only; no `dist/`, no `package.json`.
- Start every new action with `cp -r templates/new-action actions/<name>` — never from scratch.

## Naming

- Directory and `action.yml` `name:` are lowercase, hyphenated, and identical.
- `name:` must be descriptive and, if it may ever be mirrored to the Marketplace, globally unique across the Marketplace (and must not collide with a GitHub user, org, category, or reserved feature name). Check before building: `curl -s -o /dev/null -w '%{http_code}' https://github.com/marketplace/actions/<name>` (404 = available).

## `action.yml`

- Always include `name`, `description`, `author: "amoussa1229"`, and `branding` (icon + color).
- Every input documented with `description`, `required`, and a `default` where applicable.
- Every output documented (names must exactly match what the code sets).
- JS actions: `runs.using: node24`, `runs.main: dist/index.js`.
- Token inputs use `default: ${{ github.token }}` (established runner-evaluated pattern — actions/stale, actions/labeler, codeql-action all do this) and code must guard with `if (token)` so a missing token degrades gracefully, never crashes.

## Behavior & safety

- **Destructive actions default to dry-run.** Anything that deletes, closes, or mutates state must default to reporting what it *would* do, with the destructive path gated behind an explicit input (`confirm: "true"`). State this in the README.
- **Fail open, not closed, for CI-gating actions** unless the action's job is specifically to block (e.g. license-auditor and secret-canary block by design). When inputs can't be resolved, prefer the safe/permissive path and log a `core.warning`.
- Validate and parse all inputs explicitly; throw clear, prefixed errors (`Input "x" must be ...`).
- Paginate all list-style Octokit calls (`octokit.paginate(...)`) — never assume one page.
- Handle the zero-SHA / initial-event edge cases where relevant (e.g. first push has no `before`).

## Outputs & logging

- Emit machine-readable outputs (JSON for structured data) plus a human-readable `core.info` summary line.
- For anything destructive or quota-affecting, output counts (`count`, `skipped`, `deleted-count`, `reclaimed-bytes`, …).
- Log the key decision inputs ("Changed files (N):", "Would delete N artifacts (dry-run)") so a maintainer can debug from the run log alone.

## Dependencies & security

- Pin every `uses:` in workflows and composite actions to a full commit SHA with a trailing `# vX.Y.Z` comment. Dependabot maintains them.
- Keep runtime deps minimal; prefer the official `@actions/*` toolkit and Node builtins over third-party libs.
- JS actions use `@actions/core@^1.11` + `@actions/github@^6` (v3+/v9+ of these are ESM-only and break CJS + ncc bundling) with `overrides: {"undici": "^6.26.0"}`.
- `node_modules/` stays gitignored; `dist/` is committed. Rebuild `dist/` (`npx @vercel/ncc build src/index.js -o dist`) before every commit that touches `src/`.
- Never print secrets to logs, outputs, or comments — redact by construction.

## Testing (non-negotiable)

- Pure logic has unit tests (Node's built-in `node:test`, no test-framework dependency).
- Each action has `.github/workflows/test-<name>.yml`: a `unit` job (`npm ci && npm test` for JS; `node --test` for composites) and an `integration` job that invokes the action via `uses: ./actions/<name>` and asserts on real outputs (the job must fail if output is wrong).
- Integration assertions must be deterministic on both `push` and `pull_request` events.
- Test workflow triggers on `pull_request` and `push` filtered to `actions/<name>/**` and the workflow file itself.
- Repo pins Node 24 via root `.nvmrc` to match the `node24` runtime; `npm test` is bare `node --test` (the `node --test test/` directory form broke on Node 22+ — keep the bare form).

## Documentation

- Each action's README: one-paragraph "what it solves" (include the error messages / use cases people would search for), Usage block, Inputs table, Outputs table, "How it works", and a Limitations note.
- Per-action READMEs are **monorepo-canonical**: links resolve in this repo (`[MIT](../../LICENSE)`, `uses: builtbyadam/actions/<name>@<commit-sha>`, CI badge pointing at this repo's test workflow) and carry no mirror banner. `scripts/sync-subtree.sh` applies the mirror-only transformations at sync time (injects the "generated mirror" banner, rewrites license links to root-relative, rewrites usage to `builtbyadam/<name>@v1`).
- Add a row to the root `README.md` index table when the action lands.

## PR & review

- One action per PR where possible; one concern per PR for edits.
- PR checklist (template): passing test workflow, README present, SHAs pinned, dry-run default if destructive, `dist/` rebuilt.
