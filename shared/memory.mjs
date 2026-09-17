// Memory plumbing shared by the client (decide what to send) and the server
// (normalise what the model returns). Pure functions only: no fetch, no disk,
// no DOM — so they can be unit tested without booting the app.
//
// The product promise is "TA 记得我", not "we store strings". Three things make
// that true: memories are typed, they merge instead of piling up, and only a
// scored subset reaches the model (the old code sent the newest 8, so anything
// after the 8th was invisible to the model forever).

export const MEMORY_KINDS = [
  "profile", // stable facts about the user: job, studies, city
  "preference", // likes and dislikes
  "event", // something that happened to them
  "emotion", // how they felt
  "relationship", // something shared between the two of you
  "quote", // demo-mode excerpt of the user's own words (noise, keep out of prompt)
  "photo", // a picture was shared (noise, the model cannot see images)
];
export const MEMORY_TEXT_MAX = 200;
export const MEMORY_LIMIT = 10;
// Stable facts are always worth a slot, even if a fresher event scores higher.
const PROFILE_RESERVE = 4;
// Thirty-day half-life: a fact told 30 days ago keeps 50% of its
// recency score, one told today keeps all of it.
const HALF_LIFE_DAYS = 30;
const SENSITIVE =
  /(身份证|护照|银行卡|信用卡|验证码|密码|社保|家庭住址|详细住址|住址是|银行卡号)/;
const CONTROL = /[\p{Cc}\p{Cf}]/gu;
const QUOTE_CHARS = "\"'“”「」《》";
// Only strip a *wrapping* pair. Stripping any trailing quote marker would
// mangle sentences like 你说：「今天工作有点累」 — the closing bracket belongs
// to the quote inside the sentence, not to the wrapper.
function stripWrappingQuotes(text) {
  if (text.length < 2) return text;
  const first = text[0],
    last = text[text.length - 1];
  return QUOTE_CHARS.includes(first) && QUOTE_CHARS.includes(last)
    ? text.slice(1, -1)
    : text;
}

export function cleanText(text, max = MEMORY_TEXT_MAX) {
  if (typeof text !== "string") return "";
  return stripWrappingQuotes(
    text.replace(CONTROL, " ").replace(/\s+/g, " ").trim(),
  )
    .slice(0, max)
    .trim();
}

// Same sentence, different punctuation/whitespace should not become two
// memories: "我在考研" and "我在考研。" are one fact.
export function normalizeKey(text) {
  return cleanText(text, 400)
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

// Conservative equivalence for a common stable fact. Negation, subjects and
// qualifiers are kept; general paraphrases use a validated model matchId.
export function factKey(text) {
  return normalizeKey(text)
    .replace(/^(用户|对方|我)(正在|目前正在|目前在|在)?/, "")
    .replace(
      /^(正在|在)?(准备考研|备考研究生|备考研究生考试|准备研究生考试)$/,
      "考研",
    );
}

export function tokens(text) {
  const out = new Set();
  for (const word of cleanText(text, 400).match(/[\p{L}\p{N}]+/gu) || []) {
    if (/^[a-z0-9]+$/i.test(word)) {
      out.add(word.toLowerCase());
      continue;
    }
    if (word.length < 2) {
      out.add(word);
      continue;
    }
    // Chinese has no spaces: bigrams are the cheapest usable "word".
    for (let i = 0; i < word.length - 1; i++) out.add(word.slice(i, i + 2));
  }
  return out;
}

function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size);
}

export function ageInDays(entry, now = Date.now()) {
  const parsed = Date.parse(`${entry?.date || ""}T00:00:00`);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, (now - parsed) / 86_400_000);
}

// Turn a model reply (string from older prompts, object from the current one)
// into the shape we persist. Returns null when there is nothing worth keeping.
export function normalizeMemory(raw, { source } = {}) {
  if (raw == null) return null;
  const input = typeof raw === "string" ? { text: raw } : raw;
  if (!input || typeof input !== "object") return null;
  const text = cleanText(input.text ?? input.content);
  if (!text || SENSITIVE.test(text)) return null;
  const kind = MEMORY_KINDS.includes(input.kind) ? input.kind : "event";
  const given = Number(input.salience);
  const salience = Number.isFinite(given)
    ? Math.min(5, Math.max(1, Math.round(given)))
    : kind === "profile" || kind === "preference"
      ? 4
      : 3;
  const emotion =
    typeof input.emotion === "string" ? cleanText(input.emotion, 20) : "";
  return {
    text,
    kind,
    salience,
    ...(emotion ? { emotion } : {}),
    ...(source ? { source } : {}),
    ...(typeof input.matchId === "string" && input.matchId.length <= 100
      ? { matchId: input.matchId }
      : {}),
  };
}

