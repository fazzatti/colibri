import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { WebAuthCode, WebAuthError } from "@/error.ts";
import { WebAuthTransport } from "@/transport.ts";

describe("WebAuth response body boundary", () => {
  for (const protocol of ["sep10", "sep45"] as const) {
    it(`keeps the ${protocol} deadline active after receiving headers`, async () => {
      let cancelled = false;
      let bodyTimer: number | undefined;
      const server = Deno.serve({
        port: 0,
        hostname: "127.0.0.1",
        onListen() {},
      }, () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("{"));
              bodyTimer = setTimeout(() => controller.close(), 1000);
            },
            cancel() {
              cancelled = true;
              clearTimeout(bodyTimer);
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ));
      try {
        const error = await assertRejects(
          () =>
            new WebAuthTransport({ timeout: 100 }).get(
              `http://127.0.0.1:${server.addr.port}`,
              new URLSearchParams(),
              protocol,
            ),
          WebAuthError,
        );
        assertEquals(error.code, WebAuthCode.TIMEOUT);
        assertEquals(error.meta?.protocol, protocol);
      } finally {
        clearTimeout(bodyTimer);
        await server.shutdown();
      }
      assertEquals(cancelled, true);
    });
  }

  it("wraps a disconnected response body in a distinct Colibri error", async () => {
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const serve = (async () => {
      const connection = await listener.accept();
      try {
        await connection.read(new Uint8Array(4096));
        await connection.write(new TextEncoder().encode(
          "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{",
        ));
      } finally {
        connection.close();
      }
    })();
    try {
      const error = await assertRejects(() =>
        new WebAuthTransport().get(
          `http://127.0.0.1:${(listener.addr as Deno.NetAddr).port}`,
          new URLSearchParams(),
          "sep10",
        ), WebAuthError);
      assertEquals(error.code, "WEBAUTH_RESPONSE_BODY_FAILED");
    } finally {
      await serve;
      listener.close();
    }
  });
});
