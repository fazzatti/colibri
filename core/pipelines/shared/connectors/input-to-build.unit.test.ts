import { assertEquals, assertStrictEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Memo, Networks, Operation } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { createInputToBuild } from "@/pipelines/shared/connectors/input-to-build.ts";
import { LocalSigner } from "@/signer/local/index.ts";

describe("transaction input memo forwarding", () => {
  it("preserves the native Memo object for every SDK memo type", () => {
    const signer = LocalSigner.generateRandom();
    const connect = createInputToBuild(
      new Server("https://rpc.example.com"),
      Networks.TESTNET,
    );
    for (
      const memo of [
        undefined,
        Memo.none(),
        Memo.text(""),
        Memo.text("deposit"),
        Memo.id("0"),
        Memo.id("18446744073709551615"),
        Memo.hash(new Uint8Array(32)),
        Memo.return(new Uint8Array(32).fill(255)),
      ]
    ) {
      const operations = [Operation.manageData({ name: "memo", value: null })];
      const input = {
        operations,
        config: {
          source: signer.publicKey(),
          fee: "100" as const,
          timeout: 30,
          memo,
          signers: [signer],
        },
      };
      const result = connect(input);
      assertStrictEquals(result.memo, memo);
      assertStrictEquals(result.operations, operations);
      assertEquals(result.baseFee, "100");
      assertEquals(result.preconditions, { timeoutSeconds: 30 });
    }
  });
});
