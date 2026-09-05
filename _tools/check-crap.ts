import { analyze, lcovReader, type MethodMetrics } from "crap4ts-tool";
import { readPackageInventory } from "./package-inventory.ts";

const CRAP_THRESHOLD = 15;

const PACKAGE_ROOTS = (await readPackageInventory(Deno.cwd())).map((pkg) =>
  pkg.root
);

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "coverage",
  "dist",
  "node_modules",
  "target",
]);

const isProductionTypeScript = (name: string): boolean =>
  (name.endsWith(".ts") || name.endsWith(".tsx")) &&
  !name.endsWith(".d.ts") &&
  !name.endsWith(".test.ts");

const collectSourceFiles = (directory: string): string[] =>
  [...Deno.readDirSync(directory)].flatMap((entry): string[] => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory) {
      return IGNORED_DIRECTORIES.has(entry.name)
        ? []
        : collectSourceFiles(path);
    }
    return entry.isFile && isProductionTypeScript(entry.name) ? [path] : [];
  });

const formatMetric = (metric: MethodMetrics): string =>
  `${metric.file}:${metric.startLine} ${metric.className}.${metric.methodName} ` +
  `(CRAP ${
    metric.crapScore?.toFixed(1) ?? "N/A"
  }, complexity ${metric.complexity}, ` +
  `coverage ${metric.coveragePercent?.toFixed(1) ?? "N/A"}%)`;

const githubAnnotation = (metric: MethodMetrics): string => {
  const file = metric.file
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A")
    .replaceAll(",", "%2C")
    .replaceAll(":", "%3A");
  const message = formatMetric(metric)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
  return `::error file=${file},line=${metric.startLine},title=CRAP threshold exceeded::${message}`;
};

const reportFailure = (
  label: string,
  metrics: readonly MethodMetrics[],
): void => {
  console.error(`${label}:`);
  for (const metric of metrics) {
    console.error(`  ${formatMetric(metric)}`);
    if (Deno.env.get("GITHUB_ACTIONS") === "true") {
      console.error(githubAnnotation(metric));
    }
  }
};

const run = (coveragePath: string): void => {
  Deno.statSync(coveragePath);

  const sourceFiles = PACKAGE_ROOTS.flatMap(collectSourceFiles).sort();
  const metrics = analyze(sourceFiles, lcovReader.read(coveragePath));
  const missingCoverage = metrics.filter((metric) => metric.crapScore === null);
  const violations = metrics
    .filter((metric) =>
      metric.crapScore !== null && metric.crapScore > CRAP_THRESHOLD
    )
    .sort((left, right) => (right.crapScore ?? 0) - (left.crapScore ?? 0));

  console.log(
    `CRAP analyzed ${metrics.length} functions across ${sourceFiles.length} source files ` +
      `with a maximum allowed score of ${CRAP_THRESHOLD}.`,
  );

  if (missingCoverage.length > 0) {
    reportFailure("Functions without attributable coverage", missingCoverage);
  }
  if (violations.length > 0) {
    reportFailure("Functions exceeding the CRAP threshold", violations);
  }

  if (missingCoverage.length > 0 || violations.length > 0) {
    Deno.exitCode = 1;
    return;
  }

  console.log("CRAP threshold satisfied.");
};

const coveragePath = Deno.args[0] ?? "coverage.lcov";
if (Deno.args.length > 1) {
  console.error("Usage: deno task check:crap [coverage.lcov]");
  Deno.exitCode = 1;
} else {
  try {
    run(coveragePath);
  } catch (error) {
    console.error(
      `Unable to evaluate CRAP from ${coveragePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    Deno.exitCode = 1;
  }
}
