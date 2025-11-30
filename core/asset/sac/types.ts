import type { xdr } from "stellar-sdk";
import type {
  Address,
  TransactionConfig,
} from "@/common/types/transaction-config/types.ts";
import type { InvokeContractOutput } from "@/pipelines/invoke-contract/types.ts";

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
 * Based on CAP-0046-06:
 * https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-06.md
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
