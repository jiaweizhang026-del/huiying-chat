// Time awareness. Without it every request looks like "the first message of
// the day", so the character can never say "昨晚那件事后来怎么样了" — which is
// most of what "被惦记" feels like.

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function buildChatContext(
  messages,
  { task = "chat", now = Date.now() } = {},
) {
  // The request's message snapshot ends at the current user turn (also on retry).
  const lastUser = messages.findLastIndex((m) => m.role === "user");
  const prior =
    task === "chat" && lastUser >= 0 ? messages.slice(0, lastUser) : messages;
  const valid = prior.filter(
    (m) => !m.opening && !m.error && ["user", "assistant"].includes(m.role),
  );
  const date = new Date(now);
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const nightStart = new Date(date);
  if (date.getHours() < 5) nightStart.setDate(nightStart.getDate() - 1);
  nightStart.setHours(23, 0, 0, 0);
  const said = (since, pattern) =>
    messages.some(
      (m) =>
        m.role === "assistant" &&
        !m.opening &&
        m.time >= since &&
        m.time <= now &&
        pattern.test(m.text || ""),
    );
  return {
    now,
    lastMessageAt: valid.at(-1)?.time || 0,
    turnsToday: messages.filter(
      (m) =>
        m.role === "user" &&
        !m.image &&
        !m.error &&
        m.time >= start.getTime() &&
        m.time <= now,
    ).length,
    sleepReminded: Number(
      said(
        nightStart.getTime(),
        /早点(睡|休息)|早些(睡|休息)|别(再)?熬夜|该睡了|去睡吧|早点上床|晚安|sleep (soon|early)|get some (sleep|rest)/i,
      ),
    ),
    lunchReminded: Number(
      said(
        start.getTime(),
        /吃.{0,8}(饭|午餐|午饭)|午饭|午餐|lunch|have you eaten/i,
      ),
    ),
  };
}

export function gapMinutes(ctx, now = Date.now()) {
  const last = Number(ctx?.lastMessageAt) || 0;
  if (!last || now < last) return null;
  return Math.round((now - last) / 60_000);
}

export function formatGap(minutes) {
  if (minutes === null) return "";
  if (minutes < 2) return "你们刚刚还在聊";
  if (minutes < 60) return `距上次对话 ${minutes} 分钟`;
  if (minutes < 60 * 24) return `距上次对话 ${Math.round(minutes / 60)} 小时`;
  return `距上次对话 ${Math.round(minutes / (60 * 24))} 天`;
}

export function formatTimeContext(ctx = {}, now = Date.now()) {
  const date = new Date(now);
  const clock = `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
  const parts = [
    `当前时间：${date.getMonth() + 1}月${date.getDate()}日 周${
      WEEKDAYS[date.getDay()]
    } ${clock}`,
  ];
  const gap = formatGap(gapMinutes(ctx, now));
  if (gap) parts.push(gap);
  const turns = Number(ctx?.turnsToday);
  if (Number.isFinite(turns) && turns > 0) parts.push(`今天已聊 ${turns} 轮`);
  return parts.join("；") + "。";
}

// Late at night or after a long gap the tone should shift, but telling the
// model "be caring" produces greeting-card filler. Give it the situation and
// one concrete instruction instead.
export function reunionHint(ctx = {}, now = Date.now()) {
  const minutes = gapMinutes(ctx, now);
  const hour = new Date(now).getHours();
  const hints = [];
  if (minutes !== null && minutes >= 60 * 12)
    hints.push(
      "对方隔了一段时间才回来：可以自然带一句惦记（比如问起上次那件事的结果），但不要说「好久不见」「你终于来了」这类套话。",
    );
  if (hour >= 23 || hour < 5)
    hints.push(
      ctx.sleepReminded
        ? "现在是深夜：语气放轻；今晚已经提醒过休息，禁止再次主动劝睡或说晚安，正常回应对方的话题。"
        : "现在是深夜：语气放轻，如果对方还想聊就陪着，也可以提醒早点休息一次，不要反复劝。",
    );
  if (hour >= 11 && hour <= 13)
    hints.push(
      ctx.lunchReminded
        ? "今天已关心过吃饭，禁止再次主动问吃没吃，继续当前话题。"
        : "正值午饭时间：可以自然地关心有没有吃饭，只提一次。",
    );
  return hints.join("");
}
