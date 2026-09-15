import test from "node:test";
import assert from "node:assert/strict";
const url = process.env.TEST_URL || "http://localhost:5178";
const post = (body) =>
  fetch(url + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("status reveals mode, never secrets", async () => {
  const r = await fetch(url + "/api/status");
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(typeof d.configured, "boolean");
  assert.equal("key" in d, false);
});
test("private key and disk data files are not served", async () => {
  for (const pathname of [
    "/.env",
    "/.env.example",
    "/.local-data/state.json",
    "/@fs" + process.cwd() + "/.env",
  ]) {
    const r = await fetch(url + pathname);
    assert.ok([403, 404].includes(r.status), `${pathname}: ${r.status}`);
  }
});
test("malformed input rejected", async () => {
  for (const body of [
    {},
    { person: "unknown", task: "chat", messages: [] },
    {
      person: "wen",
      task: "chat",
      messages: [{ role: "system", content: "bad" }],
    },
    {
      person: "wen",
      task: "chat",
      messages: [{ role: "user", content: "x".repeat(4001) }],
    },
  ])
    assert.equal((await post(body)).status, 400);
});
test("foreign origin rejected", async () => {
  const r = await fetch(url + "/api/chat", {
    method: "POST",
    headers: {
      Origin: "https://example.com",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(r.status, 403);
});
test("demo reply and suggestions shapes", async (t) => {
  const status = await (await fetch(url + "/api/status")).json();
  if (status.configured)
    return t.skip("Real API configured: avoid spending credits in test");
  for (const task of ["chat", "suggestions"]) {
    const r = await post({
      person: "wen",
      task,
      messages: [{ role: "user", content: "你好" }],
    });
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.equal(d.mode, "demo");
    assert.ok((d.messages || d.suggestions).length);
  }
});
