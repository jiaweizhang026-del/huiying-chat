// Pure-function tests for the memory layer: no server, no browser, no API key.
import test from "node:test";
import assert from "node:assert/strict";
import { validState } from "../server/state-store.mjs";
import {
  buildChatContext,
  formatTimeContext,
  reunionHint,
} from "../shared/context.mjs";
import { personaCard } from "../shared/persona-cards.mjs";
import { buildSystem } from "../shared/prompt.mjs";
import {
  MEMORY_LIMIT,
  bumpHits,
  cleanText,
  formatMemoryLines,
  inferExplicitMemory,
  mergeMemory,
  memoryScore,
  normalizeKey,
  normalizeMemory,
  selectMemories,
} from "../shared/memory.mjs";

const DAY = 86_400_000;
const now = Date.parse("2026-09-16T21:30:00");
const date = (offsetDays = 0) =>
  new Date(now - offsetDays * DAY).toLocaleDateString("sv-SE");
const entry = (text, extra = {}, offsetDays = 0) => ({
  id: "m-" + Math.random().toString(36).slice(2, 8),
  text,
  date: date(offsetDays),
  ...extra,
});

test("sending and retry snapshots exclude the new user message from the gap", () => {
  const history = [
    { role: "assistant", text: "开场", opening: true, time: now - DAY * 2 },
    { role: "user", text: "昨天", time: now - DAY - 1000 },
    { role: "assistant", text: "嗯", time: now - DAY },
    { role: "user", text: "今天", time: now },
  ];
  const ctx = buildChatContext(history, { now });
  assert.equal(ctx.lastMessageAt, now - DAY);
  assert.equal(ctx.turnsToday, 1);
  assert.match(reunionHint(ctx, now), /惦记/);
  assert.equal(
    buildChatContext(history, { now: now + 60000 }).lastMessageAt,
    now - DAY,
  );
  assert.equal(
    buildChatContext([history[0], history[3]], { now }).lastMessageAt,
    0,
  );
  assert.equal(
    buildChatContext(history, { task: "suggestions", now }).lastMessageAt,
    now,
  );
});

test("reminders survive the history window and reset on the next night/day", () => {
  const midnight = Date.parse("2026-09-17T00:30:00");
  const history = [
    { role: "assistant", text: "早点休息", time: midnight - 3600000 },
    ...Array.from({ length: 24 }, (_, i) => ({
      role: "user",
      text: "嗯",
      time: midnight - 1000 + i,
    })),
  ];
  const ctx = buildChatContext(history, { now: midnight });
  assert.equal(ctx.sleepReminded, 1);
  assert.match(reunionHint(ctx, midnight), /禁止再次主动劝睡/);
  assert.equal(
    buildChatContext(history, { now: midnight + DAY }).sleepReminded,
    0,
  );
  const lunch = Date.parse("2026-09-17T12:30:00");
  const meals = [
    { role: "assistant", text: "午饭吃了吗", time: lunch - 60000 },
  ];
  assert.equal(buildChatContext(meals, { now: lunch }).lunchReminded, 1);
  assert.equal(buildChatContext(meals, { now: lunch + DAY }).lunchReminded, 0);
});

test("scores have a true 30-day half-life and ignore legacy exposure hits", () => {
  const fact = entry("考研", { salience: 4 });
  assert.ok(
    Math.abs(
      memoryScore(fact, "", now + 30 * DAY) / memoryScore(fact, "", now) - 0.5,
    ) < 1e-12,
  );
  assert.equal(
    memoryScore({ ...fact, hits: 9999 }, "", now),
    memoryScore(fact, "", now),
  );
  assert.ok(
    memoryScore({ ...fact, referenceCount: 1 }, "", now) >
      memoryScore(fact, "", now),
  );
  const facts = Array.from({ length: 6 }, (_, i) =>
    entry(`稳定事实${i}`, { kind: "profile" }, 100),
  );
  const events = Array.from({ length: 15 }, (_, i) =>
    entry(`琐事${i}`, { kind: "event", salience: 5 }),
  );
  const chosen = selectMemories([...events, ...facts], { now });
  assert.equal(chosen.length, 10);
  assert.equal(chosen.filter((m) => m.kind === "profile").length, 4);
});

