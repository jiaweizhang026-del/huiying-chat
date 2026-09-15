import { chromium } from "@playwright/test";
import { utimes } from "node:fs/promises";
import assert from "node:assert/strict";
import { legacyUser } from "./legacy-user.mjs";
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROME_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
    : {},
);
try {
  const page = await browser.newPage();
  await page.goto(process.env.TEST_URL || "http://localhost:5178");
  await legacyUser(page);
  await page.getByText("微信一键登录", { exact: true }).click();
  await page.getByRole("button", { name: "文牧野" }).click();
  await page
    .getByRole("textbox", { name: "消息", exact: true })
    .fill("热更新后仍然保留的草稿");
  await page.evaluate(() => (window.__HMR_TEST_SENTINEL__ = "preserved"));
  for (const file of ["src/styles.css", "src/App.jsx"]) {
    const updated = page.waitForEvent("console", {
      predicate: (m) =>
        m.text().includes("hot updated:") && m.text().includes(file),
      timeout: 10000,
    });
    const now = new Date();
    await utimes(file, now, now);
    await updated;
    await page.waitForTimeout(350);
    assert.equal(
      await page.evaluate(() => window.__HMR_TEST_SENTINEL__),
      "preserved",
      "HMR should not reload the document",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "消息", exact: true })
        .inputValue(),
      "热更新后仍然保留的草稿",
    );
  }
  console.log(
    "PASS: CSS and React Fast Refresh update in place, retaining chat route and draft.",
  );
} finally {
  await browser.close();
}
