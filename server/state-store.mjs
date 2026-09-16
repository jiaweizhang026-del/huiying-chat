import { mkdir, readFile, open, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { exploreCharacters } from "../shared/explore-characters.mjs";
import { validCustom } from "../shared/custom-characters.mjs";

const ids = ["shen", "wen", "jiang", "gu", "li", "wang", "zhang", "chen"];
ids.push(...exploreCharacters.map((p) => p.id));
const obj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const str = (x, n) => typeof x === "string" && x.length <= n;
const list = (x, n, fn) => Array.isArray(x) && x.length <= n && x.every(fn);
const image = (x) =>
  str(x, 2_000_000) &&
  (/^\/assets\/[\w.-]+$/.test(x) ||
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x));
const record = (x, fn) =>
  obj(x) && Object.entries(x).every(([k, v]) => ids.includes(k) && fn(v));
export function validState(s) {
  if (!obj(s) || !list(s.customCharacters || [], 100, validCustom))
    return false;
  const custom = (s.customCharacters || []).map((p) => p.id);
  if (new Set(custom).size !== custom.length) return false;
  const allowedIds = [...ids, ...custom];
  const record = (x, fn) =>
    obj(x) &&
    Object.entries(x).every(([k, v]) => allowedIds.includes(k) && fn(v));
  return (
    obj(s) &&
    s.version === 1 &&
    typeof s.loggedIn === "boolean" &&
    (s.hasLoggedIn === undefined || typeof s.hasLoggedIn === "boolean") &&
    str(s.name, 80) &&
    str(s.bio, 1000) &&
    (s.onboardingComplete === undefined ||
      typeof s.onboardingComplete === "boolean") &&
    list(s.pinned || [], allowedIds.length, (x) => allowedIds.includes(x)) &&
    list(s.hiddenChats || [], allowedIds.length, (x) =>
      allowedIds.includes(x),
    ) &&
    list(s.contacts, allowedIds.length, (x) => allowedIds.includes(x)) &&
    new Set(s.contacts).size === s.contacts.length &&
    record(s.chats, (v) =>
      list(
        v,
        10000,
        (m) =>
          obj(m) &&
          str(m.id, 100) &&
          ["user", "assistant", "system"].includes(m.role) &&
          str(m.text, 8000) &&
          Number.isFinite(m.time) &&
          (!m.image || image(m.image)),
      ),
    ) &&
    record(s.drafts, (v) => str(v, 4000)) &&
    record(
      s.settings,
      (v) =>
        obj(v) &&
        (!v.mode || ["自然陪伴", "简短", "故事"].includes(v.mode)) &&
        (!v.background || ["原稿灰", "米白", "风景"].includes(v.background)) &&
        (!v.language || ["中文", "English"].includes(v.language)) &&
        (!v.pat || str(v.pat, 200)),
    ) &&
    record(s.memories, (v) =>
      list(
        v,
        10000,
        (m) =>
          obj(m) &&
          str(m.id, 100) &&
          str(m.text, 2000) &&
          /^\d{4}-\d{2}-\d{2}$/.test(m.date) &&
          (!m.photos || list(m.photos, 3, image)),
      ),
    ) &&
    list(
      s.posts,
      2000,
      (p) =>
        obj(p) &&
        str(p.id, 100) &&
        ["me", ...allowedIds].includes(p.person) &&
        str(p.text, 2000) &&
        (!p.scope || ["square", "friends"].includes(p.scope)) &&
        Number.isFinite(p.time) &&
        list(p.photos, 3, image) &&
        list(p.likes, 50, (x) => str(x, 100)) &&
        list(
          p.comments,
          1000,
          (c) =>
            obj(c) && str(c.id, 100) && str(c.name, 80) && str(c.text, 2000),
        ),
    )
  );
}
export class StateStore {
  constructor(filename) {
    this.filename = path.resolve(filename);
    this.document = { revision: 0, state: null };
    this.queue = Promise.resolve();
  }
  async init() {
    await mkdir(path.dirname(this.filename), { recursive: true, mode: 0o700 });
    try {
      const d = JSON.parse(await readFile(this.filename, "utf8"));
      if (!Number.isSafeInteger(d.revision) || !validState(d.state))
        throw new Error("invalid-state");
      this.document = d;
    } catch (e) {
      if (e.code !== "ENOENT")
        throw new Error("本地数据文件无法读取。请先备份检查，不会覆盖原文件。");
    }
    return this;
  }
  get() {
    return structuredClone(this.document);
  }
  put(state, revision) {
    const job = this.queue.then(async () => {
      if (!validState(state))
        throw Object.assign(new Error("数据格式不正确，未保存。"), {
          status: 400,
        });
      if (revision !== this.document.revision)
        throw Object.assign(
          new Error(
            "另一个窗口已更新数据。请先导出当前更改，再刷新页面，避免覆盖。",
          ),
          { status: 409 },
        );
      const next = {
        revision: revision + 1,
        state: structuredClone(state),
        savedAt: Date.now(),
      };
      const temp = this.filename + "." + randomUUID() + ".tmp";
      const handle = await open(temp, "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify(next));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temp, this.filename); // atomic replace; previous state survives a failed write
      this.document = next;
      return { revision: next.revision, savedAt: next.savedAt };
    });
    this.queue = job.catch(() => {});
    return job;
  }
}
