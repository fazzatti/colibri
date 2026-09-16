import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { resolve } from "node:path";
import { readPackageInventory } from "colibri-tools/package-inventory.ts";
import {
  type ErrorSource,
  inspectTypedErrors,
} from "colibri-tools/typed-errors.ts";
async function sources(
  root: string,
  aliasRoot: string,
): Promise<ErrorSource[]> {
  const result: ErrorSource[] = [];
  for await (const file of Deno.readDir(root)) {
    if (file.name === "node_modules" || file.name === "coverage") continue;
    const path = resolve(root, file.name);
    if (file.isDirectory) result.push(...await sources(path, aliasRoot));
    else if (path.endsWith(".ts") && !path.endsWith(".test.ts")) {
      result.push({ path, aliasRoot, text: await Deno.readTextFile(path) });
    }
  }
  return result;
}
describe("concrete error architecture", () => {
  it("requires one concrete class for every stable code across all published packages", async () => {
    const inputs: ErrorSource[] = [];
    for (const pkg of await readPackageInventory(Deno.cwd())) {
      const manifest = JSON.parse(
        await Deno.readTextFile(`${pkg.root}/deno.json`),
      );
      inputs.push(
        ...await sources(
          resolve(pkg.root),
          resolve(pkg.root, manifest.imports?.["@/"] ?? "."),
        ),
      );
    }
    const result = inspectTypedErrors(inputs);
    assert(
      result.codes > 400,
      `Inventory unexpectedly shrank: ${result.codes}`,
    );
    assertEquals(result.errors, []);
  });
  it("detects missing, shared, duplicate and generically constructed errors, including aliases", () => {
    const check = (text: string, use = "") =>
      inspectTypedErrors([
        { path: "/pkg/errors.ts", aliasRoot: "/pkg", text },
        { path: "/pkg/use.ts", aliasRoot: "/pkg", text: use },
      ]).errors;
    const base =
      'enum Code { A = "A", B = "B" } class BaseError extends Error {}';
    assertEquals(check(base).length, 2);
    assert(
      check(
        base +
          "class Shared extends BaseError { constructor(){ super({code: ok ? Code.A : Code.B}); }}",
      ).some((e) => e.includes("multiple")),
    );
    const good = base +
      "class A extends BaseError { constructor(){super({code:Code.A});}} class B extends BaseError { constructor(){super({code:Code.B});}}";
    assertEquals(check(good), []);
    assert(
      check(
        good +
          "class Duplicate extends BaseError { constructor(){super({code:Code.A});}}",
      ).some((e) => e.includes("found 2")),
    );
    assert(
      check(good, 'import {BaseError as E} from "@/errors.ts"; throw new E();')
        .some((e) => e.includes("concrete")),
    );
    assertEquals(
      check(good, 'import {A as E} from "@/errors.ts"; throw new E();'),
      [],
    );
    assertEquals(
      check(
        good,
        'import * as Errors from "@/errors.ts"; throw new Errors.A();',
      ),
      [],
    );
    assert(
      check(good, 'ColibriError.unexpected({code: "A"});').some((e) =>
        e.includes("factory")
      ),
    );
    assert(
      check(
        good,
        'const context = {code: "A"}; ColibriError.fromUnknown(cause, {...context});',
      ).some((e) => e.includes("factory")),
    );
    assert(
      check(
        good + "class Generic extends BaseError {}",
        'import {Generic as Alias} from "@/errors.ts"; new Alias();',
      ).some((e) => e.includes("concrete")),
    );
  });
});
