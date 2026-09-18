import type { RunContext } from "convee";
import type { Collector } from "@/recorder/runtime/collector.ts";
import type {
  Attribution,
  EvidenceRecord,
  ExecutionEvidence,
  ObservationOptions,
  StageEvidence,
} from "@/recorder/types.ts";
import {
  authorization,
  confirmed,
  failed,
  object,
  operations,
  result,
  simulation,
  submitted,
} from "@/recorder/profiling/extract.ts";

interface Invocation {
  record: EvidenceRecord;
  started: number;
  simulation?: unknown;
}
interface Stage {
  invocation: Invocation;
  record: StageEvidence;
  started: number;
}
function kind(id: string): ExecutionEvidence["kind"] {
  const kinds: Record<string, ExecutionEvidence["kind"]> = {
    ReadFromContractPipeline: "read",
    InvokeContractPipeline: "invoke",
    ClassicTransactionPipeline: "classic",
  };
  return kinds[id] ?? "custom";
}
/** Mutable lifecycle state is private to one pipeline attachment. */
export class PipelineObserver {
  readonly roots = new WeakMap<RunContext, Invocation>();
  readonly active = new Map<string, Set<Invocation>>();
  readonly stages = new WeakMap<RunContext, Stage>();
  constructor(
    readonly collector: Collector,
    readonly fallback: Attribution,
    readonly options: ObservationOptions,
    readonly id: string,
  ) {}
  input(ctx: RunContext, args: unknown[]): void {
    const record = this.collector.record("execution", this.id, this.fallback);
    record.execution = {
      kind: kind(this.id),
      client: this.options.name,
      network: this.options.network?.networkPassphrase,
      operations: [],
      chain: "not-submitted",
      stages: [],
      simulations: [],
    };
    const params = operations(record.execution, args[0], this.collector);
    record.name = `${record.execution.kind} ${
      record.execution.method ??
        (record.execution.operations.join(", ") || "transaction")
    }`;
    if (
      ["details", "trace"].includes(this.collector.options.capture ?? "results")
    ) {
      record.data = this.collector.safe({
        parameters: params,
        metadata: this.options.metadata,
      });
    }
    const invocation = { record, started: performance.now() };
    this.roots.set(ctx, invocation);
    const set = this.active.get(ctx.runId) ?? new Set();
    set.add(invocation);
    this.active.set(ctx.runId, set);
    this.collector.emit(record);
  }
  output(ctx: RunContext, value: unknown): void {
    const invocation = this.roots.get(ctx);
    if (!invocation) return;
    invocation.record.status = "passed";
    if (this.collector.options.capture !== "summary") {
      invocation.record.data = this.collector.safe({
        input: invocation.record.data,
        result: result(value),
      });
    }
    confirmed(value, invocation.record.execution!, this.collector);
  }
  error(ctx: RunContext, error: Error): void {
    const invocation = this.roots.get(ctx);
    if (!invocation) return;
    invocation.record.status = "failed";
    if (this.collector.options.capture !== "summary") {
      invocation.record.error = this.collector.safe(error);
    }
  }
  finish(ctx: RunContext): void {
    const invocation = this.roots.get(ctx);
    if (!invocation) return;
    invocation.record.endedAt = new Date().toISOString();
    if (this.collector.options.profiling?.timings) {
      invocation.record.durationMs = performance.now() - invocation.started;
    }
    if (invocation.record.status === "running") {
      invocation.record.status = "unknown";
    }
    this.collector.emit(invocation.record);
    this.active.get(ctx.runId)?.delete(invocation);
    if (!this.active.get(ctx.runId)?.size) this.active.delete(ctx.runId);
  }
  stageInput(ctx: RunContext, args: unknown[], id: string): void {
    const candidates = this.active.get(ctx.runId);
    if (!candidates || candidates.size !== 1) {
      this.collector.diagnostic(
        "Overlapping or unavailable Convee contexts: stage attribution unavailable.",
      );
      return;
    }
    const invocation = [...candidates][0];
    const record: StageEvidence = {
      name: id,
      startedAt: new Date().toISOString(),
      status: "running",
    };
    if (this.collector.options.capture === "trace") {
      record.input = this.collector.safe(args);
    }
    this.stages.set(ctx, { invocation, record, started: performance.now() });
    invocation.record.execution!.stages.push(record);
    if (id === "build-transaction") {
      operations(invocation.record.execution!, args[0], this.collector);
      const network = object(args[0]).networkPassphrase;
      if (typeof network === "string") {
        invocation.record.execution!.network = network;
      }
    }
    if (id === "send-transaction") {
      submitted(args[0], invocation.record.execution!, this.collector);
    }
  }
  stageOutput(ctx: RunContext, value: unknown, id: string): void {
    const stage = this.stages.get(ctx);
    if (!stage) return;
    stage.record.status = "passed";
    if (this.collector.options.capture === "trace") {
      stage.record.output = this.collector.safe(result(value));
    }
    const execution = stage.invocation.record.execution!;
    if (
      ["simulate-transaction", "enforce-simulation"].includes(id) &&
      value !== stage.invocation.simulation
    ) {
      const profile = simulation(value, id, this.collector);
      if (profile) execution.simulations.push(profile);
      stage.invocation.simulation = value;
      execution.authorization = authorization(
        object(object(value).result).auth,
        this.collector,
      );
    }
    if (id === "sign-auth-entries") {
      execution.authorization = authorization(value, this.collector);
    }
    if (id === "send-transaction") confirmed(value, execution, this.collector);
  }
  stageError(ctx: RunContext, error: Error, id: string): void {
    const stage = this.stages.get(ctx);
    if (!stage) return;
    stage.record.status = "failed";
    if (this.collector.options.capture !== "summary") {
      stage.record.error = this.collector.safe(error);
    }
    if (["simulate-transaction", "enforce-simulation"].includes(id)) {
      const response =
        object(object(object(error).meta).data).simulationResponse;
      if (response && response !== stage.invocation.simulation) {
        const profile = simulation(response, id, this.collector);
        if (profile) {
          stage.invocation.record.execution!.simulations.push(profile);
        }
        stage.invocation.simulation = response;
      }
    }
    if (id === "send-transaction") {
      failed(error, stage.invocation.record.execution!, this.collector);
    }
  }
  stageFinish(ctx: RunContext): void {
    const stage = this.stages.get(ctx);
    if (stage && this.collector.options.profiling?.timings) {
      stage.record.durationMs = performance.now() - stage.started;
    }
  }
}
