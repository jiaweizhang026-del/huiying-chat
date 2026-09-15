import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { StateStore, validState } from "../server/state-store.mjs";
const seed = () => ({
  version: 1,
  loggedIn: false,
  name: "Test",
  bio: "",
  contacts: ["wen"],
  chats: { wen: [] },
  drafts: {},
  settings: {},
  memories: {},
  posts: [],
});
test("state survives independent store instance / server restart", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "huiying-store-"));
  const file = path.join(dir, "state.json");
  const a = await new StateStore(file).init();
  const state = seed();
  state.posts = [
    {
      id: "p1",
      person: "me",
      text: "真实磁盘日常",
      photos: [],
      time: 1,
      likes: [],
      comments: [],
    },
  ];
  await a.put(state, 0);
  const b = await new StateStore(file).init();
  assert.equal(b.get().state.posts[0].text, "真实磁盘日常");
  assert.equal(b.get().revision, 1);
  assert.equal(JSON.parse(await readFile(file, "utf8")).state.name, "Test");
});
test("stale and concurrent writes cannot overwrite newer records", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "huiying-cas-"));
  const store = await new StateStore(path.join(dir, "state.json")).init();
  const outcomes = await Promise.allSettled([
    store.put(seed(), 0),
    store.put({ ...seed(), name: "stale" }, 0),
  ]);
  assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(outcomes[1].reason.status, 409);
  assert.equal(store.get().state.name, "Test");
});
test("invalid payloads and remote image URLs rejected", () => {
  assert.equal(validState(seed()), true);
  assert.equal(validState({ ...seed(), contacts: ["wen", "wen"] }), false);
  assert.equal(
    validState({
      ...seed(),
      posts: [
        {
          id: "a",
          person: "me",
          text: "x",
          photos: ["https://tracking.example/pixel"],
          time: 1,
          likes: [],
          comments: [],
        },
      ],
    }),
    false,
  );
  assert.equal(validState(null), false);
});
