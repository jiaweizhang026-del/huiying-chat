import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { legacyUser } from "./legacy-user.mjs";
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROME_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
    : {},
);
const page = await browser.newPage({
  viewport: { width: 1180, height: 1050 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function screenshot(name) {
  await page.waitForFunction(() =>
    [...document.images].every((i) => i.complete),
  );
  await page.waitForTimeout(350);
  await page.screenshot({
    path: `test-results/${name}.png`,
    animations: "disabled",
  });
}
await mkdir("test-results", { recursive: true });
try {
  await page.goto(process.env.TEST_URL || "http://localhost:5178");
  await legacyUser(page);
  await page.getByText("微信一键登录", { exact: true }).waitFor();
  await page.locator(".welcome-art.ready").waitFor();
  await screenshot("01-welcome");
  await page.getByText("微信一键登录", { exact: true }).click();
  await page.locator(".conversation-row").first().waitFor();
  assert.equal(await page.locator(".conversation-row").count(), 4);
  await screenshot("02-conversations");
  await page.getByRole("button", { name: "文牧野" }).click();
  const input = page.getByRole("textbox", { name: "消息", exact: true });
  await input.click();
  assert.equal(
    await input.evaluate((el) => getComputedStyle(el).outlineStyle),
    "none",
  );
  assert.equal(
    await input.evaluate((el) => getComputedStyle(el).boxShadow),
    "none",
  );
  assert.equal(
    await input.evaluate((el) => getComputedStyle(el).caretColor),
    "rgb(23, 24, 29)",
  );
  await page
    .locator(".composer")
    .screenshot({ path: "test-results/input-focused.png" });
  await page.getByRole("textbox", { name: "消息", exact: true }).fill("你好");
  await page.getByRole("button", { name: "发送消息" }).click();
  await page.getByRole("status", { name: "对方正在输入" }).waitFor();
  await screenshot("03-typing");
  await page
    .getByText("看看 TA 的想法", { exact: true })
    .waitFor({ timeout: 55000 });
  await page.getByText("看看 TA 的想法", { exact: true }).click();
  await screenshot("04-chat");
  await page.getByRole("button", { name: "更多聊天功能" }).click();
  await page.getByRole("button", { name: "帮我回复", exact: true }).click();
  await page.locator(".suggestion").first().click();
  assert.ok(
    await page.getByRole("textbox", { name: "消息", exact: true }).inputValue(),
  );
  assert.equal(
    await page.locator(".message.user").count(),
    1,
    "Suggestion must not autosend",
  );
  await page
    .getByRole("textbox", { name: "消息", exact: true })
    .fill("今天工作有点累");
  await page.getByRole("button", { name: "发送消息" }).click();
  await page
    .locator(".typing-row")
    .waitFor({ state: "hidden", timeout: 55000 });
  await page.getByRole("button", { name: "聊天设置", exact: true }).click();
  await screenshot("05-settings");
  await page.getByRole("button", { name: "回复模式", exact: true }).click();
  await page.getByRole("button", { name: "简短 简单几句，轻松一点" }).click();
  await page.getByRole("button", { name: "与他的记忆", exact: true }).click();
  await page.getByText("你说：「今天工作有点累」", { exact: true }).waitFor();
  await screenshot("06-memory");
  await page.getByRole("button", { name: "查看记忆照片" }).first().click();
  await page.getByRole("button", { name: "关闭图片" }).click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "聊天记录", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索聊天记录" }).fill("工作");
  assert.ok((await page.locator(".history-result").count()) > 0);
  await page.locator(".history-result").first().click();
  await page.locator(".message.highlighted").waitFor();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "发现", exact: true }).click();
  await screenshot("07-discover");
  await page.locator(".discover-card").nth(2).click();
  await page.getByRole("button", { name: "和 TA 聊聊" }).click();
  assert.equal(
    await page.locator(".message.user").count(),
    0,
    "Characters must have isolated conversations",
  );
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "社区", exact: true }).click();
  await page.getByRole("button", { name: "发布日常" }).click();
  await page
    .getByRole("textbox", { name: "编辑内容" })
    .fill("今天也有一件小小的好事。");
  await page
    .getByRole("button", { name: "发布日常", exact: true })
    .last()
    .click();
  await page
    .getByRole("textbox", { name: "编辑内容" })
    .waitFor({ state: "hidden" });
  await page.getByText("今天也有一件小小的好事。", { exact: true }).waitFor();
  await screenshot("08-moments");
  await page.reload();
  await page.getByRole("button", { name: "社区", exact: true }).click();
  await page.getByText("今天也有一件小小的好事。", { exact: true }).waitFor();
  for (const width of [320, 375, 402, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "发现", exact: true }).click();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    );
    assert.ok(fits, `No horizontal overflow at ${width}px`);
    await screenshot(`responsive-${width}`);
  }
  assert.deepEqual(errors, [], "No uncaught browser errors");
  assert.equal(
    await page.locator(".image-fallback").count(),
    0,
    "All Figma assets should load",
  );
  console.log(
    "PASS: login, chat, emoji loading, inner voice, draft suggestions, memory, history, profile, settings, moments, persistence, 5 responsive widths.",
  );
} finally {
  await browser.close();
}
