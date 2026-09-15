// Single-local-user repository. Compare-and-swap revisions prevent stale tabs overwriting data.
const CACHE = "huiying.demo.v1";
const RECOVERY = "huiying.unsaved.v1";
const ARCHIVE = "huiying.conflict-backup.v1";
let revision = 0,
  pending = null,
  inflight = null,
  timer,
  problem = null;
let status = { saving: false, error: null };
const listeners = new Set();
function notify(next) {
  status = next;
  listeners.forEach((fn) => fn(status));
}
async function write(state) {
  const res = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision, state }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(body.error || "本地后端保存失败"), {
      status: res.status,
    });
  revision = body.revision;
  return body;
}
export async function loadState(fallback) {
  const response = await fetch("/api/state", {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error("本地后端暂时无法读取数据，请检查服务后重试。");
  const remote = await response.json();
  revision = remote.revision;
  let state = remote.state;
  if (!state) {
    try {
      const old = JSON.parse(localStorage.getItem(CACHE));
      state = old?.version === 1 ? old : null;
    } catch {}
    state ||= fallback();
    await write(state);
  }
  // Do not silently discard a draft whose last disk write failed.
  let recovery;
  try {
    recovery = JSON.parse(localStorage.getItem(RECOVERY));
  } catch {}
  if (
    recovery?.state &&
    JSON.stringify(recovery.state) === JSON.stringify(state)
  ) {
    // A previous write reached disk even if its HTTP acknowledgement was lost.
    try {
      localStorage.removeItem(RECOVERY);
    } catch {}
  } else if (recovery?.revision === revision && recovery.state) {
    state = recovery.state;
    await write(state);
    try {
      localStorage.removeItem(RECOVERY);
    } catch {}
  } else if (recovery) {
    // Keep conflicting changes separately before using the latest server state.
    // If storage is full, stop boot instead of overwriting the only backup.
    const archives = JSON.parse(localStorage.getItem(ARCHIVE) || "[]");
    archives.push(recovery);
    localStorage.setItem(ARCHIVE, JSON.stringify(archives));
    localStorage.removeItem(RECOVERY);
    problem = new Error(
      "已同步后端最新数据；上次冲突的未保存内容已单独保留，可导出备份。",
    );
    notify({ saving: false, error: problem.message });
  }
  try {
    localStorage.setItem(CACHE, JSON.stringify(state));
  } catch {}
  return state;
}
export function scheduleSave(state) {
  pending = state;
  try {
    localStorage.setItem(CACHE, JSON.stringify(state));
    localStorage.setItem(RECOVERY, JSON.stringify({ revision, state }));
  } catch {}
  notify({ saving: true, error: problem?.message || null });
  clearTimeout(timer);
  timer = setTimeout(() => flushSave().catch(() => {}), 250);
}
export async function flushSave() {
  clearTimeout(timer);
  if (problem?.status === 409) throw problem;
  if (inflight) return inflight;
  inflight = (async () => {
    while (pending) {
      const snapshot = pending;
      pending = null;
      try {
        await write(snapshot);
        problem = null;
        try {
          if (pending)
            localStorage.setItem(
              RECOVERY,
              JSON.stringify({ revision, state: pending }),
            );
          else localStorage.removeItem(RECOVERY);
        } catch {}
      } catch (e) {
        pending ||= snapshot;
        problem = e;
        notify({ saving: false, error: e.message });
        throw e;
      }
    }
    notify({ saving: false, error: null, savedAt: Date.now() });
  })();
  try {
    await inflight;
  } finally {
    inflight = null;
  }
}
export function subscribeSave(listener) {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}
export function hasUnsavedChanges() {
  return !!pending || !!inflight;
}
export function recoveryBackup() {
  try {
    const pending = localStorage.getItem(RECOVERY);
    const conflicts = localStorage.getItem(ARCHIVE);
    return pending || conflicts
      ? JSON.stringify({
          pending: pending ? JSON.parse(pending) : null,
          conflicts: conflicts ? JSON.parse(conflicts) : [],
        })
      : null;
  } catch {
    return null;
  }
}
