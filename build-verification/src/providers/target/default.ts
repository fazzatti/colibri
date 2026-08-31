import { sha256Hex } from "@/core/comparison/index.ts";
import type {
  ResolvedVerificationTarget,
  VerificationNetwork,
} from "@/core/types/index.ts";
import type {
  NormalizedVerificationNetwork,
  VerificationTargetResolver,
  VerificationTargetResolverInput,
} from "@/providers/target/types.ts";
import {
  normalizeVerificationNetwork,
  StellarVerificationTargetResolver,
} from "@/providers/target/stellar.ts";

const nowIso = (): string => new Date().toISOString();

/** Default router for direct bytes, Wasm hashes, and contract IDs. */
export class DefaultVerificationTargetResolver
  implements VerificationTargetResolver {
  readonly #stellar: StellarVerificationTargetResolver;
  readonly #now: () => string;

  /** Creates a target router from optional public network inputs. */
  constructor(
    network?: VerificationNetwork | NormalizedVerificationNetwork,
    now: () => string = nowIso,
  ) {
    this.#now = now;
    this.#stellar = new StellarVerificationTargetResolver(
      network
        ? "ledgerEntries" in network
          ? network
          : normalizeVerificationNetwork(network)
        : undefined,
      now,
    );
  }

  /** Resolves a direct target locally or routes it to Stellar RPC. */
  async resolve(
    input: VerificationTargetResolverInput,
  ): Promise<ResolvedVerificationTarget> {
    if ("wasm" in input.target) {
      return {
        applicability: "wasm",
        kind: "wasm",
        label: input.target.label,
        wasm: Uint8Array.from(input.target.wasm),
        wasmHash: await sha256Hex(input.target.wasm),
        observedAt: this.#now(),
      };
    }
    return await this.#stellar.resolve(input);
  }
}
