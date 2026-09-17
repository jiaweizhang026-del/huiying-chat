// Isolated browser regression; model responses are mocked, no paid API calls.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROME_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
    : {},
);
const page = await browser.newPage();
try {
  await page.goto(process.env.TEST_URL);
  await page.getByText("微信一键登录", { exact: true }).waitFor();
  const previous = Date.now() - 86400000;
  await page.evaluate(async (previous) => {
    const doc = await (await fetch("/api/state")).json();
    const date = new Date().toLocaleDateString("sv-SE");
    const state = {
      ...doc.state,
      loggedIn: true,
      onboardingComplete: true,
      contacts: ["wen"],
      chats: {
        wen: [
          {
            id: "prior",
            role: "assistant",
            text: "昨天的对话",
            time: previous,
          },
        ],
      },
      memories: {
        wen: [
          { id: "exam", text: "我在考研", kind: "profile", date },
          { id: "tea", text: "喜欢喝茶", kind: "preference", date },
          { id: "quote", text: "旧演示摘录", source: "聊天摘录", date },
        ],
      },
    };
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: doc.revision, state }),
    });
    if (!response.ok) throw new Error("Fixture save failed");
  }, previous);
  let captured;
  await page.route("**/api/chat", async (route) => {
    captured = route.request().postDataJSON();
    await route.fulfill({
      json: {
        messages: ["考研最近进展怎么样？"],
        innerVoice: "记着这件事。",
        mode: "live",
        usedMemoryIds: ["exam", "exam", "not-selected"],
        memory: {
          text: "用户正在备考研究生",
          kind: "profile",
          matchId: "exam",
          salience: 4,
        },
      },
    });
  });
  await page.reload();
  await page.locator(".conversation-row").filter({ hasText: "文牧野" }).click();
  await page
    .getByRole("textbox", { name: "消息", exact: true })
    .fill("我还在备考研究生");
  await page.getByRole("button", { name: "发送消息" }).click();
  await page.getByText("考研最近进展怎么样？", { exact: true }).waitFor();
  await page.locator('[data-save-state="saved"]').waitFor();
  assert.equal(captured.context.lastMessageAt, previous);
  assert.equal(captured.context.turnsToday, 1);
  assert.deepEqual(captured.memories.map((m) => m.id).sort(), ["exam", "tea"]);
  const state = await page.evaluate(
    async () => (await (await fetch("/api/state")).json()).state,
  );
  assert.equal(state.memories.wen.length, 3);
  assert.equal(
    state.memories.wen.find((m) => m.id === "exam").referenceCount,
    1,
  );
  assert.equal(state.memories.wen.find((m) => m.id === "exam").mentionCount, 2);
  assert.equal(
    state.memories.wen.find((m) => m.id === "tea").referenceCount,
    undefined,
  );
  await page.reload();
  const restored = await page.evaluate(
    async () => (await (await fetch("/api/state")).json()).state,
  );
  assert.deepEqual(restored.memories, state.memories);
  console.log(
    "Memory send → request context → reply → persisted recall regression passed (mock API).",
  );
} finally {
  await browser.close();
}
