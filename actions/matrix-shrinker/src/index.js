const core = require("@actions/core");
const github = require("@actions/github");
const { parseMatrix, parseRules, shrinkMatrix } = require("./shrink");

/**
 * Derive the changed files from the triggering event via the GitHub API.
 * Returns null when the event doesn't carry enough information.
 */
async function deriveChangedFiles(token) {
  const ctx = github.context;
  const octokit = github.getOctokit(token);

  if (ctx.payload.pull_request) {
    const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
      ...ctx.repo,
      pull_number: ctx.payload.pull_request.number,
      per_page: 100,
    });
    return files.map((f) => f.filename);
  }

  if (ctx.eventName === "push" && ctx.payload.before && !/^0+$/.test(ctx.payload.before)) {
    const res = await octokit.rest.repos.compareCommitsWithBasehead({
      ...ctx.repo,
      basehead: `${ctx.payload.before}...${ctx.payload.after}`,
    });
    return (res.data.files || []).map((f) => f.filename);
  }

  return null;
}

function setOutputs(kept, total) {
  const matrix = JSON.stringify({ include: kept });
  core.setOutput("matrix", matrix);
  core.setOutput("count", String(kept.length));
  core.setOutput("skipped", String(total - kept.length));
  core.info(`Kept ${kept.length}/${total} matrix entries.`);
  core.info(`matrix: ${matrix}`);
}

async function run() {
  try {
    const include = parseMatrix(core.getInput("matrix", { required: true }));
    const rules = parseRules(core.getInput("rules", { required: true }));
    const fallback = core.getInput("fallback") || "full";
    if (fallback !== "full" && fallback !== "empty") {
      throw new Error(`Input "fallback" must be "full" or "empty", got "${fallback}".`);
    }

    let changedFiles = core
      .getInput("changed-files")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (changedFiles.length === 0) {
      const token = core.getInput("github-token");
      let derived = null;
      if (token) {
        try {
          derived = await deriveChangedFiles(token);
        } catch (e) {
          core.warning(`Failed to derive changed files from the GitHub API: ${e.message}`);
        }
      }
      if (derived === null) {
        core.warning(
          `Could not determine changed files for the "${github.context.eventName}" event; ` +
            `applying fallback "${fallback}".`
        );
        setOutputs(fallback === "full" ? include : [], include.length);
        return;
      }
      changedFiles = derived;
    }

    core.info(`Changed files (${changedFiles.length}):`);
    for (const file of changedFiles) core.info(`  ${file}`);

    const result = shrinkMatrix(include, rules, changedFiles);
    setOutputs(result.include, include.length);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
