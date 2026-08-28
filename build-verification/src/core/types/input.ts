import type { OutOfBandBuildRecipe } from "../recipe/types.ts";
import type { VerificationSource } from "./source.ts";
import type { VerificationTarget } from "./target.ts";

/** Arguments for strict metadata-driven SEP-58 verification. */
export type StrictVerificationInput = {
  readonly mode?: "strictSep58";
  readonly target: VerificationTarget;
  readonly source?: VerificationSource;
};

/** Arguments for explicitly caller-directed, out-of-band verification. */
export type OutOfBandVerificationInput = {
  readonly mode: "outOfBand";
  readonly target: VerificationTarget;
  readonly source: VerificationSource;
  readonly recipe: OutOfBandBuildRecipe;
};

/** All supported contract build-verification inputs. */
export type ContractBuildVerificationInput =
  | StrictVerificationInput
  | OutOfBandVerificationInput;

/** Normalized verification modes carried through the pipeline. */
export type ContractBuildVerificationMode = "strictSep58" | "outOfBand";

const redactedLocator = (value: string): string => {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return value;
  }
};

/** Produces a byte- and credential-free request view for error metadata. */
export const redactContractBuildVerificationInput = (
  input: ContractBuildVerificationInput,
): Readonly<Record<string, unknown>> => {
  const target = "wasm" in input.target
    ? {
      kind: "wasm",
      label: input.target.label,
      wasmLength: input.target.wasm.length,
    }
    : "wasmHash" in input.target
    ? { kind: "wasmHash", ...input.target }
    : { kind: "contractId", ...input.target };
  const source = input.source
    ? input.source.type === "archive"
      ? {
        type: "archive",
        name: input.source.name,
        size: input.source.bytes.length,
        format: input.source.format,
      }
      : input.source.type === "url"
      ? { type: "url", url: redactedLocator(input.source.url) }
      : input.source
    : undefined;
  return {
    mode: input.mode ?? "strictSep58",
    target,
    source,
    ...("recipe" in input ? { recipe: input.recipe } : {}),
  };
};
