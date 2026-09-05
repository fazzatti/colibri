/** Repository-only GitBook reference generation and validation. */
import ts from "npm:typescript@5.9.3";
import { dirname, relative, resolve } from "node:path";
import { readPackageInventory } from "./package-inventory.ts";

const root = resolve(import.meta.dirname!, "..");
const packages = (await readPackageInventory(root)).map((pkg) => pkg.root)
  .sort();
const write = Deno.args.includes("--write");
const failures: string[] = [];

async function files(directory: string): Promise<string[]> {
  const result: string[] = [];
  for await (const entry of Deno.readDir(directory)) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory) result.push(...await files(path));
    else if (entry.isFile) result.push(path);
  }
  return result.sort();
}

type Code = {
  package: string;
  file: string;
  line: number;
  symbol: string;
  value: string;
  description: string;
  owner: string;
};
const codes: Code[] = [];
const sources: { package: string; file: string; ast: ts.SourceFile }[] = [];
const doc = (node: ts.Node) =>
  ((node as ts.Node & { jsDoc?: ts.JSDoc[] }).jsDoc ?? [])
    .map((d) => typeof d.comment === "string" ? d.comment : "")
    .join(" ").replace(/\s+/g, " ").trim();
const label = (name: string) => name.replaceAll("_", " ").toLowerCase();
const slug = (path: string) =>
  path.replace(/\/src\//, "/")
    .replace(/\/(?:error|errors)(?:\/index)?\.ts$/, "")
    .replace(/(?:\.error)?\.ts$/, "").replaceAll("/", "-");

for (const pkg of packages) {
  for (const file of await files(resolve(root, pkg))) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const ast = ts.createSourceFile(
      file,
      await Deno.readTextFile(file),
      ts.ScriptTarget.Latest,
      true,
    );
    sources.push({ package: pkg, file, ast });
    const add = (
      symbol: string,
      value: ts.Expression | undefined,
      node: ts.Node,
    ) => {
      if (!value || !ts.isStringLiteral(value)) return;
      codes.push({
        package: pkg,
        file,
        line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        symbol,
        value: value.text,
        description: doc(node),
        owner: file,
      });
    };
    for (const statement of ast.statements) {
      if (
        ts.isEnumDeclaration(statement) && /Code$/.test(statement.name.text)
      ) {
        for (const member of statement.members) {
          add(member.name.getText(ast), member.initializer, member);
        }
      }
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!/Code$/.test(declaration.name.getText(ast))) continue;
        let value = declaration.initializer;
        if (value && ts.isAsExpression(value)) value = value.expression;
        if (!value || !ts.isObjectLiteralExpression(value)) continue;
        for (const member of value.properties) {
          if (ts.isPropertyAssignment(member)) {
            add(member.name.getText(ast), member.initializer, member);
          }
        }
      }
    }
  }
}

