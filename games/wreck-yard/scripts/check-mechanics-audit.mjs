import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  await page.goto(
    process.env.AUDIT_URL ??
      "http://127.0.0.1:4402/scripts/mechanics-audit.html",
  );
  await page.waitForFunction(() => window.mechanicsAudit?.ready());
  const ids = process.argv.slice(2).length
    ? process.argv.slice(2)
    : await page.evaluate(() => window.mechanicsAudit.ids);
  for (const id of ids) {
    const result = await page.evaluate((id) => {
      const { total } = window.mechanicsAudit.setup(id);
      for (let i = 0; i < total; i++) window.mechanicsAudit.step(false);
      return window.mechanicsAudit.results();
    }, id);
    console.log(
      JSON.stringify({
        id,
        checks: result.checks,
        first: result.history[0],
        last: result.history.at(-1),
      }),
    );
    if (!result.passed) process.exitCode = 1;
  }
} finally {
  await browser.close();
}
