/** Deterministic HTTP RPC boundary and real DOM journeys; no live wallet service. */
import assert from "node:assert/strict";
import { Account, TransactionBuilder, xdr } from "@stellar/stellar-sdk/base";

export function createReactRpcFixture() {
  const requests = new Map();
  const address = "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO";
  const envelopeXdr = new TransactionBuilder(new Account(address, "1"), {
    fee: "100",
    networkPassphrase: "browser-fixture",
  }).setTimeout(0).build().toXDR();
  return {
    count: (hash) => requests.get(hash.repeat(64)) ?? 0,
    reset: () => requests.clear(),
    async respond(request, response) {
      let body = "";
      for await (const chunk of request) body += chunk;
      const { id, method, params } = JSON.parse(body);
      assert.equal(
        method,
        "getTransaction",
        "Only read RPCs are allowed in this browser fixture",
      );
      const hash = params.hash;
      const calls = (requests.get(hash) ?? 0) + 1;
      requests.set(hash, calls);
      if (hash.startsWith("b") && calls === 1) {
        response.writeHead(503, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "temporary fixture failure" }));
        return;
      }
      const status = calls > 1 && hash.startsWith("c")
        ? "SUCCESS"
        : calls > 1 && hash.startsWith("d")
        ? "FAILED"
        : "NOT_FOUND";
      const result = {
        status,
        latestLedger: 10,
        latestLedgerCloseTime: 1,
        oldestLedger: 1,
        oldestLedgerCloseTime: 1,
      };
      if (status !== "NOT_FOUND") {
        Object.assign(result, {
          ledger: 9,
          createdAt: 1,
          applicationOrder: 1,
          feeBump: false,
          envelopeXdr,
          resultMetaXdr: xdr.TransactionMeta.operations([]).toXdr("base64"),
          resultXdr: new xdr.TransactionResult({
            feeCharged: 100n,
            result: status === "SUCCESS"
              ? xdr.TransactionResultResult.txSuccess([])
              : xdr.TransactionResultResult.txFailed([]),
            ext: xdr.TransactionResultExt.v0(),
          }).toXdr("base64"),
        });
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
    },
  };
}

