const core = require("@actions/core");
const github = require("@actions/github");
const {
  COMMENT_MARKER,
  parseInputs,
  alreadyActed,
  selectCrossed,
  renderComment,
  toReportRow,
} = require("./triage");

/** List all open issues (PRs included by the API; filtered in pure logic). Paginated. */
async function collectOpenIssues(octokit, repo) {
  return octokit.paginate(octokit.rest.issues.listForRepo, {
    ...repo,
    state: "open",
    per_page: 100,
  });
}

/** True when any of the issue's comments already carries the action's marker. Paginated. */
async function hasPriorComment(octokit, repo, issueNumber) {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    ...repo,
    issue_number: issueNumber,
    per_page: 100,
  });
  return comments.some((c) => typeof c.body === "string" && c.body.includes(COMMENT_MARKER));
}

function setOutputs(affectedCount, report) {
  core.setOutput("affected-count", String(affectedCount));
  core.setOutput("report", JSON.stringify(report));
  core.info(`Acted on ${affectedCount} issue(s).`);
}

async function run() {
  try {
    const opts = parseInputs({
      reaction: core.getInput("reaction"),
      threshold: core.getInput("threshold", { required: true }),
      onCross: core.getInput("on-cross"),
      labelName: core.getInput("label-name"),
      commentBody: core.getInput("comment-body"),
      confirm: core.getInput("confirm") || "false",
    });

    const token = core.getInput("github-token");
    // Missing token → safe no-op rather than a crash.
    if (!token) {
      core.warning("No github-token provided; skipping (no issues were inspected).");
      setOutputs(0, []);
      return;
    }

    const octokit = github.getOctokit(token);
    const repo = github.context.repo;
    const dryRun = opts.onCross === "close" && !opts.confirm;

    core.info(
      `Triaging ${repo.owner}/${repo.repo}: reaction=:${opts.reaction}:, ` +
        `threshold=${opts.threshold}, on-cross=${opts.onCross}` +
        (opts.onCross === "label" ? `, label-name=${opts.labelName}` : "") +
        (opts.onCross === "close" ? `, dry-run=${dryRun}` : "") +
        "."
    );

    const issues = await collectOpenIssues(octokit, repo);
    core.info(`Found ${issues.length} open issue(s)/PR(s) before filtering.`);

    const crossed = selectCrossed(issues, opts.reaction, opts.threshold);
    core.info(`${crossed.length} issue(s) cross the threshold.`);

    const report = [];
    let affectedCount = 0;

    for (const { issue, count } of crossed) {
      // comment mode needs a remote scan to decide "already acted".
      let commentedFlag = false;
      if (opts.onCross === "comment") {
        try {
          commentedFlag = await hasPriorComment(octokit, repo, issue.number);
        } catch (e) {
          core.warning(
            `Failed to read comments for issue #${issue.number}: ${e.message}; treating as not-yet-commented.`
          );
        }
      }

      if (alreadyActed(issue, opts.onCross, opts.labelName, commentedFlag)) {
        core.info(`Issue #${issue.number} has ${count} :${opts.reaction}: — already acted, skipping.`);
        report.push(toReportRow(issue, count, "skipped-already-acted"));
        continue;
      }

      if (opts.onCross === "close") {
        if (dryRun) {
          core.info(
            `Issue #${issue.number} has ${count} :${opts.reaction}: — would close (dry-run).`
          );
          report.push(toReportRow(issue, count, "would-close"));
          continue;
        }
        try {
          await octokit.rest.issues.update({ ...repo, issue_number: issue.number, state: "closed" });
          core.info(`Issue #${issue.number} has ${count} :${opts.reaction}: — closed.`);
          report.push(toReportRow(issue, count, "closed"));
          affectedCount += 1;
        } catch (e) {
          core.warning(`Failed to close issue #${issue.number}: ${e.message}`);
        }
        continue;
      }

      if (opts.onCross === "label") {
        try {
          await octokit.rest.issues.addLabels({
            ...repo,
            issue_number: issue.number,
            labels: [opts.labelName],
          });
          core.info(
            `Issue #${issue.number} has ${count} :${opts.reaction}: — labeled "${opts.labelName}".`
          );
          report.push(toReportRow(issue, count, "labeled"));
          affectedCount += 1;
        } catch (e) {
          core.warning(`Failed to label issue #${issue.number}: ${e.message}`);
        }
        continue;
      }

      // comment mode
      try {
        await octokit.rest.issues.createComment({
          ...repo,
          issue_number: issue.number,
          body: renderComment(opts.commentBody, count, opts.reaction),
        });
        core.info(`Issue #${issue.number} has ${count} :${opts.reaction}: — commented.`);
        report.push(toReportRow(issue, count, "commented"));
        affectedCount += 1;
      } catch (e) {
        core.warning(`Failed to comment on issue #${issue.number}: ${e.message}`);
      }
    }

    setOutputs(affectedCount, report);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
