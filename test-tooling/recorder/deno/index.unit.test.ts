import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { join } from "node:path";
import { aggregate } from "@/recorder/artifacts/aggregate.ts";
import { summarize } from "@/recorder/report/aggregate.ts";
import { TestRecorder } from "@/recorder/deno/index.ts";

const { describe, it } = recordColibriTests(import.meta.url);

const recorderModule = new URL("./index.ts", import.meta.url).href;
const cli = new URL("../cli/index.ts", import.meta.url).pathname;
const config = new URL("../../../deno.json", import.meta.url).pathname;
const cwd = new URL("../../../", import.meta.url).pathname;

describe("Deno recorder lifecycle", () => {
  it("keeps memory-only configuration free from filesystem output", async () => {
    // The outer repository suite may itself be recorded. Isolate the subject's
    // environment while constructing it, then restore the outer run immediately.
    const directory = Deno.env.get("COLIBRI_RECORDER_DIRECTORY");
    Deno.env.delete("COLIBRI_RECORDER_DIRECTORY");
    let recorder: TestRecorder;
    try {
      recorder = new TestRecorder();
    } finally {
      if (directory) Deno.env.set("COLIBRI_RECORDER_DIRECTORY", directory);
    }
    assertEquals(recorder.directory, undefined);
    await recorder.flush();
    assertEquals(recorder.report().records, []);
  });
  it("preserves native invalid-registration errors and omits disabled timings", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const report = join(directory, "observations.json");
      const file = join(directory, "untimed.test.ts");
      await Deno.writeTextFile(
        file,
        `
import {TestRecorder} from ${JSON.stringify(recorderModule)};
import * as bdd from "jsr:@std/testing@1.0.19/bdd";
const recorder = new TestRecorder();
const {it, afterAll} = recorder.recordTests(import.meta.url);
afterAll(() => Deno.writeTextFile(${
          JSON.stringify(report)
        }, JSON.stringify(recorder.report())));
const failure = register => { try { register({}); } catch(error) { return error.message; } };
if (failure(it) !== failure(bdd.it)) throw new Error("registration semantics changed");
it("untimed callback", () => {});
afterAll(() => Deno.writeTextFile(${
          JSON.stringify(report)
        }, JSON.stringify(recorder.report())));
`,
      );
      const child = await new Deno.Command(Deno.execPath(), {
        args: ["test", "-A", "--no-check", "--config=" + config, file],
        cwd,
        stdout: "piped",
        stderr: "piped",
        env: { COLIBRI_RECORDER_DIRECTORY: "" },
      }).output();
      assertEquals(
        child.code,
        0,
        new TextDecoder().decode(child.stdout) +
          new TextDecoder().decode(child.stderr),
      );
      const evidence = JSON.parse(await Deno.readTextFile(report));
      const test = evidence.records.find((record: { name: string }) =>
        record.name === "untimed callback"
      );
      assertEquals(test.status, "passed");
      assertEquals(test.durationMs, undefined);
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
  it("collects parallel files, ignored tests and failed teardown, then rebuilds HTML", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const artifacts = join(directory, "artifacts");
      await Deno.writeTextFile(
        join(directory, "recording.ts"),
        `import {TestRecorder} from ${
          JSON.stringify(recorderModule)
        }; export const recorder=new TestRecorder({capture:"details",profiling:{timings:true},output:{json:{directory:${
          JSON.stringify(artifacts)
        }},html:true,summary:true}});`,
      );
      await Deno.writeTextFile(
        join(directory, "one.test.ts"),
        `import {recorder} from "./recording.ts";
const {describe,it,beforeAll,afterAll,beforeEach,afterEach,observer}=recorder.recordTests(import.meta.url);
describe("suite",()=>{
beforeAll(function(){ this.value=7; observer.log("setup",{value:7}); });
beforeEach(()=>observer.log("before"));afterEach(()=>observer.log("after"));
it("passes",function(){if(this.value!==7)throw new TypeError("lost this");observer.capture(()=>123n);});
it("expected rejection",()=>{try{observer.create(()=>{throw new TypeError("expected");});}catch{}});
it.ignore("ignored",()=>{});
afterAll(()=>{throw new TypeError("teardown failed");});
});`,
      );
      await Deno.writeTextFile(
        join(directory, "two.test.ts"),
        `import {recorder} from "./recording.ts"; const {describe,it,observer}=recorder.recordTests(import.meta.url);const suite=describe("flat");it(suite,"passes",()=>observer.log("second file"));it({name:"object test",fn:()=>observer.capture(()=>"result")});describe({name:"inline hooks",beforeAll:[()=>observer.log("inline setup")],afterAll:()=>observer.log("inline teardown"),fn:()=>it("inline test",()=>{})});it("uncaught rejection",()=>{throw new Error("expected runner failure");});`,
      );
      await Deno.writeTextFile(
        join(directory, "ignored.test.ts"),
        `import {recorder} from "./recording.ts";const {it}=recorder.recordTests(import.meta.url);it.ignore("only ignored",()=>{});`,
      );
      await Deno.writeTextFile(
        join(directory, "names.test.ts"),
        `import {recorder} from "./recording.ts";
const {describe,it,beforeAll,observer}=recorder.recordTests(import.meta.url);
beforeAll(()=>observer.log("file setup"));
it(function namedCallback() {});
const suite=describe("options suite");
it({suite,fn:function namedOption() {}});
`,
      );
      const child = await new Deno.Command(Deno.execPath(), {
        cwd,
        args: [
          "run",
          "-A",
          `--config=${config}`,
          cli,
          "run",
          `--config=${join(directory, "recording.ts")}`,
          "--",
          "-A",
          "--no-check",
          "--parallel",
          `--config=${config}`,
          directory,
        ],
        stdout: "piped",
        stderr: "piped",
      }).output();
      const stdout = new TextDecoder().decode(child.stdout);
      const output = stdout + new TextDecoder().decode(child.stderr);
      assertEquals(child.code, 1, output);
      // A failing fixture must still finish aggregation. An early CLI failure
      // also exits with 1, so surface its output before reading the artifacts.
      assertStringIncludes(stdout, "Colibri report:", output);
      const runs = [...Deno.readDirSync(artifacts)];
      assertEquals(runs.length, 1);
      const path = join(artifacts, runs[0].name);
      const report = await aggregate(path, { html: true });
      assertEquals(report.exitCode, 1);
      assert(
        report.complete,
        JSON.stringify(
          {
            diagnostics: report.diagnostics,
            out: new TextDecoder().decode(child.stdout),
            err: new TextDecoder().decode(child.stderr),
          },
          null,
          2,
        ),
      );
      const summary = summarize(report);
      assertEquals(summary.tests, 10);
      assertEquals(
        summary.passed,
        7,
        JSON.stringify(
          {
            diagnostics: report.diagnostics,
            xml: await Deno.readTextFile(join(path, "runner.junit.xml")),
            out: new TextDecoder().decode(child.stdout),
          },
          null,
          2,
        ),
      );
      assertEquals(summary.skipped, 2);
      assertEquals(summary.failed, 1);
      assertEquals(
        report.records.find((r) => r.name === "namedCallback")?.runnerStatus,
        "passed",
      );
      assertEquals(report.records.find((r) => r.name === "namedOption")?.path, [
        "options suite",
        "namedOption",
      ]);
      assert(
        report.records.some((r) =>
          r.kind === "hook" && r.name === "afterAll" && r.status === "failed"
        ),
      );
      assert(
        report.records.some((r) =>
          r.kind === "create" && r.status === "failed"
        ),
      );
      assert(
        report.records.filter((r) => r.kind === "call").every((r) => r.testId),
      );
      assertStringIncludes(
        await Deno.readTextFile(join(path, "report.html")),
        "Colibri test evidence",
      );
      const again = await aggregate(path);
      assertEquals(again, report);
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
