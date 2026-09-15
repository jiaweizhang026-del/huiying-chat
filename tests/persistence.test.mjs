import test from "node:test";
import assert from "node:assert/strict";
let sequence = 0;
async function client(handler, entries = []) {
  const values = new Map(entries);
  globalThis.localStorage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  globalThis.fetch = handler;
  return import(`../src/persistence.js?test=${++sequence}`);
}
const response = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
});
test("failed save keeps backup and successfully retries", async () => {
  let fail = true;
  const p = await client(async (_url, options) => {
    if (options?.method !== "PUT")
      return response({ revision: 1, state: { name: "old" } });
    if (fail) throw new Error("disk unavailable");
    return response({ revision: 2 });
  });
  await p.loadState(() => ({}));
  p.scheduleSave({ name: "new" });
  await assert.rejects(p.flushSave(), /disk unavailable/);
  assert.equal(p.hasUnsavedChanges(), true);
  assert.equal(JSON.parse(p.recoveryBackup()).pending.state.name, "new");
  fail = false;
  await p.flushSave();
  assert.equal(p.hasUnsavedChanges(), false);
  assert.equal(p.recoveryBackup(), null);
});
test("409 stops stale writes; reloading preserves conflict in a separate backup", async () => {
  let writes = 0;
  const p = await client(async (_url, options) => {
    if (options?.method !== "PUT")
      return response({ revision: 2, state: { name: "remote" } });
    writes++;
    return response({ error: "version conflict" }, 409);
  });
  await p.loadState(() => ({}));
  p.scheduleSave({ name: "mine" });
  await assert.rejects(p.flushSave());
  await assert.rejects(p.flushSave());
  assert.equal(writes, 1);
  const recovery = localStorage.getItem("huiying.unsaved.v1");
  const reloaded = await client(
    async (_url, options) =>
      options?.method === "PUT"
        ? response({ revision: 4 })
        : response({ revision: 3, state: { name: "remote-new" } }),
    [["huiying.unsaved.v1", recovery]],
  );
  assert.equal((await reloaded.loadState(() => ({}))).name, "remote-new");
  reloaded.scheduleSave({ name: "future-edit" });
  await reloaded.flushSave();
  assert.equal(
    JSON.parse(reloaded.recoveryBackup()).conflicts[0].state.name,
    "mine",
  );
});
test("lost save acknowledgement does not create a false conflict", async () => {
  const state = { name: "already-saved" };
  const p = await client(
    async () => response({ revision: 2, state }),
    [["huiying.unsaved.v1", JSON.stringify({ revision: 1, state })]],
  );
  await p.loadState(() => ({}));
  assert.equal(p.recoveryBackup(), null);
});
