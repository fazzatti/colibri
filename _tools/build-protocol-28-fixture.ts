/** Reproduce Rust SDK 28 sparse/dense events, Wasm and generated bindings. */
import {
  generateBindings,
  loadBindingSource,
} from "@colibri/contract-bindings";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const manifest = "_internal/contracts/protocol-28-compatibility/Cargo.toml";
const check = Deno.args.includes("--check");
const run = async (exe: string, args: string[]): Promise<string> => {
  const result = await new Deno.Command(exe, {
    args,
    cwd: root,
    stderr: "inherit",
  }).output();
  if (!result.success) throw new Error(`${exe} ${args.join(" ")} failed`);
  return new TextDecoder().decode(result.stdout);
};
if (!(await run("stellar", ["--version"])).includes("stellar 26.1.0")) {
  throw new Error("Use Stellar CLI 26.1.0 for the pinned fixture.");
}
if (!(await run("rustc", ["--version"])).startsWith("rustc 1.96.0")) {
  throw new Error("Use Rust 1.96.0 for the pinned fixture.");
}
const directory = await Deno.makeTempDir({ prefix: "colibri-protocol-28-" });
const write = async (path: string, contents: Uint8Array | string) => {
  const expected = typeof contents === "string"
    ? new TextEncoder().encode(contents)
    : contents;
  const url = new URL(path, root);
  if (check) {
    const actual = await Deno.readFile(url);
    if (
      actual.length !== expected.length ||
      actual.some((byte, i) => byte !== expected[i])
    ) {
      throw new Error(`Stale protocol-28 fixture: ${path}`);
    }
  } else {
    await Deno.mkdir(new URL("./", url), { recursive: true });
    await Deno.writeFile(url, expected);
  }
};
try {
  await run("stellar", [
    "contract",
    "build",
    "--manifest-path",
    manifest,
    "--locked",
    "--out-dir",
    directory,
  ]);
  const wasm = await Deno.readFile(
    join(directory, "protocol_28_compatibility_contract.wasm"),
  );
  const output = await run("cargo", [
    "test",
    "--manifest-path",
    manifest,
    "--locked",
    "--",
    "--nocapture",
  ]);
  const events = [
    ...output.matchAll(/^COLIBRI_EVENT ([0-9a-f]+) ([0-9a-f]+)$/gm),
  ]
    .map(([, topics, data]) => ({ topics, data }));
  if (events.length !== 6) {
    throw new Error("Expected six Rust-generated wire events.");
  }
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", wasm)),
  )
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  await write(
    "_internal/tests/compiled-contracts/protocol_28_compatibility_contract.wasm",
    wasm,
  );
  await write(
    "_internal/tests/protocol-28-events.json",
    JSON.stringify(
      {
        rust: "1.96.0",
        stellarCli: "26.1.0",
        sorobanSdk: "28.0.0",
        wasmSha256: hash,
        order: [
          "SparseUpdate(None)",
          "DenseUpdate(None)",
          "Transfer",
          "MuxedTransfer(None)",
          "Transfer",
          "MuxedTransfer(Some(42))",
        ],
        events,
      },
      null,
      2,
    ) + "\n",
  );
  const { spec } = await loadBindingSource({ kind: "wasm", wasm });
  const plan = generateBindings(spec, { className: "Protocol28" });
  for (
    const [name, contents] of Object.entries({
      ...plan.files,
      ...plan.scaffold,
    })
  ) {
    await write(
      `_internal/tests/generated-bindings/protocol-28/${name}`,
      contents,
    );
  }
} finally {
  await Deno.remove(directory, { recursive: true });
}
console.log(
  check ? "Protocol-28 fixtures are current." : "Updated protocol-28 fixtures.",
);
