import assert from "node:assert/strict";
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TestRecorder } from "@colibri/test-tooling/recorder/node";
import { renderReport } from "@colibri/test-tooling/recorder/report";

// Stay below the installed consumer so fixtures resolve the same npm packages.
const directory = await mkdtemp(join(process.cwd(), "recorder-fixture-"));
const cli = fileURLToPath(
  import.meta.resolve("@colibri/test-tooling/recorder/cli"),
);
const run = (args, code = 0) => {
  const result = spawnSync(process.execPath, args, {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(result.status, code, result.stdout + result.stderr);
  return result;
};
try {
  const memory = new TestRecorder();
  await memory.flush();
  assert.equal(memory.directory, undefined);
  assert.deepEqual(memory.report().records, []);
  assert.deepEqual(await readdir(directory), []);
  await writeFile(
    join(directory, "recording.mjs"),
    `
import {TestRecorder} from '@colibri/test-tooling/recorder/node';
export const recorder = new TestRecorder({capture:'trace',events:'full',authorization:{level:'full',signatures:false},profiling:{timings:true,resources:true,fees:true},output:{json:{directory:'./evidence'},html:true,summary:true}});
`,
  );
  const common = `
import assert from 'node:assert/strict';
import {setTimeout as pause} from 'node:timers/promises';
import {pipe,step} from '@jsr/fifo__convee';
import {Contract,NetworkConfig} from '@colibri/core';
import {Address,SorobanDataBuilder,xdr} from '@stellar/stellar-sdk';
import {Server} from '@stellar/stellar-sdk/rpc';
import {Spec} from '@stellar/stellar-sdk/contract';
import {recorder} from './recording.mjs';
const {describe,it,beforeAll,afterAll,beforeEach,afterEach,observer}=recorder.recordTests(import.meta.url);
assert.equal(recorder.recordTests(import.meta.url).observer,observer);
describe('same suite',{concurrency:true},async()=>{
 await pause(1);
 beforeAll(()=>observer.log('setup'));
 afterAll(()=>observer.log('teardown'));
 beforeEach(()=>observer.log('before'));
 afterEach(()=>observer.log('after'));
 for(const label of ['alpha','beta']) it(label,async()=>{
  const output={balance:9n};
  const pipeline=pipe([step(async()=>{await pause(label==='alpha'?12:2);return output;},{id:'balance'})],{id:'ReadFromContractPipeline'});
  assert.equal(observer.attach(pipeline),pipeline);
  assert.equal(await pipeline(),output);
  observer.log(label,{file:import.meta.url});
  assert.equal(observer.capture(()=>7),7);
  const error=new Error('expected');
  assert.throws(()=>observer.create(()=>{throw error}),e=>e===error);
 });
 it('contract',async()=>{
  const rpc=new Server('https://rpc.example.org');
  rpc.simulateTransaction=async()=>({_parsed:true,id:'sim',latestLedger:100,events:[],transactionData:new SorobanDataBuilder(),minResourceFee:'100',result:{auth:[],retval:xdr.ScVal.scvU32(7)}});
  const spec=new Spec([xdr.ScSpecEntry.scSpecEntryFunctionV0(new xdr.ScSpecFunctionV0({doc:'',name:'balance',inputs:[],outputs:[xdr.ScSpecTypeDef.scSpecTypeU32()]}))]);
  const client=observer.create(()=>new Contract({networkConfig:NetworkConfig.TestNet(),rpc,contractConfig:{contractId:Address.contract(new Uint8Array(32)).toString(),spec}}));
  assert.equal(observer.attach(client),client);
  assert.equal(await observer.capture(()=>client.read({method:'balance'})),7);
 });
 it.skip('skip',()=>{throw Error('must not run')});
 it.ignore('ignored',()=>{throw Error('must not run')});
 it.todo('todo');
 it('callback',(_t,done)=>{observer.log('callback');done()});
 it('runtime skip',t=>t.skip('optional'));
});
`;
  for (const file of ["one.test.mjs", "two.test.mjs"]) {
    await writeFile(join(directory, file), common);
  }
  await writeFile(
    join(directory, "failure.test.mjs"),
    `
import {recorder} from './recording.mjs';
const {describe,it,beforeAll,afterAll,afterEach}=recorder.recordTests(import.meta.url);
describe('teardown',()=>{afterEach(()=>{throw Error('afterEach failure')});it('body passes',()=>{});});
describe('setup fails',()=>{beforeAll(()=>{throw Error('beforeAll failure')});it('never starts',()=>{});});
describe('suite teardown',()=>{it('body succeeds',()=>{});afterAll(()=>{throw Error('afterAll failure')});});
it('callback throws',(_t,_done)=>{throw Error('callback failure')});
it('callback rejects',(_t,done)=>done(Error('done failure')));
it('throws falsy',()=>{throw undefined});
it('times out',{timeout:10},()=>new Promise(resolve=>setTimeout(resolve,40)));
`,
  );
  run([
    cli,
    "run",
    "--config=recording.mjs",
    "--",
    "--test-concurrency=3",
    "one.test.mjs",
    "two.test.mjs",
    "failure.test.mjs",
  ], 1);
  const [runId] = await readdir(join(directory, "evidence"));
  const runDir = join(directory, "evidence", runId);
  const report = JSON.parse(
    await readFile(join(runDir, "report.json"), "utf8"),
  );
  assert.equal(report.exitCode, 1);
  const tests = report.records.filter((r) => r.kind === "test");
  assert(
    !report.diagnostics.some((s) => s.includes("No unique Node runner result")),
    report.diagnostics.join("\n"),
  );
  for (const file of ["one.test.mjs", "two.test.mjs"]) {
    const own = tests.filter((r) => r.file.endsWith(file));
    assert.equal(own.length, 8);
    for (const name of ["alpha", "beta", "callback", "contract"]) {
      assert.equal(own.find((r) => r.name === name).runnerStatus, "passed");
    }
    for (const name of ["skip", "ignored", "todo", "runtime skip"]) {
      assert.equal(own.find((r) => r.name === name).runnerStatus, "skipped");
    }
  }
  for (
    const name of [
      "body passes",
      "never starts",
      "callback throws",
      "callback rejects",
      "throws falsy",
      "times out",
    ]
  ) {
    assert.equal(
      tests.find((r) => r.name === name).runnerStatus,
      "failed",
      name,
    );
  }
  assert.equal(tests.find((r) => r.name === "body passes").status, "passed");
  assert.equal(tests.find((r) => r.name === "throws falsy").status, "failed");
  const calls = report.records.filter((r) => r.execution);
  assert.equal(calls.length, 6);
  for (const call of calls) {
    const owner = report.records.find((r) => r.id === call.testId);
    assert.equal(owner.file, call.file);
    assert(["alpha", "beta", "contract"].includes(owner.name));
    assert.equal(call.execution.kind, "read");
    assert(call.durationMs >= 0);
    assert.equal(call.execution.stages[0].status, "passed");
    if (owner.name !== "contract") assert.equal(call.data.result.balance, "9");
    else { assert.equal(call.execution.network,"Test SDF Network ; September 2015"); assert.equal(call.execution.method,"balance"); }
  }
  assert((await readdir(join(runDir, "fragments"))).length >= 3);
  assert(
    (await readFile(join(runDir, "report.html"), "utf8")).includes(
      "Colibri test evidence",
    ),
  );
  const snapshot = JSON.stringify(report);
  run([cli, "aggregate", runDir, "--html"]);
  assert.equal(
    JSON.stringify(
      JSON.parse(await readFile(join(runDir, "report.json"), "utf8")),
    ),
    snapshot,
  );
  assert(renderReport(report).includes("Colibri test evidence"));
  // A successful run and an isolated ignored-only file retain native exit semantics.
  run([cli, "run", "--config=recording.mjs", "--", "one.test.mjs"]);
  await writeFile(
    join(directory, "ignored.test.mjs"),
    `import {recorder} from './recording.mjs'; recorder.recordTests(import.meta.url).it.skip('all skipped',()=>{});`,
  );
  run([cli, "run", "--config=recording.mjs", "--", "ignored.test.mjs"]);
  // The same CLI supports summary-only output without retaining a directory.
  await writeFile(
    join(directory, "memory.mjs"),
    `import {TestRecorder} from '@colibri/test-tooling/recorder/node';export const recorder=new TestRecorder({output:{summary:true}});`,
  );
  await writeFile(
    join(directory, "memory.test.mjs"),
    `import {recorder} from './memory.mjs';recorder.recordTests(import.meta.url).it('memory',()=>{});`,
  );
  const before = await readdir(directory);
  const output = run([
    cli,
    "run",
    "--config=memory.mjs",
    "--",
    "memory.test.mjs",
  ]);
  assert(output.stdout.includes("Colibri evidence:"));
  assert(!output.stdout.includes("Colibri report:"));
  assert.deepEqual(await readdir(directory), before);
  run([cli, "run", "--config=recording.mjs", "--", "--test-reporter=tap"], 1);
  run([cli, "run", "--config=recording.mjs", "--", "--test-isolation=none"], 1);
  console.log(
    "Installed Node recorder: parallel attribution, hooks, skips, callback errors, timeout, profiles, artifacts and CLI passed.",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
