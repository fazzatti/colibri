/**
 * Client for the standardized SEP-41 token interface.
 *
 * @module
 */

// deno-coverage-ignore-start — Babel decorator helpers are injected during transpilation.
import { memoize } from "@/common/decorators/memoize/index.ts";
import { Contract } from "@/contract/index.ts";
// deno-coverage-ignore-stop
import { assert } from "@/common/assert/assert.ts";
import { isDefined } from "@/common/type-guards/is-defined.ts";
import * as E from "@/asset/sep41-token/error.ts";
import type {
  SEP41AllowanceArgs,
  SEP41ApproveArgs,
  SEP41BalanceArgs,
  SEP41BurnArgs,
  SEP41BurnFromArgs,
  SEP41InvocationOutput,
  SEP41TokenContractConstructorArgs,
  SEP41TokenContractOptions,
  SEP41TransferArgs,
  SEP41TransferFromArgs,
} from "@/asset/sep41-token/types.ts";
import { nativeToScVal, scValToNative } from "stellar-sdk";

type ResolvedOptions = {
  cache: {
    enabled: boolean;
    ttl?: number;
    cacheRejected: boolean;
    evictOnExpiry: boolean;
  };
};

const resolveOptions = (
  options?: SEP41TokenContractOptions,
): ResolvedOptions => ({
  cache: {
    enabled: options?.cache?.enabled ?? true,
    ttl: options?.cache?.ttl,
    cacheRejected: options?.cache?.cacheRejected ?? false,
    evictOnExpiry: options?.cache?.evictOnExpiry ?? false,
  },
});

const Method = {
  Allowance: "allowance",
  Approve: "approve",
  Balance: "balance",
  Transfer: "transfer",
  TransferFrom: "transfer_from",
  Burn: "burn",
  BurnFrom: "burn_from",
  Decimals: "decimals",
  Name: "name",
  Symbol: "symbol",
} as const;

/**
 * High-level client for any deployed contract implementing SEP-41.
 *
 * The client deliberately contains only the standardized token interface.
 * Contract-specific functions remain accessible through {@link contract},
 * using `read`, `readRaw`, `invoke`, or `invokeRaw` as appropriate.
 *
 * @example Transfer tokens with Colibri's normal invoke pipeline.
 * ```ts
 * const token = new SEP41TokenContract({ networkConfig, contractId });
 * const result = await token.transfer({
 *   from: owner,
 *   to: recipient,
 *   amount: 1_000_000n,
 *   config,
 * });
 * ```
 */
export class SEP41TokenContract {
  /** Underlying general-purpose contract client for custom token methods. */
  readonly contract: Contract;

  /** Contract id of the deployed SEP-41 token. */
  readonly contractId: SEP41TokenContractConstructorArgs["contractId"];

  private readonly options: ResolvedOptions;

  /** Binds the client to a deployed SEP-41 token. */
  constructor(args: SEP41TokenContractConstructorArgs) {
    this.contractId = args.contractId;
    this.contract = new Contract({
      networkConfig: args.networkConfig,
      rpc: args.rpc,
      contractConfig: { contractId: args.contractId },
    });
    this.options = resolveOptions(args.options);
  }

  /** Returns the allowance granted by `from` to `spender`. */
  async allowance({ from, spender }: SEP41AllowanceArgs): Promise<bigint> {
    return await this.readRequired(Method.Allowance, [
      nativeToScVal(from, { type: "address" }),
      nativeToScVal(spender, { type: "address" }),
    ]);
  }

  /** Sets the allowance granted by `from` to `spender`. */
  async approve({
    from,
    spender,
    amount,
    liveUntilLedger,
    config,
    auth,
  }: SEP41ApproveArgs): Promise<SEP41InvocationOutput> {
    return await this.invokeVoid(
      Method.Approve,
      [
        nativeToScVal(from, { type: "address" }),
        nativeToScVal(spender, { type: "address" }),
        nativeToScVal(amount, { type: "i128" }),
        nativeToScVal(liveUntilLedger, { type: "u32" }),
      ],
      config,
      auth,
    );
  }

  /** Returns the balance held by an account or contract address. */
  async balance({ id }: SEP41BalanceArgs): Promise<bigint> {
    return await this.readRequired(Method.Balance, [
      nativeToScVal(id, { type: "address" }),
    ]);
  }

