import { plugin, type RunContext } from "convee";
import type { Collector } from "@/recorder/runtime/collector.ts";
import type { Attribution, ObservationOptions } from "@/recorder/types.ts";
import { PipelineObserver } from "@/recorder/runtime/pipeline-observer.ts";

/** Public extension points shared by Colibri's callable pipelines. */
export interface ObservablePipeline {
  readonly id: string;
  readonly steps: readonly { id: string }[];
  use: (observer: never) => unknown;
}
interface Hooks {
  input(ctx: RunContext, args: unknown[]): void;
  output(ctx: RunContext, value: unknown): void;
  error(ctx: RunContext, error: Error): void;
  finish(ctx: RunContext): void;
}
function install(
  pipeline: ObservablePipeline,
  collector: Collector,
  id: string,
  hooks: Hooks,
  target?: string,
): void {
  const observer = plugin({ id, target }).onInput(
    function (...args: unknown[]) {
      collector.guard(() => hooks.input(this.context(), args));
      return args;
    },
  )
    .onOutput(function (value: unknown) {
      collector.guard(() => hooks.output(this.context(), value));
      return value;
    })
    .onError(function (error: Error) {
      collector.guard(() => hooks.error(this.context(), error));
      return error;
    })
    .onFinally(function () {
      collector.guard(() => hooks.finish(this.context()));
    });
  pipeline.use(observer as never);
}
/** Attach root and direct-step observers, preserving original tuples, values and errors. */
export function attachPipeline(
  pipeline: ObservablePipeline,
  collector: Collector,
  fallback: Attribution,
  options: ObservationOptions,
): void {
  const runtime = new PipelineObserver(
    collector,
    fallback,
    options,
    pipeline.id,
  );
  const id = `recorder-${collector.fragmentId}`;
  install(pipeline, collector, id, runtime);
  for (const step of pipeline.steps) {
    install(pipeline, collector, `${id}-${step.id}`, {
      input: (ctx, args) => runtime.stageInput(ctx, args, step.id),
      output: (ctx, value) => runtime.stageOutput(ctx, value, step.id),
      error: (ctx, error) => runtime.stageError(ctx, error, step.id),
      finish: (ctx) => runtime.stageFinish(ctx),
    }, step.id);
  }
}
