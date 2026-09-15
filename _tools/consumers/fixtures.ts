/** One consumer inventory for candidate builds and actual published distributions. */
import { resolve } from "node:path";
export const fixtureRoot = resolve(import.meta.dirname!, "v1");

export const consumerFiles = [
  "smoke.ts",
  "extensions.ts",
  "keypair-signer.ts",
  "strkey.ts",
  "bindings-smoke.ts",
  "react-smoke.ts",
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

/** Rewrite fixture-only npm specifiers for installed TypeScript consumers. */
export function installedFixture(source: string): string {
  return source.replace(
    /"npm:(react(?:-dom)?|@types\/react(?:-dom)?|@tanstack\/react-query)@\^?[0-9.]+(\/[^"]*)?"/g,
    (_match, name, subpath) => `"${name}${subpath ?? ""}"`,
  )
    .replaceAll('"stellar-sdk', '"@stellar/stellar-sdk')
    .replaceAll('"convee"', '"@jsr/fifo__convee"');
}
