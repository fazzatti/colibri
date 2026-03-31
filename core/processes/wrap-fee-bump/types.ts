import type { FeeBumpTransaction, Transaction } from "stellar-sdk";
import type { FeeBumpConfig } from "@/common/types/index.ts";

/** @internal */
export type WrapFeeBumpInput = {
  transaction: Transaction;
  config: FeeBumpConfig;
  networkPassphrase: string;
};

/** @internal */
export type WrapFeeBumpOutput = FeeBumpTransaction;
