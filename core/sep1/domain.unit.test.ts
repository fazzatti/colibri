import { assertEquals, assertRejects } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { StellarToml } from "@/sep1/index.ts";
import * as ERROR from "@/sep1/error.ts";
const { describe, it } = recordColibriTests(import.meta.url);
describe("stellar.toml host boundary", () => {
  it("rejects malformed hosts before invoking injected fetch", async () => {
    let requests = 0;
    const fetchFn: typeof fetch = () => {
      requests++;
      return Promise.resolve(new Response('VERSION="2.0.0"'));
    };
    for (
      const host of [
        "",
        "good.example@other.example",
        "example.com/path",
        "example.com?query",
        "example.com#fragment",
        "https://example.com",
        "example.com\\path",
        "example.com%2fpath",
        "example.com\n",
        "localhost.evil/path",
        "localhost@evil.example",
        "example..com",
        "-bad.example",
        "host_name.example",
        "example.com:",
        "example.com:65536",
        "[::1",
        "127.1",
        "0177.0.0.1",
      ]
    ) {
      await assertRejects(
        () => StellarToml.fromDomain(host, { fetchFn }),
        ERROR.INVALID_DOMAIN,
      );
    }
    assertEquals(requests, 0);
  });
  it("retains DNS, IDNA, optional ports, trailing slashes and explicit local HTTP", async () => {
    for (
      const [host, expected, allowHttp] of [
        [
          "example.com///",
          "https://example.com/.well-known/stellar.toml",
          false,
        ],
        [
          "localhost:8000",
          "http://localhost:8000/.well-known/stellar.toml",
          true,
        ],
        ["[::1]:8000", "http://[::1]:8000/.well-known/stellar.toml", true],
        [
          "127.0.0.1:8000",
          "http://127.0.0.1:8000/.well-known/stellar.toml",
          true,
        ],
        [
          "bücher.example",
          "https://xn--bcher-kva.example/.well-known/stellar.toml",
          false,
        ],
        [
          "example.com:8443",
          "https://example.com:8443/.well-known/stellar.toml",
          false,
        ],
      ] as const
    ) {
      let requested = "";
      await StellarToml.fromDomain(host, {
        allowHttp,
        fetchFn: (url) => {
          requested = String(url);
          return Promise.resolve(new Response('VERSION="2.0.0"'));
        },
      });
      assertEquals(requested, expected);
    }
  });
});
