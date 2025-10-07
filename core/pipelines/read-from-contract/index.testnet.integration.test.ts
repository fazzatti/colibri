import { assertEquals, assertExists, assertInstanceOf } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { TestNet } from "../../network/index.ts";
import { Asset, nativeToScVal, Operation, xdr } from "stellar-sdk";
import { createReadFromContractPipeline } from "./index.ts";

describe("[Testnet] ReadFromContract Pipeline", () => {
  const networkConfig = TestNet();
  const xlmContractId = Asset.native().contractId(
    networkConfig.networkPassphrase
  );

  it("should create a pipeline", () => {
    const readPipe = createReadFromContractPipeline({ networkConfig });
    assertInstanceOf(readPipe, Object);
    assertEquals(readPipe.name, "ReadFromContractPipeline");
  });
  it("should read from a contract and return the contract returned value", async () => {
    const readPipe = createReadFromContractPipeline({ networkConfig });
    const decimalsOp = Operation.invokeContractFunction({
      function: "decimals",
      contract: xlmContractId,
      args: [],
    });
    const resultVal = await readPipe.run({
      operations: [decimalsOp],
    });

    assertExists(resultVal);
    assertEquals(resultVal, nativeToScVal("7", { type: "u32" }));
  });

  it("should read from a contract and return 'scvVoid' for no returned value", async () => {
    const readPipe = createReadFromContractPipeline({ networkConfig });
    const decimalsOp = Operation.invokeContractFunction({
      function: "transfer",
      contract: xlmContractId,
      args: [
        nativeToScVal(xlmContractId, { type: "address" }),
        nativeToScVal(xlmContractId, { type: "address" }),
        nativeToScVal("0", { type: "i128" }),
      ],
    });
    const resultVal = await readPipe
      .run({
        operations: [decimalsOp],
      })
      .catch((e) => {
        console.log("Error:", e);
        throw e;
      });

    assertExists(resultVal);
    assertEquals(resultVal, xdr.ScVal.scvVoid());
  });
});