// Small deterministic safety net for explicit, high-signal facts. The model
// normally supplies the structured memory, but a transient format failure must
// not make a plainly stated fact disappear from the user's memory page.
export function inferExplicitMemory(text) {
  const value = cleanText(text);
  if (!value || /不(准备|打算|想)?考研|不备考/.test(value)) return null;
  if (
    /(我|用户|对方).{0,8}(准备|备考|打算考|想考).{0,8}(考研|研究生|研究生考试)/.test(
      value,
    ) ||
    /(我|用户|对方).{0,4}(考研|研究生考试)/.test(value)
  ) {
    return normalizeMemory(
      {
        text: "用户正在准备考研",
        kind: "profile",
        salience: 5,
      },
      { source: "AI 整理" },
    );
  }
  if (/(我|用户|对方).{0,6}(最近|现在|目前)?在找工作/.test(value))
    return normalizeMemory(
      { text: "用户最近在找工作", kind: "event", salience: 4 },
      { source: "AI 整理" },
    );
  const liked = value.match(
    /(?:我|用户|对方)(?:最)?喜欢(?:吃|喝)?([^，。！？!?,\s]{1,12})/,
  );
  if (liked && !/不喜欢|不爱/.test(value))
    return normalizeMemory(
      { text: `用户喜欢${liked[1]}`, kind: "preference", salience: 4 },
      { source: "AI 整理" },
    );
  return null;
}

// Low-information entries: nice in the UI, but they eat the prompt slots that
// real facts about the user need.
function isNoise(entry) {
  return (
    entry.photoMemory === true ||
    entry.kind === "photo" ||
    entry.kind === "quote" ||
    entry.source === "聊天摘录"
  );
}

export function memoryScore(entry, query = "", now = Date.now()) {
  const queryTokens = query ? tokens(query) : null;
  const recency = 2 ** (-ageInDays(entry, now) / HALF_LIFE_DAYS);
  // Old hits counted exposure, so never use them as evidence of recall.
  const hits = 1 + Math.log1p(entry.referenceCount || 0) * 0.6;
  const salience = entry.salience || 3;
  const relevance =
    1 + (queryTokens ? overlap(queryTokens, tokens(entry.text)) * 2.5 : 0);
  return salience * recency * hits * relevance;
}

// Pick what the model gets to see. The old newest-N window buried every fact
// older than the window, so "TA 记得我" silently stopped being true after a
// handful of turns.
export function selectMemories(list, options = {}) {
  const {
    query = "",
    now = Date.now(),
    limit = MEMORY_LIMIT,
    excludeNoise = true,
  } = options;
  const items = (Array.isArray(list) ? list : []).filter(
    (m) => m && m.text && !m.seed && !(excludeNoise && isNoise(m)),
  );
  const ranked = items
    .map((m) => ({ m, score: memoryScore(m, query, now) }))
    .sort((a, b) => b.score - a.score);
  const chosen = ranked
    .filter((x) => x.m.kind === "profile")
    .slice(0, PROFILE_RESERVE);
  for (const item of ranked) {
    if (chosen.length >= limit) break;
    if (!chosen.includes(item)) chosen.push(item);
  }
  return chosen.slice(0, limit).map((x) => x.m);
}

// Write path: a repeated fact bumps a counter instead of being stored again.
export function mergeMemory(list, entry, { id, date, emoji } = {}) {
  const items = Array.isArray(list) ? list : [];
  const key = factKey(entry.text);
  const index = key
    ? items.findIndex(
        (m) =>
          !m.seed &&
          m.text &&
          isNoise(m) === isNoise(entry) &&
          ((factKey(m.text) === key &&
            (entry.kind === "profile" ||
              entry.kind === "preference" ||
              m.date === date)) ||
            (!isNoise(m) && m.id === entry.matchId)),
      )
    : -1;
  const { matchId, ...storedEntry } = entry;
  if (index === -1) {
    const created = {
      id: id || `mem-${Math.random().toString(36).slice(2, 10)}`,
      date,
      ...(emoji ? { emoji } : {}),
      hits: 0,
      mentionCount: 1,
      referenceCount: 0,
      ...storedEntry,
    };
    return { list: [created, ...items], status: "added", entry: created };
  }
  const previous = items[index];
  const merged = {
    ...previous,
    // Keep the longer wording: the newer phrasing is usually the fuller one.
    text:
      (entry.text || "").length > (previous.text || "").length
        ? entry.text
        : previous.text,
    kind: entry.kind || previous.kind,
    salience: Math.max(previous.salience || 3, entry.salience || 3),
    emotion: entry.emotion || previous.emotion,
    source: entry.source || previous.source,
    mentionCount: (previous.mentionCount || 1) + 1,
    updatedAt: Date.now(),
  };
  return {
    list: items.map((m, i) => (i === index ? merged : m)),
    status: "merged",
    entry: merged,
  };
}

// Read path: a memory that actually made it into a reply is a memory worth
// keeping near the top of the pile.
export function bumpHits(list, ids) {
  const set = new Set(ids);
  if (!set.size) return Array.isArray(list) ? list : [];
  return (Array.isArray(list) ? list : []).map((m) =>
    set.has(m.id) && !m.seed && !isNoise(m)
      ? { ...m, referenceCount: (m.referenceCount || 0) + 1 }
      : m,
  );
}

export function formatMemoryLines(list, now = Date.now()) {
  return (Array.isArray(list) ? list : []).map((m) => {
    const days = Math.floor(ageInDays(m, now));
    const when =
      days < 1
        ? "今天"
        : days < 2
          ? "昨天"
          : days < 30
            ? `${days}天前`
            : m.date;
    return `[${m.kind || "event"}|${when}] ${m.id ? `[id:${m.id}] ` : ""}${m.text}`;
  });
}
