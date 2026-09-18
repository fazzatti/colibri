import { assertEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { defaultClassName } from "@/cli/naming.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("bindings CLI class names", () => {
  it("uses the local filename in PascalCase without guessing from ABI members", () => {
    for (
      const [path, name] of [
        ["./my_token.wasm", "MyToken"],
        ["/a folder/token-client.WASM", "TokenClient"],
        ["C:\\contracts\\my_token.wasm", "MyToken"],
        ["TokenClient.wasm", "TokenClient"],
      ]
    ) assertEquals(defaultClassName(path), name);
  });
  it("falls back for remote sources and unusable or reserved filenames", () => {
    for (
      const path of [
        undefined,
        "",
        ".wasm",
        "123.wasm",
        "contract.wasm",
        "spec.wasm",
        "ColibriError.wasm",
        "object.wasm",
        "promise.wasm",
        "map.wasm",
        "contract-id.wasm",
        "soroban-type.wasm",
      ]
    ) {
      assertEquals(defaultClassName(path), "ContractClient");
    }
  });
});
