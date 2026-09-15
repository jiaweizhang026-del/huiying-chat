// Opt-in only. Uses 2 small real DeepSeek requests on a separate data store.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const url = process.env.TEST_URL;
if (!url || !url.endsWith(":5189"))
  throw new Error("Use the isolated --live runner");
const status = await (await fetch(url + "/api/status")).json();
assert.equal(status.configured, true, "A server-side API key is required");
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROME_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
    : {},
);
await mkdir("test-results", { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 1030 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByRole("button", { name: "微信一键登录" }).click();
  for (const label of ["对话", "发现", "社区", "我的", "对话"]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: label, exact: true })
      .click();
    assert.equal(
      await page.locator('.bottom-nav [data-icon-state="filled"]').count(),
      1,
    );
    assert.equal(
      await page.locator('.bottom-nav [data-icon-state="line"]').count(),
      3,
    );
    await page.waitForTimeout(300);
    const glass = await page
      .locator(".bottom-nav")
      .evaluate((e) => getComputedStyle(e).backdropFilter);
    assert.ok(glass.includes("blur"));
    await page
      .locator(".bottom-nav")
      .screenshot({ path: `test-results/live-nav-${label}.png` });
  }
  await page.getByRole("button", { name: "文牧野" }).click();
  const text =
    "记住我最喜欢的饮料是桂花乌龙。今天做完项目有点累，想和你聊一会儿。";
  await page.getByRole("textbox", { name: "消息", exact: true }).fill(text);
  const replyPromise = page.waitForResponse(
    (r) => r.url().endsWith("/api/chat") && r.request().method() === "POST",
    { timeout: 60000 },
  );
  await page.getByRole("button", { name: "发送消息" }).click();
  await page.getByRole("status", { name: "对方正在输入" }).waitFor();
  const reply = await (await replyPromise).json();
  assert.equal(reply.mode, "live");
  assert.ok(reply.messages.length);
  assert.ok(reply.innerVoice);
  assert.ok(reply.memory);
  await page
    .locator(".typing-row")
    .waitFor({ state: "hidden", timeout: 60000 });
  await page.getByText("看看 TA 的想法", { exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "test-results/live-chat.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "更多聊天功能" }).click();
  const suggestionsPromise = page.waitForResponse(
    (r) => r.url().endsWith("/api/chat"),
    { timeout: 60000 },
  );
  await page.getByRole("button", { name: "帮我回复", exact: true }).click();
  assert.equal((await (await suggestionsPromise).json()).mode, "live");
  await page.locator(".suggestion").first().click();
  assert.equal(await page.locator(".message.user").count(), 1);
  await page.getByRole("button", { name: "聊天设置", exact: true }).click();
  await page.getByRole("button", { name: "与他的记忆", exact: true }).click();
  assert.ok((await page.locator(".memory-mood").count()) >= 3);
  assert.ok(
    await page
      .locator(".memory-mood")
      .first()
      .evaluate((e) =>
        getComputedStyle(e).backgroundImage.includes("s4-imgEllipse3"),
      ),
  );
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "test-results/live-memory.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "社区", exact: true })
    .click();
  await page.getByRole("button", { name: "发布日常", exact: true }).click();
  const postText = "真实闭环测试：今天完成了一个小目标，奖励自己一杯桂花乌龙。";
  await page.getByRole("textbox", { name: "编辑内容" }).fill(postText);
  const chooser = page.waitForEvent("filechooser");
  await page.locator(".add-photo").click();
  await (await chooser).setFiles("public/assets/s4-imgRectangle11.png");
  await page.locator(".upload-thumbnails .photo").waitFor();
  await page
    .getByRole("button", { name: "发布日常", exact: true })
    .last()
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .locator(".community-post")
    .first()
    .getByRole("button", { name: "点赞", exact: true })
    .click();
  await page.locator('[data-save-state="saved"]').waitFor();
  const snapshot = await (await fetch(url + "/api/state")).json();
  assert.ok(
    snapshot.state.posts.some(
      (p) =>
        p.text === postText && p.photos.length === 1 && p.likes.includes("me"),
    ),
  );
  assert.ok(snapshot.state.chats.wen.some((m) => m.mode === "live"));
  assert.ok(snapshot.state.memories.wen.some((m) => m.source === "AI 整理"));
  const clean = await browser.newContext();
  const fresh = await clean.newPage();
  await fresh.goto(url);
  await fresh
    .getByRole("navigation")
    .getByRole("button", { name: "社区", exact: true })
    .click();
  await fresh.getByText(postText, { exact: true }).waitFor();
  await fresh
    .getByRole("navigation")
    .getByRole("button", { name: "对话", exact: true })
    .click();
  await fresh.getByRole("button", { name: /文牧野/ }).click();
  await fresh.getByText(text, { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  assert.equal(
    (await (await fetch(url + "/api/status")).json()).verifiedAt > 0,
    true,
  );
  console.log(
    JSON.stringify({
      passed: true,
      model: status.model,
      realRequests: 2,
      checks: [
        "live chat",
        "live reply suggestions",
        "AI memory",
        "four fill/line states",
        "glass",
        "emoji backgrounds",
        "photo post + like",
        "new browser restores server data",
      ],
    }),
  );
  await clean.close();
} finally {
  await browser.close();
}
