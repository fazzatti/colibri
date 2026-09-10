/** Resolve the supported native SDK without loading package-building dependencies. */
import { compare, parse } from "jsr:@std/semver@1.0.5";
import { accepts } from "../releases/model.ts";

export async function resolveSdk(selection: string): Promise<string> {
  const result = await new Deno.Command("npm", {
    args: ["view", `@stellar/stellar-sdk@${selection}`, "version", "--json"],
  }).output();
  if (!result.success) {
    throw new Error(
      `CONSUMER_SDK_LOOKUP: ${new TextDecoder().decode(result.stderr)}`,
    );
  }
  const data = JSON.parse(new TextDecoder().decode(result.stdout));
  const versions: string[] = typeof data === "string" ? [data] : data;
  const sdk = versions.sort((a, b) => compare(parse(a), parse(b))).at(-1)!;
  if (!accepts(sdk, ">=17.0.1 <18")) {
    throw new Error(`CONSUMER_SDK_UNSUPPORTED: ${sdk}`);
  }
  console.log(`Selected native Stellar SDK ${sdk} from ${selection}`);
  return sdk;
}