// Locate the concrete owning class, including packages with a central Code enum.
for (const source of sources) {
  for (const statement of source.ast.statements) {
    if (
      !ts.isClassDeclaration(statement) ||
      !statement.heritageClauses?.some((h) =>
        /Error/.test(h.getText(source.ast))
      )
    ) continue;
    const members: string[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isPropertyAccessExpression(node) &&
        /Code$/.test(node.expression.getText(source.ast))
      ) {
        members.push(node.name.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(statement);
    for (const member of members) {
      const local = codes.filter((c) =>
        c.file === source.file && c.symbol === member
      );
      const candidates = local.length
        ? local
        : codes.filter((c) =>
          c.package === source.package && c.symbol === member
        );
      if (candidates.length !== 1) continue;
      const code = candidates[0];
      code.owner = source.file;
      code.description ||= doc(statement);
    }
  }
}

const groups = new Map<string, Code[]>();
for (const code of codes) {
  const key = slug(relative(root, code.owner));
  const group = groups.get(key) ?? [];
  group.push(code);
  groups.set(key, group);
}
const generated = new Map<string, string>();
const navigation: string[] = [];
const markdownCell = (value: string) => value.replaceAll("|", "\\|");
const index = [
  "# Error code reference",
  "",
  "Every declared error code in the published package source is listed here, grouped",
  "by its owning context. A declaration does not guarantee that every code is emitted",
  "by the current implementation. Source links identify the definition; use the",
  "[error-handling guide](../../core/error.md) for catch and recovery patterns.",
  "",
  "These pages are source-derived. They include internal contexts that can surface",
  "through a public call; source paths are **not** importable package subpaths.",
  "",
  "`GEN_000` is Core's fallback for `ColibriError.unexpected()` and",
  "`ColibriError.fromUnknown()` when the caller supplies no code. Callers can also",
  "supply their own codes; those application-defined values are outside this catalog.",
  "",
];
for (const pkg of packages) {
  index.push(`## @colibri/${pkg.replace("plugins/", "plugin-")}`, "");
  for (const [key, group] of groups) {
    if (group[0].package !== pkg) continue;
    const owner = relative(root, group[0].owner);
    const title = owner.replace(/\/src\//, "/").replace(
      /\/(error|errors)(\/index)?\.ts$/,
      "",
    )
      .replace(/(?:\.error)?\.ts$/, "");
    index.push(`- [${title}](${key}.md) — ${group.length} codes.`);
    navigation.push(`  - [${title}](reference/errors/${key}.md)`);
    const lines = [
      `# ${title}`,
      "",
      "[All error contexts](README.md) · [Handling errors](../../core/error.md)",
      "",
      "Source-derived code definitions. Messages and metadata can contain runtime",
      "values; branch on the code, not on message text. See the source definition",
      "for constructors and diagnostic fields.",
      "",
      "| Code | Condition | Source |",
      "| --- | --- | --- |",
    ];
    for (const code of group) {
      lines.push(
        `| \`${code.value}\` | \`${code.symbol}\` — ${
          markdownCell(
            code.description || `Declared condition: ${label(code.symbol)}.`,
          )
        } | ` +
          `[Definition](https://github.com/fazzatti/colibri/blob/main/${
            relative(root, code.file)
          }#L${code.line}) |`,
      );
    }
    lines.push("");
    generated.set(`docs/reference/errors/${key}.md`, lines.join("\n"));
  }
  index.push("");
}
generated.set("docs/reference/errors/README.md", index.join("\n"));
const summaryPath = resolve(root, "docs/SUMMARY.md");
const summarySource = await Deno.readTextFile(summaryPath);
const navPattern =
  /<!-- error-contexts:start -->[\s\S]*?<!-- error-contexts:end -->/;
const expectedNavigation =
  "<!-- error-contexts:start -->\n\n- [Error codes by context](reference/errors/README.md)\n" +
  navigation.join("\n") +
  "\n\n<!-- error-contexts:end -->";
if (!navPattern.test(summarySource)) {
  failures.push("Missing generated error navigation markers");
} else if (write) {
  await Deno.writeTextFile(
    summaryPath,
    summarySource.replace(navPattern, expectedNavigation),
  );
} else if (
  summarySource.match(navPattern)?.[0].replace(/\s+/g, " ") !==
    expectedNavigation.replace(/\s+/g, " ")
) {
  failures.push("Stale error navigation: run deno task docs:errors");
}
// Remove only obsolete files in this exclusively generated directory.
if (write) {
  const directory = resolve(root, "docs/reference/errors");
  await Deno.mkdir(directory, { recursive: true });
  for (const path of await files(directory)) {
    if (path.endsWith(".md") && !generated.has(relative(root, path))) {
      await Deno.remove(path);
    }
  }
}
const normalize = (s: string) =>
  s.split("\n").map((line) =>
    /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(line)
      ? line.replace(/-+/g, "---").replace(/\s/g, "")
      : line
  ).join("\n").replace(/\s+/g, " ").trim();
for (const [path, expected] of generated) {
  const fullPath = resolve(root, path);
  if (write) {
    await Deno.mkdir(dirname(fullPath), { recursive: true });
    await Deno.writeTextFile(fullPath, expected);
  } else {
    const actual = await Deno.readTextFile(fullPath).catch(() => "");
    if (normalize(actual) !== normalize(expected)) {
      failures.push(`Stale error reference: ${path}`);
    }
  }
}

// GitBook only publishes docs/. Relative links must stay within that tree.
const docs = (await files(resolve(root, "docs"))).filter((p) =>
  p.endsWith(".md")
);
const summary = await Deno.readTextFile(resolve(root, "docs/SUMMARY.md"));
const anchors = new Map<string, Set<string>>();
for (const file of docs) {
  const text = (await Deno.readTextFile(file)).replace(/```[\s\S]*?```/g, "");
  const ids = new Set<string>();
  for (const heading of text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = heading[1].toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, "")
      .trim().replace(/\s/g, "-");
    let id = base;
    for (let count = 1; ids.has(id); count++) id = `${base}-${count}`;
    ids.add(id);
  }
  anchors.set(file, ids);
}
let snippetCount = 0;
for (const file of docs) {
  if (file.endsWith("AGENTS.md")) continue;
  const content = await Deno.readTextFile(file);
  for (
    const match of content.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)
  ) {
    snippetCount++;
    const ast = ts.createSourceFile(
      file,
      match[1],
      ts.ScriptTarget.Latest,
      true,
    );
    const diagnostics =
      (ast as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] })
        .parseDiagnostics;
    for (const diagnostic of diagnostics) {
      failures.push(
        `Invalid TypeScript snippet in ${relative(root, file)}: ` +
          ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
      );
    }
  }
  const prose = content.replace(/```[\s\S]*?```/g, "");
  for (const match of prose.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:)/.test(target)) continue;
    const [targetFile, fragment] = target.split("#");
    const path = targetFile
      ? resolve(dirname(file), decodeURIComponent(targetFile))
      : file;
    if (!path.startsWith(`${root}/docs/`)) {
      failures.push(
        `Link leaves GitBook: ${relative(root, file)} -> ${target}`,
      );
      continue;
    }
    if (!await Deno.stat(path).then(() => true).catch(() => false)) {
      failures.push(`Broken link: ${relative(root, file)} -> ${target}`);
    }
    if (
      fragment && anchors.has(path) &&
      !anchors.get(path)!.has(decodeURIComponent(fragment))
    ) {
      failures.push(
        `Broken heading link: ${relative(root, file)} -> ${target}`,
      );
    }
  }
  const path = relative(resolve(root, "docs"), file);
  if (path !== "SUMMARY.md" && !summary.includes(`](${path})`)) {
    failures.push(`Page absent from SUMMARY.md: ${path}`);
  }
}

