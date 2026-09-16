import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { legacyUser } from "./legacy-user.mjs";
const url = process.env.TEST_URL;
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROME_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
    : {},
);
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 1040 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await legacyUser(page);
  await page.locator(".welcome-art.ready").waitFor();
  assert.ok(
    await page.locator(".welcome-art img").evaluate((e) => e.naturalWidth > 0),
  );
  await page
    .locator(".app-shell")
    .screenshot({ path: "test-results/v2-welcome-soft.png" });
  await page.getByRole("button", { name: "微信一键登录" }).click();
  await page.getByRole("heading", { name: "Life gift" }).waitFor();
  await page.locator('[data-save-state="saved"]').waitFor();
  await page.reload();
  const nav = (label) =>
    page
      .getByRole("navigation")
      .getByRole("button", { name: label, exact: true })
      .click();
  const saved = () => page.locator('[data-save-state="saved"]').waitFor();
  const shot = async (name) => {
    await page.waitForTimeout(300);
    await page
      .locator(".app-shell")
      .screenshot({ path: `test-results/v2-${name}.png` });
  };
  await nav("社区");
  await page.getByRole("tab", { name: "广场", exact: true }).click();
  await page.getByText("接受自己的不完美", { exact: true }).waitFor();
  await shot("square");
  const post = page.locator('[data-post-id="square-v2-1"]');
  await post.getByRole("button", { name: "点赞", exact: true }).click();
  await saved();
  await post.getByRole("button", { name: "评论", exact: true }).click();
  await page.getByRole("dialog", { name: "写评论" }).waitFor();
  await shot("comment");
  const comment = "我也开始接受自己的小小不完美。";
  await page.getByRole("textbox", { name: "评论内容" }).fill(comment);
  await page.keyboard.press("Escape");
  await post.getByRole("button", { name: "评论", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "评论内容" }).inputValue(),
    comment,
  );
  await page.getByRole("button", { name: "发表", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await post.getByText(comment, { exact: false }).waitFor();
  await page.getByRole("tab", { name: "朋友圈", exact: true }).click();
  await shot("friends");
  assert.equal(await page.getByText(comment, { exact: false }).count(), 0);
  await page.getByRole("button", { name: "发布日常", exact: true }).click();
  await page
    .getByRole("textbox", { name: "编辑内容" })
    .fill("只留在我的朋友圈。");
  await page
    .getByRole("button", { name: "发布日常", exact: true })
    .last()
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("tab", { name: "广场", exact: true }).click();
  assert.equal(
    await page.getByText("只留在我的朋友圈。", { exact: true }).count(),
    0,
  );
  await nav("发现");
  const matching = await page.evaluate(async () => {
    const { rankCharacters } = await import("/src/community-data.js");
    const { exploreCharacters } =
      await import("/shared/explore-characters.mjs");
    return rankCharacters(
      {
        chats: { wen: [{ role: "user", text: "项目工作完成后很累，想休息" }] },
        memories: {},
        posts: [],
      },
      exploreCharacters,
    )[0].id;
  });
  assert.equal(matching, "xinan");
  await page.locator(".discover-list.with-planet").waitFor();
  assert.equal(await page.locator(".planet-star").count(), 22);
  await shot("planet");
  for (const [name, label] of [
    ["春念久", "yellow"],
    ["李小白", "pink"],
    ["心安", "teal"],
    ["我不是海洋", "blue"],
  ]) {
    const star = page.getByRole("button", { name: "认识" + name, exact: true });
    const color = await star
      .locator(".star-light")
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    await star.focus();
    await page.keyboard.press("Enter");
    await page.locator(".phase-traits").waitFor();
    const glow = await page.locator(".encounter-haze").evaluate((e) => ({
      color: getComputedStyle(e).backgroundColor,
      mask: getComputedStyle(e).maskImage,
      height: e.getBoundingClientRect().height,
    }));
    assert.equal(glow.color, color, `${name}: glow matches selected star`);
    assert.match(glow.mask, /v2-reveal-imgEllipse6\.svg/);
    assert.ok(glow.height > 0);
    assert.equal(
      await page
        .locator(".encounter-source")
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      color,
    );
    await page.waitForTimeout(850);
    await shot("traits-" + label);
    await page.getByRole("button", { name: "返回星球", exact: true }).click();
  }
  await page.getByRole("button", { name: "认识春念久", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page
      .locator(".encounter button")
      .first()
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.locator(".phase-traits").waitFor();
  await page.waitForTimeout(850);
  await shot("traits");
  await page.getByRole("heading", { name: "个人资料", exact: true }).waitFor();
  await page.getByRole("heading", { name: "春念久", exact: true }).waitFor();
  await shot("profile");
  await page.getByRole("button", { name: "和 TA 聊聊", exact: true }).click();
  await page
    .getByRole("textbox", { name: "消息", exact: true })
    .fill("喜欢听音乐");
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  await page
    .locator(".typing-row")
    .waitFor({ state: "hidden", timeout: 55000 });
  await saved();
  const doc = await (await fetch(url + "/api/state")).json();
  assert.ok(doc.state.chats.chun.some((m) => m.role === "user"));
  assert.ok(doc.state.contacts.includes("chun"));
  assert.ok(
    doc.state.posts
      .find((p) => p.id === "square-v2-1")
      .comments.some((c) => c.text === comment),
  );
  assert.ok(
    doc.state.posts.find((p) => p.text === "只留在我的朋友圈。").scope ===
      "friends",
  );
  const other = await browser.newPage();
  await other.goto(url);
  await other
    .getByRole("navigation")
    .getByRole("button", { name: "社区", exact: true })
    .click();
  await other.getByText("只留在我的朋友圈。", { exact: true }).waitFor();
  await other.getByRole("tab", { name: "广场", exact: true }).click();
  await other.getByText(comment, { exact: false }).waitFor();
  await other.close();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await nav("发现");
  await page.getByRole("button", { name: "认识木鱼", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "返回星球", exact: true }).click();
  await page.waitForTimeout(3800);
  assert.equal(
    await page.getByRole("heading", { name: "个人资料" }).count(),
    0,
  );
  for (const width of [320, 375, 402, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await nav("社区");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await nav("发现");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".discover-list.with-planet").waitFor();
  await page.waitForTimeout(650);
  await page
    .getByRole("button", { name: "认识春念久", exact: true })
    .evaluate((e) => e.focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "个人资料" }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: community scopes, saved like/comment/post, new browser restore, 22 AI stars, zoom/traits/profile, new-role chat, cancel cleanup, responsive + reduced motion.",
  );
} finally {
  await browser.close();
}
