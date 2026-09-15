import test from "node:test";
import assert from "node:assert/strict";
import { exploreCharacters } from "../shared/explore-characters.mjs";
import { validState } from "../server/state-store.mjs";
// Source-independent matcher tests run through Vite in UI; server catalog test stays native Node.
test("every new star is a unique persistable role", () => {
  assert.equal(new Set(exploreCharacters.map((p) => p.id)).size, 22);
  const state = {
    version: 1,
    loggedIn: true,
    name: "test",
    bio: "",
    contacts: exploreCharacters.map((p) => p.id),
    chats: Object.fromEntries(exploreCharacters.map((p) => [p.id, []])),
    drafts: {},
    settings: {},
    memories: {},
    posts: [],
  };
  assert.equal(validState(state), true);
});
test("old posts remain valid and public/private scope is validated", () => {
  const state = {
    version: 1,
    loggedIn: true,
    name: "test",
    bio: "",
    contacts: [],
    chats: {},
    drafts: {},
    settings: {},
    memories: {},
    posts: [
      {
        id: "x",
        person: "chun",
        text: "你好",
        time: 1,
        photos: [],
        likes: [],
        comments: [],
      },
    ],
  };
  assert.equal(validState(state), true);
  state.posts[0].scope = "square";
  assert.equal(validState(state), true);
  state.posts[0].scope = "anywhere";
  assert.equal(validState(state), false);
});
