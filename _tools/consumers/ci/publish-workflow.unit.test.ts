import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { parse } from "yaml";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readPackageInventory } from "colibri-tools/package-inventory.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));

describe("publish workflow package detection", () => {
  it("detects every workspace release, including React, and skips existing tags", async () => {
    const inventory = await readPackageInventory(root);
    const workflow = parse(
      await Deno.readTextFile(resolve(root, ".github/workflows/publish.yml")),
    );
    const detection = workflow.jobs.publish.steps.find((
      step: { id?: string },
    ) => step.id === "detect-versions");
    const directory = await Deno.makeTempDir();
    try {
      for (const pkg of inventory) {
        const path = resolve(directory, pkg.root, "deno.json");
        await Deno.mkdir(dirname(path), { recursive: true });
        await Deno.writeTextFile(
          path,
          JSON.stringify({ version: pkg.version }),
        );
      }
      const tags = inventory.map((pkg) =>
        `${pkg.name.slice("@colibri/".length)}-${pkg.version}`
      );
      const react = tags.find((tag) => tag.startsWith("react-"))!;
      for (const existing of [[], [react], tags]) {
        const output = resolve(directory, "github-output");
        await Deno.writeTextFile(output, "");
        const result = await new Deno.Command("bash", {
          cwd: directory,
          args: [
            "-e",
            "-c",
            `
# Stub only the read-only tag lookup; execute the workflow's real detection script.
git() {
  test "$1" = rev-parse || return 2
  case " $EXISTING_TAGS " in
    *" $2 "*) return 0 ;;
    *) return 1 ;;
  esac
}
${detection.run}`,
          ],
          env: { GITHUB_OUTPUT: output, EXISTING_TAGS: existing.join(" ") },
        }).output();
        assertEquals(result.code, 0, new TextDecoder().decode(result.stderr));
        const actual = (await Deno.readTextFile(output)).trim()
          .replace(/^tags_to_create=/, "").split("|").filter(Boolean).sort();
        assertEquals(
          actual,
          tags.filter((tag) => !existing.includes(tag)).sort(),
        );
      }
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
