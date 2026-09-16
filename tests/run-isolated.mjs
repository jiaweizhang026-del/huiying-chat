import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const live = process.argv.includes("--live");
const hmr = process.argv.includes("--hmr");
const dir = await mkdtemp(path.join(tmpdir(), "huiying-test-"));
const port = live ? 5189 : 5188;
const env = {
  ...process.env,
  PORT: String(port),
  DATA_FILE: path.join(dir, "state.json"),
};
if (!live) env.DEEPSEEK_API_KEY = "";
const server = spawn(process.execPath, ["server.mjs"], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stderr.on("data", (d) => process.stderr.write(d));
const url = `http://localhost:${port}`;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error(
        "Isolated test server exited; check test port availability",
      );
    try {
      const r = await fetch(url + "/api/status");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error("Isolated test server did not start");
  const script = live
    ? "tests/live.mjs"
    : process.argv.includes("--visual")
      ? "tests/visual.mjs"
      : process.argv.includes("--companion")
        ? "tests/companion.mjs"
        : process.argv.includes("--community")
          ? "tests/community.mjs"
          : hmr
            ? "tests/hmr.mjs"
            : "tests/ui.mjs";
  const runner = spawn(process.execPath, [script], {
    env: { ...process.env, TEST_URL: url },
    stdio: "inherit",
  });
  process.exitCode = await new Promise((r) => runner.once("exit", r));
} finally {
  if (server.exitCode === null) {
    const stopped = new Promise((r) => server.once("exit", r));
    server.kill("SIGTERM");
    await stopped;
  }
}
