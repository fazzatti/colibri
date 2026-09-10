import { rollup, VERSION } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzip } from "pako";

const entries = JSON.parse(await readFile("entries.json", "utf8"));
await mkdir("../rollup", { recursive: true });
const bundles = {};
for (const name of entries) {
  const warnings = [];
  const bundle = await rollup({
    input: `${name}.js`,
    plugins: [nodeResolve({ browser: true }), commonjs(), terser()],
    onwarn(warning) {
      warnings.push({ code: warning.code, message: warning.message });
    },
  });
  try {
    const { output } = await bundle.write({
      file: `../rollup/${name}.js`,
      format: "es",
      inlineDynamicImports: true,
      sourcemap: true,
    });
    const chunk = output.find((file) => file.type === "chunk");
    if (chunk.imports.length || chunk.dynamicImports.length) {
      throw new Error(`Non-standalone bundle: ${name}`);
    }
    bundles[name] = {
      raw: Buffer.byteLength(chunk.code),
      gzip: gzip(chunk.code, { level: 9 }).length,
      visited: [...bundle.watchFiles],
      retained: Object.entries(chunk.modules).filter(([, data]) =>
        data.renderedLength > 0
      ).map(([id]) => id),
      warnings,
    };
  } finally {
    await bundle.close();
  }
}
await writeFile(
  "../rollup.json",
  JSON.stringify(
    {
      runtime: process.version,
      rollup: VERSION,
      compression: "pako@2.1.0 gzip level 9",
      bundles,
    },
    null,
    2,
  ),
);
