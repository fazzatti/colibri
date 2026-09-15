import type { Contract } from "@colibri/core/contract";
/** Generated bound read method. */
export type ReadMethod = { read: (...args: never[]) => Promise<unknown> };
/** Generated bound invoke method. */
export type InvokeMethod = { invoke: (args: never) => Promise<unknown> };
/** Generated client properties exposing a typed read helper. */
export type ReadMethodName<C> =
  & { [K in keyof C]: C[K] extends ReadMethod ? K : never }[keyof C]
  & string;
/** Generated client properties exposing a typed invoke helper. */
export type InvokeMethodName<C> =
  & {
    [K in keyof C]: C[K] extends InvokeMethod ? K : never;
  }[keyof C]
  & string;
/** Read arguments inferred from a generated per-method helper. */
export type ReadArgs<C, M extends keyof C> = C[M] extends ReadMethod
  ? Parameters<C[M]["read"]>
  : never;
/** Decoded read result inferred from a generated per-method helper. */
export type ReadResult<C, M extends keyof C> = C[M] extends ReadMethod
  ? Awaited<ReturnType<C[M]["read"]>>
  : never;
/** Invocation arguments inferred from a generated per-method helper. */
export type InvokeArgs<C, M extends keyof C> = C[M] extends InvokeMethod
  ? Parameters<C[M]["invoke"]>[0]
  : never;
/** Invocation metadata and decoded value inferred from a generated helper. */
export type InvokeResult<C, M extends keyof C> = C[M] extends InvokeMethod
  ? Awaited<ReturnType<C[M]["invoke"]>>
  : never;
/** Identity needed for correct contract query scoping. */
export type ContractIdentity = Pick<
  Contract,
  "networkConfig" | "getContractId" | "getSpec"
>;