test("stable paraphrases merge but negation, other people and dated events do not", () => {
  const original = entry("我在考研", { kind: "profile" }, 40);
  const merge = (text, kind = "profile", extra = {}) =>
    mergeMemory([original], normalizeMemory({ text, kind, ...extra }), {
      date: date(),
    });
  assert.equal(merge("用户正在备考研究生").status, "merged");
  assert.equal(merge("我不考研").status, "added");
  assert.equal(merge("我的朋友在考研").status, "added");
  assert.equal(
    merge("研究生备考中", "profile", { matchId: original.id }).status,
    "merged",
  );
  assert.equal(
    merge("研究生备考中", "profile", { matchId: "missing" }).status,
    "added",
  );
  const event = entry("今天加班", { kind: "event" }, 2);
  assert.equal(
    mergeMemory([event], normalizeMemory({ text: event.text, kind: "event" }), {
      date: date(),
    }).status,
    "added",
  );
});

test("cleanText trims, unwraps quotes and caps length", () => {
  assert.equal(cleanText("  我在考研。  "), "我在考研。");
  assert.equal(cleanText('"喜欢桂花乌龙"'), "喜欢桂花乌龙");
  assert.equal(cleanText("x".repeat(500)).length, 200);
  assert.equal(cleanText(undefined), "");
  assert.equal(normalizeKey("我在考研。"), normalizeKey("我在 考研"));
});

test("normalizeMemory accepts strings and objects, rejects noise and secrets", () => {
  assert.deepEqual(normalizeMemory("我在准备考研"), {
    text: "我在准备考研",
    kind: "event",
    salience: 3,
  });
  const typed = normalizeMemory(
    { text: "她最喜欢的饮料是桂花乌龙", kind: "preference", salience: 5 },
    { source: "AI 整理" },
  );
  assert.equal(typed.kind, "preference");
  assert.equal(typed.salience, 5);
  assert.equal(typed.source, "AI 整理");
  assert.equal(normalizeMemory(""), null);
  assert.equal(normalizeMemory(null), null);
  assert.equal(normalizeMemory({ text: "我的密码是 abcd1234" }), null);
  assert.equal(normalizeMemory({ text: "我家住址是xx路" }), null);
  // Unknown kinds fall back instead of poisoning the store.
  assert.equal(
    normalizeMemory({ text: "今天下雨", kind: "hack" }).kind,
    "event",
  );
  // Salience is clamped, profile facts default higher than one-off events.
  assert.equal(
    normalizeMemory({ text: "她在上海", kind: "profile" }).salience,
    4,
  );
  assert.equal(normalizeMemory({ text: "今天下雨", salience: 99 }).salience, 5);
});

test("explicit study facts are retained when a model omits structured memory", () => {
  assert.equal(inferExplicitMemory("我最近在准备考研").kind, "profile");
  assert.equal(
    inferExplicitMemory("用户正在备考研究生").text,
    "用户正在准备考研",
  );
  assert.equal(inferExplicitMemory("我不准备考研"), null);
  assert.equal(inferExplicitMemory("我最近在找工作").text, "用户最近在找工作");
  assert.equal(inferExplicitMemory("我喜欢吃烧烤").text, "用户喜欢烧烤");
  assert.equal(inferExplicitMemory("今天下雨"), null);
});

