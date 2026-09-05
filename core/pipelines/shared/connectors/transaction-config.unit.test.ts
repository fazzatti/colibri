import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Keypair, Networks, Operation, SorobanDataBuilder } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { inputToBuild as classicInputToBuild } from "@/pipelines/classic-transaction/connectors.ts";
import { inputToBuild as invokeInputToBuild } from "@/pipelines/invoke-contract/connectors.ts";
import { buildTransaction } from "@/processes/build-transaction/index.ts";
import { assembleTransaction } from "@/processes/assemble-transaction/index.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";

describe("pipeline transaction configuration preservation", () => {
  const source = Keypair.random().publicKey() as Ed25519PublicKey;
  const extraSigner = Keypair.random().publicKey() as Ed25519PublicKey;
  const rpc = new Server("https://soroban-testnet.stellar.org");

  for (const timeout of [0, 60]) {
    for (const extraSigners of [undefined, [], [extraSigner]]) {
      for (const soroban of [false, true]) {
        it(`preserves timeout ${timeout} and ${extraSigners?.length ?? "absent"} extra signers through ${soroban ? "Soroban" : "classic"} assembly`, async () => {
          const config: TransactionConfig = {
            source,
            fee: "100",
            timeout,
            signers: [],
            extraSigners,
          };
          const operations = [
            soroban
              ? Operation.invokeContractFunction({
                contract:
                  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
                function: "transfer",
                args: [],
              })
              : Operation.manageData({ name: "timeout", value: "test" }),
          ];
          const connect = soroban ? invokeInputToBuild : classicInputToBuild;
          const { rpc: _rpc, ...input } = connect(rpc, Networks.TESTNET)({
            operations,
            config,
          });
          const before = Math.floor(Date.now() / 1000);
          const built = await buildTransaction({ ...input, sequence: "1" });
          const after = Math.floor(Date.now() / 1000);
          const transaction = soroban
            ? await assembleTransaction({
              transaction: built,
              sorobanData: new SorobanDataBuilder(),
              authEntries: [],
            })
            : built;
          assertEquals(transaction.timeBounds, built.timeBounds);
          const maxTime = Number(transaction.timeBounds?.maxTime);
          if (timeout === 0) assertEquals(maxTime, 0);
          else {assert(
              maxTime >= before + timeout && maxTime <= after + timeout,
            );}
          assertEquals(
            transaction.extraSigners?.length ?? 0,
            extraSigners?.length ?? 0,
          );
        });
      }
    }
  }
});
