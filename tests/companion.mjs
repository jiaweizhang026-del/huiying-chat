import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROME_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
    : {},
);
const url = process.env.TEST_URL;
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 1040 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const shot = async (name) => {
    await page.waitForTimeout(400);
    await page
      .locator(".app-shell")
      .screenshot({ path: `test-results/v3-${name}.png` });
  };
  const saved = () => page.locator('[data-save-state="saved"]').waitFor();
  await page.goto(url);
  await page.locator(".welcome-art.ready").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await shot("welcome");
  await page.getByRole("button", { name: "微信一键登录" }).click();
  await page.getByRole("heading", { name: "Life gift" }).waitFor();
  await shot("onboarding");
  assert.equal(await page.getByRole("navigation").count(), 0);
  await page.getByRole("button", { name: "选择角色", exact: true }).click();
  await page.locator(".discover-list.with-planet").waitFor();
  assert.equal(await page.getByRole("navigation").count(), 0);
  await shot("first-discovery");
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "创建 AI 伙伴", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "备注", exact: true })
      .evaluate((e) => e.validity.valueMissing),
    true,
  );
  await page.getByRole("textbox", { name: "备注", exact: true }).fill("林间");
  await page
    .getByRole("textbox", { name: "人物设定", exact: true })
    .fill("住在山间的植物研究员，喜欢雨后散步，耐心而有幽默感。");
  await page
    .getByRole("textbox", { name: "表达风格", exact: true })
    .fill("温柔自然，爱用植物作比喻");
  await page
    .getByRole("textbox", { name: "关系设定", exact: true })
    .fill("朋友");
  await page.getByRole("combobox", { name: "性别" }).selectOption("男");
  await page
    .locator('.avatar-upload input[type="file"]')
    .setInputFiles(
      "public/assets/v3-onboard-imgClipboardScreenshot17894751591.png",
    );
  await page.locator(".avatar-upload .photo.ready").waitFor();
  await shot("create");
  let failOnce = true;
  await page.route("**/api/state", async (route) => {
    if (route.request().method() === "PUT" && failOnce) {
      failOnce = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "模拟保存失败，请重试。" }),
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.locator(".form-error").waitFor();
  assert.equal(
    await page.getByRole("dialog", { name: "伙伴已创建" }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("textbox", { name: "备注", exact: true }).inputValue(),
    "林间",
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("dialog", { name: "伙伴已创建" }).waitFor();
  await shot("created-note");
  await page.getByRole("button", { name: "查看 TA 的资料" }).click();
  await page.getByRole("heading", { name: "林间", exact: true }).waitFor();
  await shot("custom-profile");
  await page.getByRole("button", { name: "和 TA 聊聊", exact: true }).click();
  await page.getByRole("textbox", { name: "消息", exact: true }).fill("你好");
  await page.getByRole("button", { name: "发送消息" }).click();
  await page
    .getByText("看看 TA 的想法", { exact: true })
    .waitFor({ timeout: 55000 });
  await shot("cloud-closed");
  await page.getByText("看看 TA 的想法", { exact: true }).click();
  await shot("cloud-open");
  assert.match(
    await page
      .locator(".thought")
      .evaluate((e) => getComputedStyle(e, "::before").backgroundImage),
    /v3-thought-cloud/,
  );
  await saved();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page
    .locator(".conversation-row")
    .filter({ hasText: "林间" })
    .click({ button: "right" });
  await shot("context-menu");
  await page.getByRole("menuitem", { name: "置顶", exact: true }).click();
  await saved();
  assert.equal(await page.locator(".conversation-row.is-pinned").count(), 1);
  await page.reload();
  await page.locator(".conversation-row.is-pinned").waitFor();
  const held = page.locator(".conversation-row").filter({ hasText: "林间" });
  await held.dispatchEvent("pointerdown", { pointerType: "touch" });
  await page.waitForTimeout(650);
  await held.dispatchEvent("pointerup", { pointerType: "touch" });
  await page.getByRole("menuitem", { name: "删除聊天" }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator(".conversation-row").count(), 0);
  await page.getByRole("button", { name: "添加伙伴" }).click();
  await shot("add-menu");
  await page.keyboard.press("Escape");
  const doc = await (await fetch(url + "/api/state")).json();
  assert.equal(doc.state.customCharacters.length, 1);
  assert.ok(
    doc.state.customCharacters[0].avatar.startsWith("data:image/jpeg;"),
  );
  const custom = doc.state.customCharacters[0];
  assert.ok(doc.state.hiddenChats.includes(custom.id));
  assert.ok(doc.state.chats[custom.id].some((m) => m.role === "user"));
  assert.equal(doc.state.onboardingComplete, true);
  const nav = (label) =>
    page
      .getByRole("navigation")
      .getByRole("button", { name: label, exact: true })
      .click();
  await nav("发现");
  await page.locator(".discover-list.with-planet").waitFor();
  await page.locator(".discover-card").filter({ hasText: "林间" }).click();
  await page.getByRole("button", { name: "和 TA 聊聊", exact: true }).click();
  await page.getByText("看看 TA 的想法", { exact: true }).waitFor();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await saved();
  assert.equal(
    await page.locator(".conversation-row").filter({ hasText: "林间" }).count(),
    1,
  );
  await nav("发现");
  await page.locator(".discover-list").evaluate((e) => {
    e.scrollTop = 100;
    e.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.locator(".discover-list:not(.with-planet)").waitFor();
  await page.locator(".discover-list").evaluate((e) => {
    e.scrollTop = 180;
  });
  await nav("发现");
  await page.locator(".discover-list.with-planet").waitFor();
  assert.equal(
    await page.locator(".discover-list").evaluate((e) => e.scrollTop),
    0,
  );
  await nav("社区");
  await nav("发现");
  await page.locator(".discover-list.with-planet").waitFor();
  for (const width of [320, 375, 402, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  const star = page.getByRole("button", { name: "认识春念久", exact: true });
  await star.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "个人资料" }).waitFor();
  const invalid = await fetch(url + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      person: "custom-missing",
      task: "chat",
      messages: [{ role: "user", content: "你好" }],
    }),
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: new-user selection, required fields, creation/save/note/profile/custom chat, cloud bubbles, pin/delete persistence, default planet, keyboard/reduced motion, widths, unknown custom rejection.",
  );
} finally {
  await browser.close();
}
