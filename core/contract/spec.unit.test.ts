import { assertEquals, assertStrictEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Ok,
  type Result as NativeResult,
  Spec as NativeSpec,
} from "stellar-sdk/contract";
import {
  Contract,
  extractContractEventsFromSpec,
  NetworkConfig,
  type Result,
  Spec,
} from "@colibri/core";
import {
  bindingSpec,
  contractId,
} from "colibri-internal/tests/binding-fixtures.ts";

describe("public native spec compatibility", () => {
  it("retains constructor identity, static helpers and native instances", () => {
    assertStrictEquals(Spec, NativeSpec);
    assertStrictEquals(Spec.fromWasm, NativeSpec.fromWasm);
    const native: NativeSpec = bindingSpec();
    const publicSpec: Spec = native;
    const roundTrip: NativeSpec = new Spec(publicSpec.entries);
    assertEquals(roundTrip.funcs(), native.funcs());
    const contract = new Contract({
      networkConfig: NetworkConfig.TestNet(),
      contractConfig: { contractId, spec: publicSpec },
    });
    assertEquals(contract.events.list().length, 1);
    assertEquals(extractContractEventsFromSpec(native).list().length, 1);
  });
  it("retains the native Result contract in both directions", () => {
    const native: NativeResult<number, { message: string }> = new Ok(42);
    const result: Result<number> = native;
    const roundTrip: NativeResult<number, { message: string }> = result;
    assertStrictEquals(roundTrip, native);
    assertEquals(result.unwrap(), 42);
    assertEquals(result.isOk(), true);
  });
});
