import { resolve } from "node:path";
import { command } from "../consumers/environment.ts";

/** Exercise the installed npm recorder through real Node workers, without a Deno subprocess. */
export async function checkNodeRecorder(consumer: string): Promise<void> {
  const fixture = resolve(consumer, "recorder-consumer.mjs");
  await Deno.copyFile(new URL("./node-consumer.mjs", import.meta.url), fixture);
  await Deno.copyFile(
    new URL("./node-types.ts", import.meta.url),
    resolve(consumer, "recorder-types.ts"),
  );
  await command("npx", [
    "--no-install",
    "tsc",
    "recorder-types.ts",
    "--noEmit",
    "--module",
    "nodenext",
    "--target",
    "ES2023",
    "--strict",
    "--types",
    "node",
    "--skipLibCheck",
  ], consumer);
  await command("node", [fixture], consumer);
}
if (import.meta.main) await checkNodeRecorder(resolve(Deno.args[0]));
