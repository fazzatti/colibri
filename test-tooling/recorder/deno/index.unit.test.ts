import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "node:path";
import { aggregate } from "@/recorder/deno/aggregate.ts";
import { summarize } from "@/recorder/report/aggregate.ts";
import { TestRecorder } from "@/recorder/deno/index.ts";

const recorderModule = new URL("./index.ts", import.meta.url).href;
const cli = new URL("../cli/index.ts", import.meta.url).pathname;
const config = new URL("../../../deno.json", import.meta.url).pathname;

describe("Deno recorder lifecycle", () => {
  it("keeps memory-only configuration free from filesystem output", async () => {
    const recorder = new TestRecorder();
    assertEquals(recorder.directory, undefined);
    await recorder.flush();
    assertEquals(recorder.report().records, []);
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
        `import {recorder} from "./recording.ts"; const {describe,it,observer}=recorder.recordTests(import.meta.url);const suite=describe("flat");it(suite,"passes",()=>observer.log("second file"));it({name:"object test",fn:()=>observer.capture(()=>"result")});describe({name:"inline hooks",beforeAll:[()=>observer.log("inline setup")],afterAll:()=>observer.log("inline teardown"),fn:()=>it("inline test",()=>{})});`,
      );
      await Deno.writeTextFile(
        join(directory, "ignored.test.ts"),
        `import {recorder} from "./recording.ts";const {it}=recorder.recordTests(import.meta.url);it.ignore("only ignored",()=>{});`,
      );
      const child = await new Deno.Command(Deno.execPath(), {
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
      assertEquals(child.code, 1, new TextDecoder().decode(child.stderr));
      const runs = [...Deno.readDirSync(artifacts)];
      assertEquals(runs.length, 1);
      const path = join(artifacts, runs[0].name);
      const report = await aggregate(path, { html: true });
      assertEquals(report.exitCode, 1);
      assert(report.complete);
      const summary = summarize(report);
      assertEquals(summary.tests, 7);
      assertEquals(
        summary.passed,
        5,
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
