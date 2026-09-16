// Figma 22–41 visual contract. Always use an isolated demo store, never user data.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { legacyUser } from "./legacy-user.mjs";

const url = process.env.TEST_URL;
assert.equal(url, "http://localhost:5188", "Use npm run test:visual");
assert.equal(
  (await (await fetch(url + "/api/status")).json()).configured,
  false,
);
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROME_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
    : {},
);
await mkdir("test-results", { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 1040 },
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const shot = async (frame) => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() =>
      [...document.images].every((img) => img.complete),
    );
    await page
      .locator(".app-shell")
      .screenshot({ path: `test-results/v4-${frame}.png` });
  };
  const nav = (name) =>
    page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
  const back = () =>
    page.getByRole("button", { name: "返回", exact: true }).click();
  await page.goto(url);
  await legacyUser(page);
  await shot("27-welcome");
  await page.getByRole("button", { name: "微信一键登录" }).click();
  await expect(page.getByRole("heading", { name: "Life gift" })).toBeVisible();
  await shot("23-life-gift");
  await page.getByRole("button", { name: "选择角色", exact: true }).click();
  await expect(page.locator(".discover-list.with-planet")).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await shot("32-first-discovery");
  await back();
  await page.getByRole("button", { name: "创建 AI 伙伴", exact: true }).click();
  await shot("36-create");
  // Fixed, public demo conversation gives reproducible geometry, without an API request.
  await page.evaluate(async () => {
    const doc = await (await fetch("/api/state")).json();
    const time = Date.now();
    doc.state.chats.wen = [
      {
        id: "visual-opening",
        role: "assistant",
        text: "（联赛决赛结束，全场都在喊江澈的名字。他摘下耳机，没有先去接采访，而是穿过人群走到你面前。）",
        time,
        opening: true,
      },
      { id: "visual-user", role: "user", text: "你好", time },
      ...["🧣（把外套递给你）", "你好什么", "别站门口，进来"].map(
        (text, i) => ({
          id: `visual-reply-${i}`,
          role: "assistant",
          text,
          time,
          ...(i === 2
            ? {
                innerVoice:
                  "刚分开两小时又和我装客气，是紧张还是故意的……算了，外套给你拿了，还站门口",
              }
            : {}),
        }),
      ),
    ];
    const res = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: doc.revision, state: doc.state }),
    });
    if (!res.ok) throw new Error("Visual fixture save failed");
  });
  await page.reload();
  await expect(page.locator(".conversation-row")).toHaveCount(4);
  await shot("22-conversations");
  await page.locator(".conversation-row").filter({ hasText: "文牧野" }).click();
  await expect(page.locator(".screen-chat")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".bubble").first()).toHaveCSS(
    "background-color",
    "rgb(245, 245, 245)",
  );
  await expect(page.locator(".thought")).toHaveCSS("height", "40px");
  const cloudBox = await page.locator(".thought").boundingBox();
  assert.ok(
    cloudBox.width >= 140 && cloudBox.width <= 152,
    "compact Figma cloud width",
  );
  await shot("29-cloud-closed");
  const input = page.getByRole("textbox", { name: "消息", exact: true });
  await input.focus();
  await expect(page.locator(".composer")).toHaveCSS(
    "border-color",
    "rgb(218, 255, 163)",
  );
  await expect(input).toHaveCSS("outline-style", "none");
  await expect(input).toHaveCSS("box-shadow", "none");
  await shot("41-composer-focus");
  await page.getByRole("button", { name: "看看 TA 的想法" }).click();
  await expect(page.locator(".composer")).toHaveCSS(
    "border-color",
    "rgb(245, 255, 230)",
  );
  await expect(page.locator(".thought")).toHaveCSS("width", "316px");
  await shot("30-cloud-open");
  await page.getByRole("button", { name: "聊天设置", exact: true }).click();
  await shot("37-settings");
  await page.getByRole("button", { name: "与他的记忆", exact: true }).click();
  await shot("38-memory");
  await back();
  await back();
  await page.getByRole("button", { name: "文牧野的资料" }).first().click();
  await shot("35-profile");
  await back();
  await back();
  await nav("社区");
  await page.getByRole("tab", { name: "广场", exact: true }).click();
  await shot("24-square");
  await page.getByRole("button", { name: "评论", exact: true }).first().click();
  await shot("40-comment");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "朋友圈", exact: true }).click();
  await shot("26-friends");
  await nav("发现");
  await shot("33-planet");
  await page.locator(".discover-list").evaluate((el) => {
    el.scrollTop = 100;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect(page.locator(".discover-list:not(.with-planet)")).toBeVisible();
  await page.locator(".discover-list").evaluate((el) => {
    el.scrollTop = 0;
  });
  await shot("31-discovery-list");
  // Check the chat and focus state at narrow phone widths as well as desktop.
  await nav("对话");
  await page.locator(".conversation-row").filter({ hasText: "文牧野" }).click();
  for (const width of [320, 375, 402, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await input.focus();
    assert.ok(
      await page
        .locator(".chat-scroll")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await expect(page.locator(".composer")).toHaveCSS(
      "border-color",
      "rgb(218, 255, 163)",
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Figma v4 screen captures, white/grey tokens, 40px cloud, capsule focus/blur, and five responsive widths; no API calls.",
  );
} finally {
  await browser.close();
}
