import { assertEquals } from "@std/assert";
import { normalizeBinaryData } from "@/common/helpers/binary.ts";

Deno.test("normalizeBinaryData preserves Uint8Array bytes", () => {
  const bytes = new Uint8Array([1, 2, 3]);

  const normalized = normalizeBinaryData(bytes);

  assertEquals([...normalized], [1, 2, 3]);
});

Deno.test("normalizeBinaryData preserves ArrayBuffer bytes", () => {
  const bytes = new Uint8Array([4, 5, 6]);

  const normalized = normalizeBinaryData(bytes.buffer);

  assertEquals([...normalized], [4, 5, 6]);
});

Deno.test("normalizeBinaryData respects typed array byte offsets", () => {
  const bytes = new Uint8Array([0, 7, 8, 9, 0]).subarray(1, 4);

  const normalized = normalizeBinaryData(bytes);

  assertEquals([...normalized], [7, 8, 9]);
});

Deno.test("normalizeBinaryData accepts DataView inputs", () => {
  const bytes = new Uint8Array([0, 10, 11, 12, 0]);
  const view = new DataView(bytes.buffer, 1, 3);

  const normalized = normalizeBinaryData(view);

  assertEquals([...normalized], [10, 11, 12]);
});
