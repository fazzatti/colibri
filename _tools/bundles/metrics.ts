// @deno-types="npm:@types/pako@2.0.4"
import { gzip } from "npm:pako@2.1.0";
import {
  decodedMappings,
  TraceMap,
} from "npm:@jridgewell/trace-mapping@0.3.31";
import { budgets, forbiddenDependencies } from "./fixtures.ts";
import ts from "npm:typescript@5.9.3";

/** A standalone browser bundle may not leave a static or dynamic import behind. */
export function assertStandalone(code: string): void {
  const source = ts.createSourceFile(
    "bundle.js",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier) ||
      (ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword)
    ) {
      throw new Error(
        "BUNDLE_EXTERNAL_IMPORT: standalone output contains an import",
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

/** Source lists include visited modules. Only mapped segments establish retention. */
export function measure(code: Uint8Array, sourceMap: string) {
  assertStandalone(new TextDecoder().decode(code));
  const map = new TraceMap(JSON.parse(sourceMap));
  const mapped = new Set<number>();
  for (const line of decodedMappings(map)) {
    for (const segment of line) {
      if (segment.length >= 4) mapped.add(segment[1]!);
    }
  }
  return {
    raw: code.length,
    gzip: gzip(code, { level: 9 }).length,
    visited: map.sources,
    retained: [...mapped].map((index) => map.sources[index] ?? "<unmapped>"),
  };
}

export function checkMeasurement(
  name: string,
  data: ReturnType<typeof measure>,
) {
  const budget = budgets[name];
  if (budget && (data.raw > budget[0] || data.gzip > budget[1])) {
    throw new Error(
      `BUNDLE_BUDGET: ${name}: ${data.raw} raw / ${data.gzip} gzip exceeds ${budget}`,
    );
  }
  const forbidden = forbiddenDependencies(name);
  const retained = data.retained.filter((source) =>
    forbidden.some((pattern) => pattern.test(source))
  );
  if (retained.length) {
    throw new Error(`BUNDLE_DEPENDENCIES: ${name}: ${retained.join(", ")}`);
  }
}
