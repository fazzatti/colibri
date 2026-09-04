import type { MemoizePolicy } from "@/common/decorators/memoize/types.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { NetworkConfig } from "@/network/index.ts";
import type { InvokeContractOutput } from "@/pipelines/invoke-contract/types.ts";
import type {
  ContractId,
  Ed25519PublicKey,
  MuxedAddress,
} from "@/strkeys/types.ts";
import type { xdr } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";

/** Account or contract address accepted by SEP-41 address parameters. */
export type SEP41Address = Ed25519PublicKey | ContractId;

/** Destination accepted by SEP-41 `transfer`, including muxed accounts. */
export type SEP41TransferDestination = SEP41Address | MuxedAddress;

/** Optional behavior for a {@link SEP41TokenContract} client. */
export type SEP41TokenContractOptions = {
  /** Cache policy for the stable `decimals`, `name`, and `symbol` reads. */
  cache?: MemoizePolicy;
};

/** Arguments used to bind a {@link SEP41TokenContract} to a deployed token. */
export type SEP41TokenContractConstructorArgs = {
  /** Network containing the deployed token contract. */
  networkConfig: NetworkConfig;
  /** Contract id of the SEP-41 token. */
  contractId: ContractId;
  /** Optional preconfigured RPC client. */
  rpc?: Server;
  /** Optional client behavior. */
  options?: SEP41TokenContractOptions;
};

/** Transaction inputs shared by state-changing SEP-41 methods. */
export type SEP41Invocation = {
  /** Colibri transaction configuration used by the invoke pipeline. */
  config: TransactionConfig;
  /** Optional preassembled Soroban authorization entries. */
  auth?: xdr.SorobanAuthorizationEntry[];
};

/** Result returned by a state-changing SEP-41 invocation. */
export type SEP41InvocationOutput =
  & Omit<
    InvokeContractOutput,
    "returnValue"
  >
  & { returnValue: undefined };

/** Inputs for reading an allowance. */
export type SEP41AllowanceArgs = {
  /** Address that owns the token balance. */
  from: SEP41Address;
  /** Address allowed to spend the balance. */
  spender: SEP41Address;
};

/** Inputs for setting an allowance. */
export type SEP41ApproveArgs = SEP41AllowanceArgs & SEP41Invocation & {
  /** Allowance amount in the token's smallest unit. */
  amount: bigint;
  /** Last ledger on which the allowance remains valid. */
  liveUntilLedger: number;
};

/** Inputs for reading a token balance. */
export type SEP41BalanceArgs = {
  /** Account or contract whose balance should be read. */
  id: SEP41Address;
};

/** Inputs for transferring tokens directly. */
export type SEP41TransferArgs = SEP41Invocation & {
  /** Address whose balance supplies the tokens. */
  from: SEP41Address;
  /** Account, contract, or muxed-account destination. */
  to: SEP41TransferDestination;
  /** Transfer amount in the token's smallest unit. */
  amount: bigint;
};

/** Inputs for transferring tokens through an allowance. */
export type SEP41TransferFromArgs = SEP41Invocation & {
  /** Address consuming the allowance. */
  spender: SEP41Address;
  /** Address whose balance supplies the tokens. */
  from: SEP41Address;
  /** Account or contract receiving the tokens. */
  to: SEP41Address;
  /** Transfer amount in the token's smallest unit. */
  amount: bigint;
};

/** Inputs for burning tokens directly. */
export type SEP41BurnArgs = SEP41Invocation & {
  /** Address whose balance should be burned. */
  from: SEP41Address;
  /** Burn amount in the token's smallest unit. */
  amount: bigint;
};

/** Inputs for burning tokens through an allowance. */
export type SEP41BurnFromArgs = SEP41Invocation & {
  /** Address consuming the allowance. */
  spender: SEP41Address;
  /** Address whose balance should be burned. */
  from: SEP41Address;
  /** Burn amount in the token's smallest unit. */
  amount: bigint;
};
