// Existing-user regression fixture: preserve the original four conversations.
export async function legacyUser(page) {
  await page.getByText("微信一键登录", { exact: true }).waitFor();
  await page.evaluate(async () => {
    const doc = await (await fetch("/api/state")).json();
    const state = { ...doc.state, contacts: ["shen", "wen", "jiang", "gu"] };
    delete state.onboardingComplete;
    const res = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: doc.revision, state }),
    });
    if (!res.ok) throw new Error("Legacy fixture save failed");
  });
  await page.reload();
}