const installation = await Deno.readTextFile(
  resolve(root, "docs/getting-started/installation.md"),
);
const apiReference = await Deno.readTextFile(
  resolve(root, "docs/reference/README.md"),
);
for (const pkg of packages) {
  const config = JSON.parse(
    await Deno.readTextFile(resolve(root, pkg, "deno.json")),
  );
  if (!installation.includes(`jsr:${config.name}@^${config.version}`)) {
    failures.push(
      `Installation example does not match ${config.name}@${config.version}`,
    );
  }
  if (!apiReference.includes(`https://jsr.io/${config.name}/doc`)) {
    failures.push(`Missing API reference for ${config.name}`);
  }
}
console.log(
  `${codes.length} declared error codes in ${groups.size} contexts; ${docs.length} Markdown files and ${snippetCount} TypeScript snippets checked.`,
);
if (Deno.args.includes("--examples")) {
  const directory = await Deno.makeTempDir({
    dir: resolve(root, "_tools"),
    prefix: ".docs-check-",
  });
  try {
    const examples: string[] = [];
    for (const path of docs) {
      const content = await Deno.readTextFile(path);
      let index = 0;
      for (
        const match of content.matchAll(
          /<!-- deno-check -->\s*```(?:ts|typescript)\n([\s\S]*?)```/g,
        )
      ) {
        const file = resolve(
          directory,
          `${
            relative(resolve(root, "docs"), path).replaceAll("/", "-")
          }-${++index}.ts`,
        );
        await Deno.writeTextFile(file, match[1] + "\nexport {};\n");
        examples.push(file);
      }
    }
    if (examples.length === 0) {
      failures.push("No checked documentation examples found");
    } else {
      const result = await new Deno.Command(Deno.execPath(), {
        cwd: root,
        args: ["check", "--config", resolve(root, "deno.json"), ...examples],
        stdout: "inherit",
        stderr: "inherit",
      }).output();
      if (!result.success) {
        failures.push("Documentation examples do not type-check");
      } else {console.log(
          `${examples.length} complete documentation examples type-checked without execution.`,
        );}
    }
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  Deno.exit(1);
}