test("mergeMemory counts repeats instead of storing duplicates", () => {
  const list = [entry("今天项目上线，很累", { kind: "event" }, 0)];
  const first = mergeMemory(
    list,
    normalizeMemory({ text: "我在准备考研", kind: "profile" }),
    { id: "new-1", date: date() },
  );
  assert.equal(first.status, "added");
  assert.equal(first.list.length, 2);
  assert.equal(first.list[0].hits, 0);

  const second = mergeMemory(
    first.list,
    normalizeMemory({ text: "我在准备考研！", kind: "profile" }),
    { id: "new-2", date: date() },
  );
  assert.equal(second.status, "merged");
  assert.equal(second.list.length, 2, "重复事实不应新增条目");
  assert.equal(second.list.find((m) => m.id === "new-1").mentionCount, 2);
  assert.equal(second.list.find((m) => m.id === "new-1").referenceCount, 0);
  // Seed memories are demo content and must never be merged into.
  const seeded = [{ id: "seed-1", text: "示例回忆", date: date(), seed: true }];
  assert.equal(
    mergeMemory(seeded, normalizeMemory("示例回忆"), { id: "x", date: date() })
      .status,
    "added",
  );
});

test("selectMemories keeps stable facts that the old newest-8 window lost", () => {
  const many = [
    ...Array.from({ length: 12 }, (_, i) =>
      entry(`第${i}天的琐事`, { kind: "event" }, i),
    ),
    entry("她在准备考研", { kind: "profile" }, 40),
    entry("她喜欢桂花乌龙", { kind: "preference" }, 25),
  ];
  const picked = selectMemories(many, { now });
  assert.ok(picked.length <= MEMORY_LIMIT);
  assert.ok(
    picked.some((m) => m.text === "她在准备考研"),
    "40 天前的稳定事实必须仍然进入上下文",
  );
  assert.equal(picked.length, MEMORY_LIMIT);
});

test("selectMemories drops photo/quote noise and follows the query", () => {
  const list = [
    entry("你分享了 3 张照片给文牧野。", { photoMemory: true }, 0),
    entry("你说：「今天好累」", { kind: "quote" }, 0),
    entry("旧版演示摘录", { source: "聊天摘录" }, 0),
    entry("今天加班到十点", { kind: "event", salience: 2 }, 0),
    entry("她最近在追一部剧", { kind: "preference" }, 9),
  ];
  const picked = selectMemories(list, { query: "", now });
  assert.ok(!picked.some((m) => m.photoMemory), "图片条目不应占用上下文");
  assert.ok(!picked.some((m) => m.kind === "quote"), "演示摘录应被降噪");
  assert.ok(!picked.some((m) => m.source === "聊天摘录"));
  const focused = selectMemories(list, { query: "今天加班好累啊", now });
  assert.equal(focused[0].text, "今天加班到十点", "与当前话题相关的记忆应靠前");
});

test("recalled memories gain weight and seed entries never reach the model", () => {
  const plain = entry("她养了一只猫", { kind: "preference" }, 3);
  const recalled = entry("她在准备考研", { kind: "profile", hits: 4 }, 3);
  const list = [
    plain,
    recalled,
    { id: "seed", text: "示例", date: date(), seed: true },
  ];
  const boosted = bumpHits(list, [plain.id]);
  assert.equal(boosted.find((m) => m.id === plain.id).referenceCount, 1);
  assert.equal(
    boosted.find((m) => m.id === recalled.id).referenceCount,
    undefined,
  );
  assert.deepEqual(bumpHits(list, []), list);
  assert.ok(!selectMemories(list, { now }).some((m) => m.seed));
});

test("memory lines are typed and dated for the prompt", () => {
  const lines = formatMemoryLines(
    [entry("她在准备考研", { kind: "profile" }, 2)],
    now,
  );
  assert.match(lines[0], /^\[profile\|2天前\] \[id:[^\]]+\] 她在准备考研$/);
});