export async function checkReactBrowser(page, rpc) {
  page.setDefaultTimeout(10_000);
  const app = page.locator("#react-browser-fixture");
  const click = (name) =>
    app.getByRole("button", { name, exact: true }).click();
  const text = async (name, expected) => {
    await page.waitForFunction(
      ({ name, expected }) =>
        document.querySelector(`#react-browser-fixture [data-testid="${name}"]`)
          ?.textContent === expected,
      { name, expected },
    );
  };
  const control = (method) =>
    page.evaluate((name) => globalThis.colibriReactFixture[name](), method);
  const counts = () => control("counts");
  await app.getByRole("button", { name: "Connect", exact: true }).waitFor();
  assert.deepEqual(await counts(), {
    connectCalls: 0,
    signCalls: 0,
    subscriptions: 0,
  });
  assert.equal(
    rpc.count("b"),
    0,
    "Undefined inputs must stay idle under StrictMode",
  );

  await click("Connect");
  await text("connection", "connecting:");
  assert.equal(
    await app.getByRole("button", { name: "Connect", exact: true })
      .isDisabled(),
    true,
  );
  await control("reject");
  await text("connection", "disconnected:");
  await app.getByRole("alert").filter({ hasText: "User rejected connection" })
    .waitFor();
  await click("Connect");
  await control("approve");
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="connection"]')?.textContent
      .startsWith("connected:")
  );
  assert.equal(
    (await counts()).subscriptions,
    1,
    "StrictMode must not duplicate wallet subscriptions",
  );
  await click("Authenticate");
  await text("session", "authenticating");
  await page.waitForFunction(() =>
    globalThis.colibriReactFixture.authCounts().challengePrompts === 1
  );
  assert.equal((await control("authCounts")).tokenExchanges, 0);
  await control("approveChallenge");
  await text("session", "authenticated");
  assert.equal((await control("authCounts")).tokenExchanges, 1);
  assert.equal(
    await control("credentialsStayPrivate"),
    true,
    "Credentials must stay out of DOM, dehydrated caches and browser storage",
  );

  await control("logout");
  await click("Authenticate");
  await text("session", "authenticating");
  await page.waitForFunction(() =>
    globalThis.colibriReactFixture.authCounts().challengePrompts === 2
  );
  await control("rejectChallenge");
  await text("session", "anonymous");
  await app.getByRole("alert").filter({ hasText: "Could not sign" }).waitFor();
  assert.equal((await control("authCounts")).tokenExchanges, 1);
  await click("Authenticate");
  await text("session", "authenticating");
  await page.waitForFunction(() =>
    globalThis.colibriReactFixture.authCounts().challengePrompts === 3
  );
  await click("Disconnect");
  await control("approveChallenge");
  await text("session", "anonymous");
  await app.getByRole("alert").filter({ hasText: "session changed" }).waitFor();
  assert.equal((await control("authCounts")).tokenExchanges, 1);
  await click("Connect");
  await control("approve");
  await page.waitForFunction(() =>
    globalThis.colibriReactFixture.counts().subscriptions === 1
  );

  await click("Sign message");
  await text("message", "pending:0");
  await control("rejectMessage");
  await text("message", "error:0");
  await page.waitForTimeout(1100);
  assert.equal(
    (await counts()).signCalls,
    1,
    "Signing must ignore global mutation retries",
  );
  await click("Sign message");
  await text("message", "pending:0");
  await click("Disconnect");
  await text("session", "anonymous");
  await control("approveMessage");
  await text("message", "error:0");
  assert.equal((await counts()).subscriptions, 0);
  await click("Connect");
  await control("approve");
  await page.waitForFunction(() =>
    globalThis.colibriReactFixture.counts().subscriptions === 1
  );
  await control("disconnectNotification");
  await text("connection", "disconnected:");
  assert.equal((await counts()).subscriptions, 0);
  const explicitConnections = (await counts()).connectCalls;
  await page.waitForTimeout(100);
  await text("connection", "disconnected:");
  assert.equal((await counts()).connectCalls, explicitConnections);
  await click("Connect");
  await control("approve");
  await page.waitForFunction(() =>
    globalThis.colibriReactFixture.counts().subscriptions === 1
  );
  await control("changeNetwork");
  await text("connection", "disconnected:");
  assert.equal((await counts()).subscriptions, 0);
  console.log(
    "React browser: StrictMode, connection rejection, stale signatures, explicit signing and network changes passed.",
  );

  await click("Enable reads");
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-testid^="read-"] output')].every((
      node,
    ) => node.textContent === "error:idle:")
  );
  assert.equal(
    rpc.count("b"),
    1,
    "Two observers must share one request and its failure",
  );
  await click("Refresh read-one");
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-testid^="read-"] output')].every((
      node,
    ) => node.textContent === "success:idle:NOT_FOUND")
  );
  assert.equal(rpc.count("b"), 2);
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/react-rpc")),
    click("Change provider"),
  ]);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-testid^="read-"] output')].every((
      node,
    ) => node.textContent === "success:idle:NOT_FOUND")
  );
  assert.equal(
    rpc.count("b"),
    3,
    "Providers must not reuse each other's cache",
  );
  console.log(
    "React browser: HTTP RPC errors, manual recovery, shared reads and provider cache isolation passed.",
  );

  for (
    const [button, hash, status] of [["Track success", "c", "SUCCESS"], [
      "Track failure",
      "d",
      "FAILED",
    ]]
  ) {
    await click(button);
    await text("transaction", "NOT_FOUND");
    await text("transaction", status);
    assert.equal(rpc.count(hash), 2);
    await page.waitForTimeout(1100);
    assert.equal(rpc.count(hash), 2, "Terminal transaction polling must stop");
  }
  await click("Track pending");
  await text("transaction", "NOT_FOUND");
  await control("unmount");
  const pendingCalls = rpc.count("a");
  await page.waitForTimeout(1100);
  assert.equal(rpc.count("a"), pendingCalls, "Unmount must stop polling");
  assert.equal((await counts()).subscriptions, 0);
  assert.equal(await app.locator("button").count(), 0);
  console.log(
    "React browser: transaction polling stops at SUCCESS/FAILED and cleanup stops pending polling passed.",
  );
}
