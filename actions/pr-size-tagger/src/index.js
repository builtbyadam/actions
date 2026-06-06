const core = require("@actions/core");
const github = require("@actions/github");
const { parseBins, pickLabel, computeLines, labelsToRemove } = require("./size");

/** Emit the documented no-op outputs (used on the fail-open path). */
function noop(message) {
  core.warning(message);
  core.setOutput("label", "");
  core.setOutput("lines", "0");
  core.setOutput("over-threshold", "false");
}

async function run() {
  try {
    const bins = parseBins(core.getInput("bins") || "{}");

    const countMode = core.getInput("count") || "changed";
    if (countMode !== "changed" && countMode !== "additions") {
      throw new Error(`Input "count" must be "changed" or "additions", got "${countMode}".`);
    }

    const warnRaw = core.getInput("warn-threshold").trim();
    let warnThreshold = null;
    if (warnRaw !== "") {
      const parsed = Number(warnRaw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Input "warn-threshold" must be a positive integer, got "${warnRaw}".`);
      }
      warnThreshold = parsed;
    }

    const ctx = github.context;
    const pr = ctx.payload.pull_request;
    const isPrEvent =
      ctx.eventName === "pull_request" || ctx.eventName === "pull_request_target";

    if (!isPrEvent || !pr) {
      noop(
        `pr-size-tagger only runs on pull_request events; got "${ctx.eventName}". ` +
          "Emitting no-op outputs."
      );
      return;
    }

    const token = core.getInput("github-token");
    if (!token) {
      noop("No github-token provided; cannot read or mutate labels. Emitting no-op outputs.");
      return;
    }

    const lines = computeLines(pr.additions, pr.deletions, countMode);
    const chosenLabel = pickLabel(bins, lines);
    const binLabels = bins.map((b) => b.label);

    const currentLabels = (pr.labels || []).map((l) => (typeof l === "string" ? l : l.name));
    const toRemove = labelsToRemove(currentLabels, binLabels, chosenLabel);
    const alreadyPresent = currentLabels.includes(chosenLabel);

    const octokit = github.getOctokit(token);
    const issueRef = { ...ctx.repo, issue_number: pr.number };

    for (const label of toRemove) {
      try {
        await octokit.rest.issues.removeLabel({ ...issueRef, name: label });
        core.info(`Removed stale size label "${label}".`);
      } catch (e) {
        // Tolerate 404 races (label already gone) and similar transient errors.
        core.warning(`Could not remove label "${label}": ${e.message}`);
      }
    }

    if (!alreadyPresent) {
      await octokit.rest.issues.addLabels({ ...issueRef, labels: [chosenLabel] });
      core.info(`Applied size label "${chosenLabel}" (${lines} lines).`);
    } else {
      core.info(`Size label "${chosenLabel}" already present (${lines} lines); no change.`);
    }

    let overThreshold = false;
    if (warnThreshold !== null && lines > warnThreshold) {
      overThreshold = true;
      core.warning(`PR has ${lines} changed lines, over threshold ${warnThreshold}`);
    }

    core.setOutput("label", chosenLabel);
    core.setOutput("lines", String(lines));
    core.setOutput("over-threshold", overThreshold ? "true" : "false");
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