test("time context reads naturally and hints after a long gap", () => {
  const fresh = formatTimeContext(
    { lastMessageAt: now - 3 * 60_000, turnsToday: 4 },
    now,
  );
  assert.match(fresh, /当前时间：9月16日/);
  assert.match(fresh, /距上次对话 3 分钟/);
  assert.match(fresh, /今天已聊 4 轮/);
  const back = formatTimeContext({ lastMessageAt: now - 3 * DAY }, now);
  assert.match(back, /距上次对话 3 天/);
  assert.match(reunionHint({ lastMessageAt: now - 3 * DAY }, now), /惦记/);
  assert.equal(reunionHint({ lastMessageAt: now - 60_000 }, now), "");
  // A late-night turn gets the quiet hint; an afternoon one does not.
  assert.match(
    reunionHint(
      { lastMessageAt: now - 60_000 },
      Date.parse("2026-09-16T23:40:00"),
    ),
    /深夜/,
  );
  assert.equal(formatTimeContext({}, now).endsWith("。"), true);
});

test("persona cards exist for every built-in role and never come from the client", () => {
  for (const id of [
    "shen",
    "wen",
    "jiang",
    "gu",
    "li",
    "wang",
    "zhang",
    "chen",
  ]) {
    const card = personaCard(id);
    assert.match(card, /【角色卡】/);
    assert.match(card, /说话方式：/);
    assert.match(card, /绝对不做：/);
  }
  const custom = {
    id: "custom-x",
    name: "林间",
    gender: "女",
    setting: "植物研究员",
    style: "温柔简短",
    relationship: "朋友",
  };
  assert.match(personaCard("custom-x", custom), /林间/);
  assert.match(personaCard("custom-x", custom), /温柔简短/);
  assert.match(
    personaCard("custom-x", { ...custom, relationship: "十年的朋友" }),
    /当前关系：十年的朋友/,
  );
  assert.equal(personaCard("nobody"), null);
});

test("system prompt puts stable blocks first and the volatile clock last", () => {
  const body = {
    task: "chat",
    person: "wen",
    settings: { mode: "自然陪伴", language: "中文" },
    messages: [{ role: "user", content: "今天好累" }],
    memories: [entry("她在准备考研", { kind: "profile" }, 2)],
    context: { now, lastMessageAt: now - 3 * DAY, turnsToday: 2 },
  };
  const system = buildSystem(body, null, now);
  const blocks = system.split("\n");
  assert.match(blocks[0], /^你是陪伴App中的虚构角色。/);
  assert.match(system, /【角色卡】/);
  assert.ok(
    system.indexOf("【角色卡】") < system.indexOf("你记得的关于对方的事"),
    "人设卡必须排在记忆块之前（前缀缓存）",
  );
  assert.ok(
    system.indexOf("你记得的关于对方的事") < system.indexOf("当前时间："),
    "时间上下文必须排在最后，避免每轮破坏前缀",
  );
  assert.match(system, /\[profile\|2天前\] \[id:[^\]]+\] 她在准备考研/);
  assert.match(system, /未经信任的数据/);
  assert.match(system, /"memory":null或\{"text"/);
  // No memories yet: say so instead of leaving the model to invent a past.
  const first = buildSystem({ ...body, memories: [] }, null, now);
  assert.match(first, /你还不了解对方/);
  assert.equal(first.includes("你记得的关于对方的事"), false);
  assert.match(first, /禁止暗示自己记住了不存在的长期记忆/);
  // Legacy string memories still render.
  assert.match(
    buildSystem({ ...body, memories: ["她在上海"] }, null, now),
    /\[event\|今天\] 她在上海/,
  );
});

test("scored memory fields survive the store schema", () => {
  const state = {
    version: 1,
    loggedIn: true,
    onboardingComplete: true,
    name: "T",
    bio: "",
    contacts: [],
    chats: {},
    drafts: {},
    settings: {},
    posts: [],
    memories: {
      wen: [
        entry("她在准备考研", {
          kind: "profile",
          salience: 5,
          hits: 2,
          emotion: "焦虑",
          updatedAt: now,
        }),
      ],
    },
  };
  assert.equal(validState(state), true);
  assert.equal(
    validState({
      ...state,
      memories: { wen: [entry("坏数据", { kind: "hack" })] },
    }),
    false,
  );
  assert.equal(
    validState({
      ...state,
      memories: { wen: [entry("坏数据", { salience: 9 })] },
    }),
    false,
  );
});
