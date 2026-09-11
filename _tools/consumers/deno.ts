/** Run the preserved consumers on Deno without workspace package substitution. */
import { consumerFiles } from "./fixtures.ts";
import { checkResolvedSdk, command, prepareSource } from "./environment.ts";

export async function checkDenoConsumer(sdk: string): Promise<void> {
  const temporary = await Deno.realPath(
    await Deno.makeTempDir({ prefix: "colibri-deno-consumer-" }),
  );
  try {
    const inventory = await prepareSource(temporary, sdk);
    await command(Deno.execPath(), [
      "check",
      "--config",
      "deno.json",
      ...inventory.flatMap((pkg) =>
        Object.values(pkg.exports).map((entry) => `${pkg.root}/${entry}`)
      ),
      ...consumerFiles.map((name) => `fixtures/${name}`),
    ], temporary);
    await checkResolvedSdk(temporary, sdk);
    for (const fixture of consumerFiles) {
      await command(Deno.execPath(), [
        "run",
        "-A",
        "--config",
        "deno.json",
        `fixtures/${fixture}`,
      ], temporary);
    }
    console.log(
      `Deno consumer passed: ${Deno.version.deno} / TS ${Deno.version.typescript} / SDK selection ${sdk}`,
    );
  } finally {
    await Deno.remove(temporary, { recursive: true });
  }
}

if (import.meta.main) {
  await checkDenoConsumer(Deno.env.get("STELLAR_SDK_VERSION") ?? "17.0.1");
}
