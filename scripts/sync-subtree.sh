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
  echo "No changes to sync for ${ACTION}."
  exit 0
fi
git commit -m "sync: ${ACTION} from monorepo @ ${SRC_SHA}"
git push origin HEAD:main
echo "Synced ${ACTION} -> ${MIRROR}"
