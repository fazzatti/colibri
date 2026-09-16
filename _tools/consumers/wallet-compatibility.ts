/** Check minimum and newest compatible published SDK types in isolated package graphs. */
import { resolve } from "node:path";
import { command, prepareSource, root, writeJson } from "./environment.ts";

const manifest = JSON.parse(
  await Deno.readTextFile(resolve(root, "react/deno.json")),
);
const names = ["@stellar/freighter-api", "@creit.tech/stellar-wallets-kit"];
const selections = await Promise.all(names.map(async (name) => {
  const specifier: string = manifest.imports[name];
  const minimum = specifier.match(/@\^(\d+\.\d+\.\d+)$/)?.[1];
  if (!minimum) {
    throw new Error(`Expected a reviewed wallet SDK minimum: ${name}`);
  }
  const response = await new Deno.Command("npm", {
    args: ["view", `${name}@^${minimum}`, "version", "--json"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!response.success) {
    throw new Error(new TextDecoder().decode(response.stderr));
  }
  const versions = JSON.parse(new TextDecoder().decode(response.stdout));
  const latest: string = Array.isArray(versions) ? versions.at(-1) : versions;
  return { name, specifier, minimum, latest };
}));
const directory = await Deno.makeTempDir({
  prefix: "colibri-wallet-compatibility-",
});
try {
  await prepareSource(directory, "17.0.1");
  const path = resolve(directory, "imports.json");
  const original = JSON.parse(await Deno.readTextFile(path));
  const checked = new Set<string>();
  for (const lane of ["minimum", "latest"] as const) {
    const identity = selections.map((item) => `${item.name}@${item[lane]}`)
      .join(", ");
    if (checked.has(identity)) {
      console.log(
        `${lane}: identical resolved versions already checked (${identity})`,
      );
      continue;
    }
    checked.add(identity);
    const map = structuredClone(original);
    for (const selection of selections) {
      const pinned = `npm:${selection.name}@${selection[lane]}`;
      for (
        const scope of [map.imports, ...Object.values(map.scopes)] as Record<
          string,
          string
        >[]
      ) {
        for (const [alias, value] of Object.entries(scope)) {
          if (value.startsWith(selection.specifier)) {
            scope[alias] = value.replace(selection.specifier, pinned);
          }
        }
      }
      // Consumer fixtures use explicit npm imports outside member scopes.
      map.imports[selection.specifier] = pinned;
      for (const subpath of ["sdk", "types"]) {
        map.imports[`${selection.specifier}/${subpath}`] =
          `${pinned}/${subpath}`;
      }
    }
    await writeJson(path, map);
    await command(Deno.execPath(), [
      "check",
      "--no-lock",
      "--config",
      "deno.json",
      "fixtures/wallets.ts",
    ], directory);
    console.log(`${lane}: actual published wallet types passed (${identity})`);
  }
} finally {
  await Deno.remove(directory, { recursive: true });
}
