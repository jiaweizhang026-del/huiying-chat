import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { StateStore, validState } from "../server/state-store.mjs";
import { customPersona, validCustom } from "../shared/custom-characters.mjs";
const person = {
  id: "custom-test",
  name: "林间",
  setting: "植物研究员",
  style: "温柔简短",
  relationship: "朋友",
  gender: "",
  avatar: "",
};
const state = () => ({
  version: 1,
  loggedIn: true,
  onboardingComplete: true,
  name: "Test",
  bio: "",
  contacts: [person.id],
  customCharacters: [person],
  chats: { [person.id]: [] },
  drafts: {},
  settings: {},
  memories: {},
  posts: [],
  pinned: [person.id],
  hiddenChats: [],
});
test("custom characters, pin/hide and onboarding survive store restart", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "huiying-custom-"));
  const file = path.join(dir, "state.json");
  const store = await new StateStore(file).init();
  await store.put(state(), 0);
  const reloaded = await new StateStore(file).init();
  assert.deepEqual(reloaded.get().state, state());
});
test("custom schema rejects invalid identities, missing required fields, duplicate IDs, remote avatars", () => {
  assert.equal(validState(state()), true);
  for (const changes of [
    { id: "__proto__" },
    { id: "wen" },
    { name: " " },
    { setting: "" },
    { avatar: "https://example.com/image.png" },
    { gender: "invalid" },
    { setting: "x".repeat(2001) },
  ])
    assert.equal(validCustom({ ...person, ...changes }), false);
  assert.equal(
    validState({ ...state(), customCharacters: [person, person] }),
    false,
  );
  assert.equal(validState({ ...state(), contacts: ["custom-missing"] }), false);
  assert.equal(validState({ ...state(), pinned: ["custom-missing"] }), false);
  assert.equal(validState({ ...state(), onboardingComplete: "yes" }), false);
});
test("persona contains stored role fields but no avatar bytes", () => {
  const prompt = customPersona({ ...person, avatar: "private-image" });
  assert.ok(
    prompt.includes(person.name) &&
      prompt.includes(person.setting) &&
      prompt.includes(person.style) &&
      prompt.includes(person.relationship),
  );
  assert.ok(!prompt.includes("private-image"));
});
