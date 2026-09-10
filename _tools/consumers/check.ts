/** Local source, packaging and runtime checks for one SDK selection. */
import { prepareArtifacts } from "./prepare.ts";
import { runArtifacts } from "./run.ts";
import { checkDenoConsumer } from "./deno.ts";

const temporary = await Deno.makeTempDir({ prefix: "colibri-consumers-" });
try {
  const sdk = Deno.env.get("STELLAR_SDK_VERSION") ?? "17.0.1";
  await checkDenoConsumer(sdk);
  await prepareArtifacts(temporary, sdk);
  await runArtifacts(temporary, Deno.args.includes("--browsers"));
} finally {
  await Deno.remove(temporary, { recursive: true });
}
