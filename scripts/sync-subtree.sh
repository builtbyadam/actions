#!/usr/bin/env bash
set -euo pipefail

# Sync one action from the monorepo to its standalone mirror repo.
#
# Usage: sync-subtree.sh <action-name> <mirror-repo> <token>
#   e.g. sync-subtree.sh matrix-shrinker builtbyadam/matrix-shrinker "$TOKEN"
#
# The monorepo copy of each action is canonical. This script copies it to the
# mirror ROOT (Marketplace requires action.yml at the repo root) and applies
# the mirror-only README transformations:
#   1. inject the "generated mirror" banner under the header
#   2. rewrite license links  ](../../LICENSE) -> ](LICENSE)
#   3. rewrite usage          uses: builtbyadam/actions/<name>@<ref>
#                          -> uses: builtbyadam/<name>@v1
# Keeping these transformations here (not baked into the monorepo READMEs)
# means the monorepo never claims to be a mirror of itself and its links
# always resolve.
#
# After pushing, it moves the mirror's floating MAJOR-version tag (e.g. v1) to
# the new HEAD so `uses: builtbyadam/<name>@v1` (the form the README rewrite
# above emits) always resolves to the latest synced content. Immutable vX.Y.Z
# release tags stay hand-managed (those drive Marketplace releases); only the
# floating major alias is automated here. The tag step runs on every invocation
# so it self-heals even when there were no content changes to push.

ACTION="$1"
MIRROR="$2"          # e.g. builtbyadam/matrix-shrinker
TOKEN="$3"
SRC_SHA="$(git rev-parse --short HEAD)"

WORK="$(mktemp -d)"
git clone --quiet "https://x-access-token:${TOKEN}@github.com/${MIRROR}.git" "$WORK"

# CI runners have no git identity; commits in the mirror clone need one.
git -C "$WORK" config user.name "github-actions[bot]"
git -C "$WORK" config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# Wipe tracked content (keep .git) and copy the action to the mirror ROOT
( cd "$WORK" && git rm -rq . 2>/dev/null || true )
cp -r "actions/${ACTION}/." "$WORK/"

# Carry the license into the mirror so it's unambiguous standalone
cp LICENSE "$WORK/LICENSE"

# Mirror-only README transformations
ACTION_NAME="$ACTION" python3 - "$WORK/README.md" <<'PYEOF'
import os, re, sys

path = sys.argv[1]
name = os.environ["ACTION_NAME"]
s = open(path).read()

banner = (
    "> \U0001FA9E **This is a generated mirror** of "
    "[`builtbyadam/actions`](https://github.com/builtbyadam/actions). "
    "Issues and PRs are welcome there.\n\n"
)
# Inject the banner after the centered header block (first closing </div>)
s = s.replace("</div>\n\n", "</div>\n\n" + banner, 1)

# License links are root-relative in the standalone mirror
s = s.replace("](../../LICENSE)", "](LICENSE)")

# Usage examples reference the mirror's Marketplace form
s = re.sub(
    rf"uses: builtbyadam/actions/{re.escape(name)}@\S+",
    f"uses: builtbyadam/{name}@v1",
    s,
)

open(path, "w").write(s)
PYEOF

cd "$WORK"
git add -A
if git diff --cached --quiet; then
  echo "No content changes to sync for ${ACTION}."
else
  git commit -m "sync: ${ACTION} from monorepo @ ${SRC_SHA}"
  git push origin HEAD:main
  echo "Synced ${ACTION} -> ${MIRROR}"
fi

# Keep the floating major-version alias (e.g. v1) pinned to the mirror's current
# HEAD. Derive the major from the highest vN.* release tag (falls back to v1 for
# a brand-new mirror with no releases yet) so this keeps working after a future
# v2. Runs unconditionally so a previously-drifted tag self-heals on the next
# sync. Force-update is required because moving a tag is a non-fast-forward.
MAJOR="$(git tag -l 'v[0-9]*' | sed -E 's/^v([0-9]+).*/\1/' | sort -n | tail -1)"
MAJOR="${MAJOR:-1}"
git tag -f "v${MAJOR}" HEAD >/dev/null
if git push -f origin "refs/tags/v${MAJOR}"; then
  echo "Floating tag v${MAJOR} -> $(git rev-parse --short HEAD) in ${MIRROR}"
else
  echo "::warning::Could not update floating tag v${MAJOR} in ${MIRROR}; will retry on next sync."
fi
