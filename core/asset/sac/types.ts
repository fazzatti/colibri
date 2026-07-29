import type { xdr } from "stellar-sdk";
import type { Asset } from "stellar-sdk";
import type {
  Address,
  TransactionConfig,
} from "@/common/types/transaction-config/types.ts";
import type { MemoizePolicy } from "@/common/decorators/memoize/types.ts";
import type { NetworkConfig } from "@/network/index.ts";
import type { InvokeContractOutput } from "@/pipelines/invoke-contract/types.ts";
import type { ContractId, Ed25519PublicKey } from "@/strkeys/types.ts";
import type { Server } from "stellar-sdk/rpc";

/**
 * Optional behavior modifiers for a `StellarAssetContract` instance.
 */
export type StellarAssetContractOptions = {
  /**
   * Memoization settings applied to stable descriptive reads.
   *
   * The current implementation applies this cache policy to `decimals()`,
   * `name()`, and `symbol()`.
   */
  cache?: MemoizePolicy;
};

type StellarAssetContractBaseArgs = {
  networkConfig: NetworkConfig;
  rpc?: Server;
  options?: StellarAssetContractOptions;
};

type StellarAssetIdentity =
  | {
    code: string;
    issuer: Ed25519PublicKey | "native";
  }
  | {
    asset: Asset;
  };

/**
 * Constructor arguments for a `StellarAssetContract`.
 *
 * A SAC client can be created either from the classic asset identity
 * (`code` + `issuer`, or a `stellar-sdk` `Asset`) or from a known contract id.
 */
/** @internal */
export type StellarAssetContractConstructorArgs =
  | (StellarAssetContractBaseArgs & StellarAssetIdentity)
  | (StellarAssetContractBaseArgs & {
    contractId: ContractId;
  });

/**
 * Arguments for creating a SAC client from a classic asset identity.
 */
/** @internal */
export type StellarAssetContractFromAssetArgs =
  & StellarAssetContractBaseArgs
  & StellarAssetIdentity;

/**
 * Arguments for creating a SAC client from an existing contract id.
 */
/** @internal */
export type StellarAssetContractFromContractIdArgs =
  & StellarAssetContractBaseArgs
  & {
    contractId: ContractId;
  };

/**
 * Arguments for creating the native XLM SAC client.
 */
/** @internal */
export type StellarAssetContractNativeArgs = StellarAssetContractBaseArgs;

/**
 * Arguments for deploying a classic asset into its SAC representation.
 */
/** @internal */
export type DeployStellarAssetContractArgs =
  & StellarAssetContractFromAssetArgs
  & {
    config: TransactionConfig;
  };

/** @internal */
export type BaseInvocation = {
  config: TransactionConfig;
  auth?: xdr.SorobanAuthorizationEntry[];
};

type InvokeOutput<V> = Omit<InvokeContractOutput, "returnValue"> & {
  returnValue: V;
};

/**
 * SAC (Stellar Asset Contract) Methods
 *
 * Based on CAP-0046-06 and CAP-0073:
 * https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-06.md
 * https://github.com/stellar/stellar-protocol/blob/master/core/cap-0073.md
 */
export enum Method {
  // Descriptive Interface
  Decimals = "decimals",
  Name = "name",
  Symbol = "symbol",

  // Token Interface
  Allowance = "allowance",
  Approve = "approve",
  Balance = "balance",
  Authorized = "authorized",
  Trust = "trust",
  Transfer = "transfer",
  TransferFrom = "transfer_from",
  Burn = "burn",
  BurnFrom = "burn_from",

  // Admin Interface
  SetAdmin = "set_admin",
  Admin = "admin",
  SetAuthorized = "set_authorized",
  Mint = "mint",
  Clawback = "clawback",
}

/**
 * Input types for SAC contract methods that require arguments.
 */
/** @internal */
export type ContractInput = {
  // Token Interface
  [Method.Allowance]: {
    from: Address;
    spender: Address;
  };
  [Method.Approve]: {
    from: Address;
    spender: Address;
    amount: bigint;
    expirationLedger: number;
  };
  [Method.Balance]: {
    id: Address;
  };
  [Method.Authorized]: {
    id: Address;
  };
  [Method.Trust]: {
    address: Address;
  };
  [Method.Transfer]: {
    from: Address;
    to: Address;
    amount: bigint;
  };
  [Method.TransferFrom]: {
    spender: Address;
    from: Address;
    to: Address;
    amount: bigint;
  };
  [Method.Burn]: {
    from: Address;
    amount: bigint;
  };
  [Method.BurnFrom]: {
    spender: Address;
    from: Address;
    amount: bigint;
  };

  // Admin Interface
  [Method.SetAdmin]: {
    newAdmin: Address;
  };
  [Method.SetAuthorized]: {
    id: Address;
    authorize: boolean;
  };
  [Method.Mint]: {
    to: Address;
    amount: bigint;
  };
  [Method.Clawback]: {
    from: Address;
    amount: bigint;
  };
};

/**
 * Output types for SAC contract methods.
 */
/** @internal */
export type ContractOutput = {
  // Descriptive Interface (read-only)
  [Method.Decimals]: number;
  [Method.Name]: string;
  [Method.Symbol]: string;

  // Token Interface (read-only)
  [Method.Allowance]: bigint;
  [Method.Balance]: bigint;
  [Method.Authorized]: boolean;
  [Method.Admin]: Address;

  // Token Interface (invoke)
  [Method.Approve]: InvokeOutput<undefined>;
  [Method.Trust]: InvokeOutput<undefined>;
  [Method.Transfer]: InvokeOutput<undefined>;
  [Method.TransferFrom]: InvokeOutput<undefined>;
  [Method.Burn]: InvokeOutput<undefined>;
  [Method.BurnFrom]: InvokeOutput<undefined>;

  // Admin Interface (invoke)
  [Method.SetAdmin]: InvokeOutput<undefined>;
  [Method.SetAuthorized]: InvokeOutput<undefined>;
  [Method.Mint]: InvokeOutput<undefined>;
  [Method.Clawback]: InvokeOutput<undefined>;
};
