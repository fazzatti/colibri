/** One consumer inventory for candidate builds and actual published distributions. */
import { resolve } from "node:path";
export const fixtureRoot = resolve(import.meta.dirname!, "v1");

export const consumerFiles = [
  "smoke.ts",
  "extensions.ts",
  "keypair-signer.ts",
  "strkey.ts",
  "bindings-smoke.ts",
] as const;

export async function copyConsumerFixtures(destination: string): Promise<void> {
  await Deno.mkdir(destination, { recursive: true });
  for (const name of consumerFiles) {
    const parent = name === "smoke.ts" || name === "extensions.ts"
      ? fixtureRoot
      : import.meta.dirname!;
    await Deno.copyFile(resolve(parent, name), resolve(destination, name));
  }
}