  /** Transfers tokens directly to an account, contract, or muxed account. */
  async transfer({
    from,
    to,
    amount,
    config,
    auth,
  }: SEP41TransferArgs): Promise<SEP41InvocationOutput> {
    return await this.invokeVoid(
      Method.Transfer,
      [
        nativeToScVal(from, { type: "address" }),
        nativeToScVal(to, { type: "address" }),
        nativeToScVal(amount, { type: "i128" }),
      ],
      config,
      auth,
    );
  }

  /** Transfers tokens by consuming an allowance granted to `spender`. */
  async transferFrom({
    spender,
    from,
    to,
    amount,
    config,
    auth,
  }: SEP41TransferFromArgs): Promise<SEP41InvocationOutput> {
    return await this.invokeVoid(
      Method.TransferFrom,
      [
        nativeToScVal(spender, { type: "address" }),
        nativeToScVal(from, { type: "address" }),
        nativeToScVal(to, { type: "address" }),
        nativeToScVal(amount, { type: "i128" }),
      ],
      config,
      auth,
    );
  }

  /** Burns tokens from an address after its authorization. */
  async burn({
    from,
    amount,
    config,
    auth,
  }: SEP41BurnArgs): Promise<SEP41InvocationOutput> {
    return await this.invokeVoid(
      Method.Burn,
      [
        nativeToScVal(from, { type: "address" }),
        nativeToScVal(amount, { type: "i128" }),
      ],
      config,
      auth,
    );
  }

  /** Burns tokens by consuming an allowance granted to `spender`. */
  async burnFrom({
    spender,
    from,
    amount,
    config,
    auth,
  }: SEP41BurnFromArgs): Promise<SEP41InvocationOutput> {
    return await this.invokeVoid(
      Method.BurnFrom,
      [
        nativeToScVal(spender, { type: "address" }),
        nativeToScVal(from, { type: "address" }),
        nativeToScVal(amount, { type: "i128" }),
      ],
      config,
      auth,
    );
  }

  /** Returns the number of decimal places used by the token. */
  @memoize({
    enabled: (self: SEP41TokenContract) => self.options.cache.enabled,
    ttl: (self: SEP41TokenContract) => self.options.cache.ttl,
    cacheRejected: (self: SEP41TokenContract) =>
      self.options.cache.cacheRejected,
    evictOnExpiry: (self: SEP41TokenContract) =>
      self.options.cache.evictOnExpiry,
  })
  async decimals(): Promise<number> {
    return await this.readRequired(Method.Decimals);
  }

  /** Returns the token's display name. */
  @memoize({
    enabled: (self: SEP41TokenContract) => self.options.cache.enabled,
    ttl: (self: SEP41TokenContract) => self.options.cache.ttl,
    cacheRejected: (self: SEP41TokenContract) =>
      self.options.cache.cacheRejected,
    evictOnExpiry: (self: SEP41TokenContract) =>
      self.options.cache.evictOnExpiry,
  })
  async name(): Promise<string> {
    return await this.readRequired(Method.Name);
  }

  /** Returns the token's display symbol. */
  @memoize({
    enabled: (self: SEP41TokenContract) => self.options.cache.enabled,
    ttl: (self: SEP41TokenContract) => self.options.cache.ttl,
    cacheRejected: (self: SEP41TokenContract) =>
      self.options.cache.cacheRejected,
    evictOnExpiry: (self: SEP41TokenContract) =>
      self.options.cache.evictOnExpiry,
  })
  async symbol(): Promise<string> {
    return await this.readRequired(Method.Symbol);
  }

  /** Reads and decodes a standardized result that must be present. @internal */
  private async readRequired<Output>(
    method: string,
    methodArgs?: Parameters<Contract["readRaw"]>[0]["methodArgs"],
  ): Promise<Output> {
    const result = await this.contract.readRaw({ method, methodArgs });
    assert(isDefined(result), new E.MISSING_RETURN_VALUE(method));
    return scValToNative(result) as Output;
  }

  /** Invokes one standardized method that returns void. @internal */
  private async invokeVoid(
    functionName: string,
    args: Parameters<Contract["invokeRaw"]>[0]["operationArgs"]["args"],
    config: Parameters<Contract["invokeRaw"]>[0]["config"],
    auth?: Parameters<Contract["invokeRaw"]>[0]["operationArgs"]["auth"],
  ): Promise<SEP41InvocationOutput> {
    const result = await this.contract.invokeRaw({
      operationArgs: { function: functionName, args, auth },
      config,
    });
    return { ...result, returnValue: undefined };
  }
}

export type * from "@/asset/sep41-token/types.ts";
