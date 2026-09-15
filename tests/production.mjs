import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import "dotenv/config";
const dir = await mkdtemp(path.join(tmpdir(), "huiying-production-"));
const url = "http://localhost:5190";
const env = {
  ...process.env,
  PORT: "5190",
  DEEPSEEK_API_KEY: "",
  DATA_FILE: path.join(dir, "state.json"),
};
let server;
async function start() {
  server = spawn(process.execPath, ["server.mjs", "--production"], {
    env,
    stdio: ["ignore", "ignore", "inherit"],
  });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error("Production server exited");
    try {
      if ((await fetch(url + "/api/status")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Production server not ready");
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((r) => server.once("exit", r));
  server.kill("SIGTERM");
  await exited;
}
try {
  await start();
  const html = await (await fetch(url)).text();
  assert.ok(html.includes("/assets/index-"));
  for (const p of ["/.env", "/.local-data/state.json"])
    assert.equal((await fetch(url + p)).status, 404);
  const state = {
    version: 1,
    loggedIn: true,
    name: "Production test",
    bio: "",
    contacts: [],
    chats: {},
    drafts: {},
    settings: {},
    memories: {},
    posts: [],
  };
  assert.equal(
    (
      await fetch(url + "/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: 0, state }),
      })
    ).status,
    200,
  );
  await stop();
  await start();
  const restored = await (await fetch(url + "/api/state")).json();
  assert.equal(restored.state.name, state.name);
  assert.equal(restored.revision, 1);
  const key = process.env.DEEPSEEK_API_KEY;
  for (const file of await readdir("dist/assets")) {
    if (!/\.(js|css)$/.test(file)) continue;
    const bytes = await readFile(path.join("dist/assets", file), "utf8");
    assert.ok(!key || !bytes.includes(key), "Secret present in build");
  }
  console.log(
    "PASS: production frontend + backend, actual server restart persistence, private files blocked, no API key in build.",
  );
} finally {
  await stop();
}
