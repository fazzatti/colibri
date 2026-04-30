import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { normalizeBinaryData } from "@/common/helpers/binary.ts";

describe("normalizeBinaryData", () => {
  it("preserves Uint8Array bytes", () => {
    const bytes = new Uint8Array([1, 2, 3]);

    const normalized = normalizeBinaryData(bytes);

    assertEquals([...normalized], [1, 2, 3]);
  });

  it("preserves ArrayBuffer bytes", () => {
    const bytes = new Uint8Array([4, 5, 6]);

    const normalized = normalizeBinaryData(bytes.buffer);

    assertEquals([...normalized], [4, 5, 6]);
  });

  it("respects typed array byte offsets", () => {
    const bytes = new Uint8Array([0, 7, 8, 9, 0]).subarray(1, 4);

    const normalized = normalizeBinaryData(bytes);

    assertEquals([...normalized], [7, 8, 9]);
  });

  it("accepts DataView inputs", () => {
    const bytes = new Uint8Array([0, 10, 11, 12, 0]);
    const view = new DataView(bytes.buffer, 1, 3);

    const normalized = normalizeBinaryData(view);

    assertEquals([...normalized], [10, 11, 12]);
  });

  it("returns a defensive copy for typed array inputs", () => {
    const bytes = new Uint8Array([13, 14, 15]);

    const normalized = normalizeBinaryData(bytes);
    bytes[0] = 99;

    assertEquals([...normalized], [13, 14, 15]);
  });

  it("returns a defensive copy for ArrayBuffer inputs", () => {
    const bytes = new Uint8Array([16, 17, 18]);

    const normalized = normalizeBinaryData(bytes.buffer);
    bytes[0] = 99;

    assertEquals([...normalized], [16, 17, 18]);
  });
});
