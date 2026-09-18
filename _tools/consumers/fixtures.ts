/** One consumer inventory for candidate builds and actual published distributions. */
import { resolve } from "node:path";
import { rewriteImports } from "./declarations/imports.ts";
export const fixtureRoot = resolve(import.meta.dirname!, "v1");

export const consumerFiles = [
  "smoke.ts",
  "extensions.ts",
  "keypair-signer.ts",
  "strkey.ts",
  "bindings-smoke.ts",
  "react-smoke.ts",
  "react-browser.ts",
  "wallets.ts",
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

/** Rewrite module specifiers without changing fixture assertions or generated text. */
export function installedFixture(
  source: string,
  packages: Record<string, string> = {},
): string {
  const aliases: Record<string, string> = {
    "stellar-sdk": "@stellar/stellar-sdk",
    convee: "@jsr/fifo__convee",
    ...packages,
  };
  return rewriteImports(source, (specifier) => {
    const alias = Object.keys(aliases).find((name) =>
      specifier === name || specifier.startsWith(`${name}/`)
    );
    if (alias) return aliases[alias] + specifier.slice(alias.length);
    return specifier.replace(
      /^npm:(react(?:-dom)?|@types\/react(?:-dom)?|@tanstack\/react-query|@stellar\/freighter-api|@creit.tech\/stellar-wallets-kit)@\^?[0-9.]+(\/.*)?$/,
      "$1$2",
    );
  });
}
