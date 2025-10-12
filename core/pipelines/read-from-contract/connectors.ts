import { Keypair } from "stellar-sdk";
import type { BuildTransactionInput } from "../../processes/build-transaction/types.ts";
import type { Ed25519PublicKey } from "../../strkeys/types.ts";
import type { ReadFromContractInput } from "./types.ts";

export const inputToBuild = (networkPassphrase: string) => {
  return (input: ReadFromContractInput): BuildTransactionInput => {
    const { operations } = input;

    const source = Keypair.random().publicKey() as Ed25519PublicKey;

    return {
      baseFee: "10000000",
      source,
      networkPassphrase,
      operations,
      sequence: "1",
    };
  };
};
