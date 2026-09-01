import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Keypair, Networks } from "stellar-sdk";
import { calculateContractId } from "@/common/helpers/calculate-contract-id.ts";

describe("calculateContractId", () => {
  const source = Keypair.fromRawEd25519Seed(new Uint8Array(32)).publicKey();

  it("preserves the canonical contract-ID preimage bytes", () => {
    assertEquals(
      calculateContractId(Networks.TESTNET, source, new Uint8Array(32)),
      "CCR4Y5HVH4S47RK4Y6XEPJRPW5VZSKYKUDI3FM6I7HML2TGLQRR73BDQ",
    );
  });

  it("reads only the selected bytes from a non-zero-offset view", () => {
    const backing = new Uint8Array(40);
    backing.fill(7, 4, 36);

    assertEquals(
      calculateContractId(
        Networks.TESTNET,
        source,
        new DataView(backing.buffer, 4, 32),
      ),
      "CCEYIISWJXNZVSDEUXPIZMTGKBIGY34XFTZ4DNEAO4FKCYT4POI4T3SS",
    );
  });
});
