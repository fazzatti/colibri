/**
 * Client for the standardized SEP-41 token interface.
 *
 * @module
 */

// deno-coverage-ignore-start — Babel decorator helpers are injected during transpilation.
import { memoize } from "@/common/decorators/memoize/index.ts";
import { Contract } from "@/contract/index.ts";
// deno-coverage-ignore-stop
import { decodeTokenValue } from "@/asset/token-value.ts";
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
import { nativeToScVal } from "stellar-sdk";

type ScValEncodingOptions = NonNullable<
  Parameters<typeof nativeToScVal>[1]
>;

const encodeArgument = (
  value: unknown,
  options: ScValEncodingOptions,
  error: (cause: Error) => E.SEP41TokenError,
): ReturnType<typeof nativeToScVal> => {
  try {
    return nativeToScVal(value, options);
  } catch (cause) {
    throw error(cause as Error);
  }
};

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
      encodeArgument(
        from,
        { type: "address" },
        (cause) => new E.FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_FROM(from, cause),
      ),
      encodeArgument(
        spender,
        { type: "address" },
        (cause) =>
          new E.FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_SPENDER(spender, cause),
      ),
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
        encodeArgument(
          from,
          { type: "address" },
          (cause) => new E.FAILED_TO_ENCODE_APPROVE_ARGUMENT_FROM(from, cause),
        ),
        encodeArgument(
          spender,
          { type: "address" },
          (cause) =>
            new E.FAILED_TO_ENCODE_APPROVE_ARGUMENT_SPENDER(spender, cause),
        ),
        encodeArgument(
          amount,
          { type: "i128" },
          (cause) =>
            new E.FAILED_TO_ENCODE_APPROVE_ARGUMENT_AMOUNT(amount, cause),
        ),
        encodeArgument(
          liveUntilLedger,
          { type: "u32" },
          (cause) =>
            new E.FAILED_TO_ENCODE_APPROVE_ARGUMENT_LIVE_UNTIL_LEDGER(
              liveUntilLedger,
              cause,
            ),
        ),
      ],
      config,
      auth,
    );
  }

  /** Returns the balance held by an account or contract address. */
  async balance({ id }: SEP41BalanceArgs): Promise<bigint> {
    return await this.readRequired(Method.Balance, [
      encodeArgument(
        id,
        { type: "address" },
        (cause) => new E.FAILED_TO_ENCODE_BALANCE_ARGUMENT_ID(id, cause),
      ),
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
        encodeArgument(
          from,
          { type: "address" },
          (cause) => new E.FAILED_TO_ENCODE_TRANSFER_ARGUMENT_FROM(from, cause),
        ),
        encodeArgument(
          to,
          { type: "address" },
          (cause) => new E.FAILED_TO_ENCODE_TRANSFER_ARGUMENT_TO(to, cause),
        ),
        encodeArgument(
          amount,
          { type: "i128" },
          (cause) =>
            new E.FAILED_TO_ENCODE_TRANSFER_ARGUMENT_AMOUNT(amount, cause),
        ),
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
        encodeArgument(
          spender,
          { type: "address" },
          (cause) =>
            new E.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_SPENDER(
              spender,
              cause,
            ),
        ),
        encodeArgument(
          from,
          { type: "address" },
          (cause) =>
            new E.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_FROM(from, cause),
        ),
        encodeArgument(
          to,
          { type: "address" },
          (cause) =>
            new E.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_TO(to, cause),
        ),
        encodeArgument(
          amount,
          { type: "i128" },
          (cause) =>
            new E.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_AMOUNT(amount, cause),
        ),
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
        encodeArgument(
          from,
          { type: "address" },
          (cause) => new E.FAILED_TO_ENCODE_BURN_ARGUMENT_FROM(from, cause),
        ),
        encodeArgument(
          amount,
          { type: "i128" },
          (cause) => new E.FAILED_TO_ENCODE_BURN_ARGUMENT_AMOUNT(amount, cause),
        ),
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
        encodeArgument(
          spender,
          { type: "address" },
          (cause) =>
            new E.FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_SPENDER(spender, cause),
        ),
        encodeArgument(
          from,
          { type: "address" },
          (cause) =>
            new E.FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_FROM(from, cause),
        ),
        encodeArgument(
          amount,
          { type: "i128" },
          (cause) =>
            new E.FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_AMOUNT(amount, cause),
        ),
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
    return decodeTokenValue<Output>(
      result,
      new E.MISSING_RETURN_VALUE(method),
    );
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
