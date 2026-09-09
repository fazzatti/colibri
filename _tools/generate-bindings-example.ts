/** Refresh the reviewable output fixture without changing handwritten code. */
import {
  generateBindings,
  loadBindingSource,
} from "@colibri/contract-bindings";

const loaded = await loadBindingSource({
  kind: "wasm",
  wasm: await Deno.readFile(
    "_internal/tests/compiled-contracts/bindings_demo_contract.wasm",
  ),
});
const plan = generateBindings(loaded.spec, {
  className: "Demo",
  provenance: loaded.provenance,
});
const directory = "_internal/tests/generated-bindings/demo";
await Deno.mkdir(directory, { recursive: true });
for (
  const [name, source] of Object.entries({ ...plan.files, ...plan.scaffold })
) {
  const path = `${directory}/${name}`;
  if (Deno.args.includes("--check")) {
    if (await Deno.readTextFile(path) !== source) {
      throw new Error(`Stale generated example: ${path}`);
    }
  } else await Deno.writeTextFile(path, source);
}
console.log(
  Deno.args.includes("--check")
    ? "Generated example is current."
    : `Updated ${directory}.`,
);
