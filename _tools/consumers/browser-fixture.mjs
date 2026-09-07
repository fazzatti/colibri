/** Run one real browser fixture, failing on page errors instead of a timeout. */
export async function runBrowserFixture(browser, url, timeout = 30_000) {
  const page = await browser.newPage();
  const errors = [];
  // Resolve this signal instead of rejecting it: an error during navigation
  // must never create an unhandled rejection before the race is attached.
  const failed = new Promise((resolve) => {
    page.on("pageerror", (error) => {
      errors.push(error);
      console.error(error);
      resolve();
    });
  });
  page.on("requestfailed", (request) => {
    console.error(`${request.url()}: ${request.failure()?.errorText}`);
  });
  page.on("console", (message) => console.log(message.text()));

  try {
    const completed = (async () => {
      await page.goto(url, { waitUntil: "commit", timeout });
      // Document load alone is not success for asynchronous SDK operations.
      await page.waitForFunction(
        "globalThis.colibriPassed === true",
        undefined,
        { timeout },
      );
    })();
    await Promise.race([completed, failed]);
    if (errors.length) {
      throw new AggregateError(errors, "Browser consumer failed");
    }
  } finally {
    // Closing the owned page/context also stops the losing navigation or poll.
    await page.close();
  }
}
