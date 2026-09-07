import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { compareApis, normalizeDeclaration } from "./api-model.ts";

describe("public API snapshots", () => {
  it("omits machine locations and documentation but retains the complete type structure", () => {
    assertEquals(
      normalizeDeclaration({
        location: { filename: "file:///tmp/one.ts" },
        jsDoc: { doc: "Text" },
        def: {
          params: [{
            name: "input",
            type: "Transaction",
            optional: false,
            resolution: { url: "file:///tmp" },
          }],
          returnType: null,
          typeParams: ["T"],
          readonly: true,
        },
      }),
      {
        def: {
          params: [{ name: "input", optional: false, type: "Transaction" }],
          readonly: true,
          returnType: null,
          typeParams: ["T"],
        },
      },
    );
  });
  it("reports additions, removals and signature changes without claiming assignability", () => {
    assertEquals(
      compareApis({
        core: { Gone: 1, Same: 2, Changed: 3 },
        removed: { All: 1 },
      }, { core: { Same: 2, Changed: 4, New: 5 }, added: { All: 1 } }),
      [
        { entrypoint: "added", symbol: "All", kind: "added" },
        { entrypoint: "core", symbol: "Changed", kind: "changed" },
        { entrypoint: "core", symbol: "Gone", kind: "removed" },
        { entrypoint: "core", symbol: "New", kind: "added" },
        { entrypoint: "removed", symbol: "All", kind: "removed" },
      ],
    );
    assertEquals(compareApis({}, {}), []);
  });
});
