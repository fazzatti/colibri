import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { parse } from "yaml";
import {
  compatibilityChecks,
  verifyRuntime,
} from "colibri-tools/consumers/ci/plan.ts";

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
};
type Job = {
  name: string;
  uses?: string;
  if?: string;
  needs?: string | string[];
  strategy?: {
    "fail-fast": boolean;
    matrix: {
      include: { phase: string; name: string; deno?: string; node?: string }[];
    };
  };
  steps?: Step[];
};
type Workflow = { jobs: Record<string, Job>; on: Record<string, unknown> };
const readWorkflow = async (name: string): Promise<Workflow> =>
  parse(
    await Deno.readTextFile(
      new URL(`../../../.github/workflows/${name}`, import.meta.url),
    ),
  );

describe("parallel compatibility workflow", () => {
  it("assigns every supported case to exactly one correctly configured job", async () => {
    const { jobs } = await readWorkflow("compatibility.yml");
    const assignments = [
      { phase: "prepare", deno: "2.9.6", node: "24" },
      ...jobs.source.strategy!.matrix.include,
      ...jobs.installed.strategy!.matrix.include.map((row) => ({
        ...row,
        deno: "2.9.6",
      })),
      { phase: "browser-runner", deno: "2.9.6", node: "24" },
    ];
    for (const version of ["17.0.1", "17.1.0"]) {
      const checks = compatibilityChecks([
        { selection: "17.0.1", version: "17.0.1" },
        { selection: "^17.0.1", version },
      ], "/tmp/compatibility");
      assertEquals(
        new Set(assignments.map((row) => row.phase)),
        new Set(checks.map((check) => check.phase)),
      );
      for (const check of checks) {
        const assigned = assignments.filter((row) => row.phase === check.phase);
        assertEquals(assigned.length, 1, `Job ownership: ${check.id}`);
        const row = assigned[0];
        verifyRuntime(
          [check],
          row.deno!,
          row.node?.includes(".")
            ? row.node
            : row.node
            ? `${row.node}.0.0`
            : undefined,
        );
      }
    }
    for (const id of ["source", "installed"]) {
      const job = jobs[id];
      const setup = job.steps!.find((step) =>
        step.uses?.startsWith("denoland/setup-deno@")
      )!;
      assertEquals(
        setup.with!["deno-version"],
        id === "source" ? "${{ matrix.deno }}" : "2.9.6",
      );
      const execution = job.steps!.find((step) => step.env?.PHASE)!;
      assertEquals(execution.env!.PHASE, "${{ matrix.phase }}");
      assertStringIncludes(execution.run!, 'check:consumers:ci "$PHASE"');
      assertEquals(job.strategy!["fail-fast"], false);
      assertEquals(
        job.steps!.find((step) =>
          step.uses === "./.github/actions/compatibility-results"
        )!.if,
        "always()",
      );
    }
    assertEquals(
      jobs.installed.steps!.find((step) =>
        step.uses?.startsWith("actions/setup-node@")
      )!.with!["node-version"],
      "${{ matrix.node }}",
    );
    const browser = jobs.installed.steps!.find((step) =>
      step.run?.includes("ci browser-runner")
    )!;
    assertEquals(
      browser.if,
      "${{ !cancelled() && matrix.phase == 'browsers' }}",
    );
  });

  it("resolves SDK selections once and reuses portable artifacts without serializing source checks", async () => {
    const workflow = await readWorkflow("compatibility.yml");
    assert("workflow_call" in workflow.on);
    const { jobs } = workflow;
    assertEquals(jobs.source.needs, "plan");
    assertEquals(jobs.prepare.needs, "plan");
    assertEquals(jobs.installed.needs, ["plan", "prepare"]);
    const commands = Object.values(jobs).flatMap((job) => job.steps ?? []).map((
      step,
    ) => step.run ?? "");
    assertEquals(commands.filter((run) => run.includes("ci plan ")).length, 1);
    assertEquals(
      commands.filter((run) => run.includes("ci prepare ")).length,
      1,
    );
    assertEquals(
      commands.filter((run) => run.includes("rustup toolchain")).length,
      1,
    );
    for (const id of ["prepare", "source", "installed", "summary"]) {
      assert(
        jobs[id].steps!.some((step) =>
          step.uses?.startsWith("actions/download-artifact@") &&
          step.with?.name === "compatibility-plan"
        ),
      );
    }
    assert(
      jobs.prepare.steps!.some((step) =>
        step.uses?.startsWith("actions/upload-artifact@") &&
        step.with?.name === "compatibility-packages"
      ),
    );
    assert(
      jobs.installed.steps!.some((step) =>
        step.uses?.startsWith("actions/download-artifact@") &&
        step.with?.name === "compatibility-packages"
      ),
    );
    assert(
      jobs.source.steps!.some((step) =>
        step.uses?.startsWith("actions/checkout@") &&
        step.with?.["fetch-depth"] === 0
      ),
    );
  });

  it("requires both complete case evidence and successful jobs while retaining the existing required checks", async () => {
    const { jobs } = await readWorkflow("compatibility.yml");
    const summary = jobs.summary;
    assertEquals(summary.if, "${{ always() }}");
    assertEquals(summary.needs, ["plan", "prepare", "source", "installed"]);
    assertEquals(
      summary.steps!.find((step) => step.run?.includes("ci summary "))!.if,
      "always()",
    );
    const statuses = summary.steps!.find((step) => step.env?.PLAN_RESULT)!;
    assertEquals(statuses.if, "always()");
    assert(Array.isArray(summary.needs));
    for (const id of summary.needs) {
      const key = `${id.toUpperCase()}_RESULT`;
      assertEquals(statuses.env![key], `\${{ needs.${id}.result }}`);
      assertStringIncludes(statuses.run!, `test "$${key}" = "success"`);
    }
    const collector = summary.steps!.find((step) =>
      step.with?.pattern === "compatibility-case-results-*"
    )!;
    assertEquals(collector.with!["merge-multiple"], true);
    const parent = await readWorkflow("deno.yml");
    assertEquals(parent.jobs.compatibility_checks.name, "compatibility");
    assertEquals(
      parent.jobs.compatibility_checks.uses,
      "./.github/workflows/compatibility.yml",
    );
    const gate = parent.jobs.compatibility;
    assertEquals(gate.name, "compatibility");
    assertEquals(gate.if, "${{ always() }}");
    assertEquals(gate.needs, "compatibility_checks");
    assertEquals(
      gate.steps![0].env!.SUITE_RESULT,
      "${{ needs.compatibility_checks.result }}",
    );
    assertEquals(gate.steps![0].run, 'test "$SUITE_RESULT" = "success"');
    assert((parent.jobs.test.needs as string[]).includes("compatibility"));
    assertStringIncludes(
      parent.jobs.test.steps![0].run!,
      'test "$COMPATIBILITY_RESULT" = "success"',
    );
  });
});
