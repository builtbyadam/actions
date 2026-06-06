const core = require("@actions/core");

async function run() {
  try {
    const input = core.getInput("example-input");
    core.info(`Received input: ${input}`);

    // --- replace this with the action's real logic ---
    const result = input.toUpperCase();
    // -------------------------------------------------

    core.setOutput("example-output", result);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();