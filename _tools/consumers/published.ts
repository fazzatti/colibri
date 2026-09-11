/** Validate actual JSR modules and registry-generated npm tarballs after publication. */
import { consumerFiles, copyConsumerFixtures } from "./fixtures.ts";
import { resolve } from "node:path";
import { readPackageInventory } from "../package-inventory.ts";
import { git } from "../releases/repository.ts";
import { command, dockerPackages, root, writeJson } from "./environment.ts";

const inventory = await readPackageInventory(root);
const refIndex = Deno.args.indexOf("--versions-from-ref");
if (refIndex !== -1) {
  for (const pkg of inventory) {
    pkg.version = JSON.parse(
      await git(
        root,
        "show",
        `${Deno.args[refIndex + 1]}:${pkg.root}/deno.json`,
      ),
    ).version;
  }
}
const temporary = await Deno.makeTempDir({
  prefix: "colibri-jsr-distribution-",
});
try {
  const config = JSON.parse(
    await Deno.readTextFile(resolve(root, "deno.json")),
  );
  const imports: Record<string, string> = {
    "stellar-sdk": config.imports["stellar-sdk"],
    convee: config.imports.convee,
  };
  for (const pkg of inventory) {
    imports[pkg.name] = `jsr:${pkg.name}@${pkg.version}`;
  }
  await writeJson(resolve(temporary, "deno.json"), {
    imports,
    nodeModulesDir: "auto",
    minimumDependencyAge: {
      age: "P1D",
      exclude: [
        "jsr:@fifo/convee",
        ...inventory.map((pkg) => `jsr:${pkg.name}`),
      ],
    },
    compilerOptions: { skipLibCheck: true },
  });
  await copyConsumerFixtures(temporary);
  await command(Deno.execPath(), [
    "check",
    "--config",
    "deno.json",
    ...inventory.flatMap((pkg) =>
      Object.keys(pkg.exports).map((entry) =>
        `jsr:${pkg.name}@${pkg.version}${entry === "." ? "" : entry.slice(1)}`
      )
    ),
    ...consumerFiles,
  ], temporary);
  for (const name of consumerFiles) {
    await command(
      Deno.execPath(),
      ["run", "-A", "--config", "deno.json", name],
      temporary,
    );
  }

  const npm = resolve(temporary, "npm");
  await Deno.mkdir(npm);
  const npmName = (name: string): string =>
    `@jsr/${name.slice(1).replace("/", "__")}`;
  const dependencies = Object.fromEntries(
    inventory.filter((pkg) => !dockerPackages.has(pkg.name)).map((
      pkg,
    ) => [npmName(pkg.name), pkg.version]),
  );
  dependencies["@jsr/fifo__convee"] = config.imports.convee.split("@").at(-1);
  dependencies["@stellar/stellar-sdk"] = config.imports["stellar-sdk"].replace(
    "npm:@stellar/stellar-sdk@",
    "",
  );
  dependencies.typescript = "5.9.3";
  await writeJson(resolve(npm, "package.json"), {
    private: true,
    type: "module",
    dependencies,
  });
  await Deno.writeTextFile(
    resolve(npm, ".npmrc"),
    "@jsr:registry=https://npm.jsr.io\n",
  );
  await command("npm", [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ], npm);
  const evidenceIndex = Deno.args.indexOf("--evidence");
  const evidence = resolve(
    evidenceIndex === -1
      ? "_artifacts/published"
      : Deno.args[evidenceIndex + 1],
  );
  await Deno.mkdir(evidence, { recursive: true });
  await Deno.copyFile(
    resolve(npm, "package-lock.json"),
    resolve(evidence, "package-lock.json"),
  );
  await writeJson(
    resolve(evidence, "packages.json"),
    await Promise.all(
      Object.keys(dependencies).filter((name) => name.startsWith("@jsr/")).map(
        async (name) => {
          const manifest = JSON.parse(
            await Deno.readTextFile(
              resolve(npm, "node_modules", name, "package.json"),
            ),
          );
          return {
            name,
            version: manifest.version,
            revision: manifest._jsr_revision,
          };
        },
      ),
    ),
  );
  for (const name of consumerFiles) {
    let source = await Deno.readTextFile(resolve(temporary, name));
    for (const pkg of inventory) {
      source = source.replaceAll(`"${pkg.name}`, `"${npmName(pkg.name)}`);
    }
    source = source.replaceAll('"stellar-sdk', '"@stellar/stellar-sdk')
      .replaceAll('"convee"', '"@jsr/fifo__convee"');
    await Deno.writeTextFile(resolve(npm, name), source);
  }
  await command("npx", [
    "--no-install",
    "tsc",
    ...consumerFiles,
    "--outDir",
    "out",
    "--module",
    "nodenext",
    "--target",
    "ES2023",
    "--strict",
    "--skipLibCheck",
  ], npm);
  for (
    const name of consumerFiles.map((name) => name.replace(/\.ts$/, ".js"))
  ) {
    await command("node", [`out/${name}`], npm);
  }
  await command("npm", [
    "ls",
    "@jsr/colibri__core",
    "@stellar/stellar-sdk",
    "@jsr/fifo__convee",
  ], npm);
  console.log(
    `Actual JSR distribution passed: ${
      inventory.map((pkg) => `${pkg.name}@${pkg.version}`).join(", ")
    }`,
  );
} finally {
  await Deno.remove(temporary, { recursive: true });
}
