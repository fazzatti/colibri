import type { FeeBumpTransaction, Transaction } from "stellar-sdk";
import type { FeeBumpConfig } from "@/common/types/index.ts";

export type WrapFeeBumpInput = {
  transaction: Transaction;
  config: FeeBumpConfig;
  networkPassphrase: string;
};

export type WrapFeeBumpOutput = FeeBumpTransaction;
