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
    plugins: [
      {
        name: "production-environment",
        transform(code) {
          return code.includes("process.env.NODE_ENV")
            ? {
              code: code.replaceAll("process.env.NODE_ENV", '"production"'),
              map: null,
            }
            : null;
        },
      },
      nodeResolve({ browser: true }),
      commonjs(),
      terser(),
    ],
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

// Measure independently compressed chunks: initial static closure and complete
// graph are different costs. Dynamic imports postpone code; they do not erase it.
const splitBundles = {};
for (const name of ["react-assets", "react-webauth"]) {
  const bundle = await rollup({
    input: `${name}.js`,
    plugins: [
      {
        name: "production-environment",
        transform(code) {
          return code.includes("process.env.NODE_ENV")
            ? {
              code: code.replaceAll("process.env.NODE_ENV", '"production"'),
              map: null,
            }
            : null;
        },
      },
      nodeResolve({ browser: true }),
      commonjs(),
      terser(),
    ],
    onwarn() {},
  });
  try {
    const { output } = await bundle.write({
      dir: `../split/${name}`,
      format: "es",
      sourcemap: true,
      entryFileNames: "entry.js",
      chunkFileNames: "[name]-[hash].js",
    });
    const chunks = output.filter((file) => file.type === "chunk");
    const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
    const initial = new Set();
    const visit = (chunk) => {
      if (initial.has(chunk.fileName)) return;
      initial.add(chunk.fileName);
      for (const id of chunk.imports) {
        const imported = byName.get(id);
        if (!imported) throw new Error(`External split import: ${id}`);
        visit(imported);
      }
    };
    visit(chunks.find((chunk) => chunk.isEntry));
    for (const chunk of chunks) {
      for (const id of [...chunk.imports, ...chunk.dynamicImports]) {
        if (!byName.has(id)) throw new Error(`External split import: ${id}`);
      }
    }
    const metrics = (selected) =>
      selected.reduce((total, chunk) => ({
        raw: total.raw + Buffer.byteLength(chunk.code),
        gzip: total.gzip + gzip(chunk.code, { level: 9 }).length,
      }), { raw: 0, gzip: 0 });
    splitBundles[name] = {
      initial: metrics(chunks.filter((chunk) => initial.has(chunk.fileName))),
      complete: metrics(chunks),
      chunks: chunks.map((chunk) => ({
        file: chunk.fileName,
        initial: initial.has(chunk.fileName),
      })),
    };
  } finally {
    await bundle.close();
  }
}
await writeFile(
  "../split.json",
  JSON.stringify(
    {
      runtime: process.version,
      rollup: VERSION,
      compression: "sum of pako@2.1.0 gzip level 9 per chunk",
      bundles: splitBundles,
    },
    null,
    2,
  ),
);
