import { assertEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  func,
  option,
  struct,
  udt,
  union,
} from "colibri-internal/tests/soroban-values-fixtures.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
import { xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import {
  analyzeContractInterface,
  Contract,
  ContractStandards,
  extractContractSpec,
  inspectContractStandards,
  matchesContractInterface,
  NetworkConfig,
} from "@/mod.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const address = xdr.ScSpecTypeDef.scSpecTypeAddress();
const i128 = xdr.ScSpecTypeDef.scSpecTypeI128();

describe("current SEP structural profiles", () => {
  it("keeps SEP-41 signatures and claims independent across standalone and Contract entrypoints", async () => {
    const wasm = await loadWasmFile(
      "_internal/tests/compiled-contracts/sep41_token_contract.wasm",
    );
    const spec = extractContractSpec(wasm);
    const contract = new Contract({
      networkConfig: NetworkConfig.TestNet(),
      contractConfig: { wasm },
      rpc: {} as never,
    });
    const providers = [
      ContractStandards.SEP41.versions["0.5.1"],
      ContractStandards.SEP41.versions["0.5.2"],
    ];
    assertEquals(providers[0].interface, providers[1].interface);
    for (const provider of providers) {
      assertEquals(analyzeContractInterface(spec, provider).matches, true);
      assertEquals(matchesContractInterface(spec, provider), true);
      assertEquals(contract.analyzeInterface(provider).matches, true);
      assertEquals(contract.matchesInterface(provider), true);
      assertEquals(
        contract.inspectStandards([provider]),
        inspectContractStandards({ wasm, standards: [provider] }),
      );
      assertEquals(
        contract.inspectStandards([provider])[0].interface.matches,
        true,
      );
      const missing = new Spec(
        spec.entries.filter((entry) =>
          !(entry.type === "scSpecEntryFunctionV0" &&
            entry.value.name.toString() === "burn")
        ),
      );
      const wrong = new Spec([
        ...missing.entries,
        func("burn", {
          from: address,
          amount: xdr.ScSpecTypeDef.scSpecTypeU64(),
        }),
      ]);
      for (const invalid of [missing, wrong]) {
        const client = new Contract({
          networkConfig: NetworkConfig.TestNet(),
          contractConfig: { wasmHash: "00", spec: invalid },
          rpc: {} as never,
        });
        assertEquals(matchesContractInterface(invalid, provider), false);
        assertEquals(client.matchesInterface(provider), false);
        assertEquals(client.analyzeInterface(provider).matches, false);
      }
      assertEquals(
        matchesContractInterface(
          new Spec([...spec.entries, func("extension", {})]),
          provider,
        ),
        true,
      );
    }
  });

  it("accepts only the mandatory identity hooks when the minimum profile is explicitly selected", () => {
    // Independent declarations from SEP-57's required component interface.
    const spec = new Spec([
      func("verify_identity", { user_address: address }),
      func("recovery_target", { old_account: address }, [option(address)]),
    ]);
    const sep = ContractStandards.SEP57;
    assertEquals(sep.interfaces, sep.profiles.reference);
    for (const version of ["0.3.0", "0.4.0"] as const) {
      const minimum = sep.profiles.minimum.identityVerifier.versions[version];
      assertEquals(matchesContractInterface(spec, minimum), true);
      assertEquals(
        matchesContractInterface(
          spec,
          sep.interfaces.identityVerifier.versions[version],
        ),
        false,
      );
      assertEquals(
        matchesContractInterface(new Spec(spec.entries.slice(0, 1)), minimum),
        false,
      );
      const wrong = new Spec([
        spec.entries[0],
        func("recovery_target", { old_account: address }, [address]),
      ]);
      assertEquals(matchesContractInterface(wrong, minimum), false);
    }
  });

  it("requires all three compliance hooks and their types without reference management", () => {
    const entries = [
      struct("AccountSnapshot", { address, balance: i128, frozen: i128 }),
      union("TransferKind", {
        Standard: null,
        Delegated: [address],
        Forced: null,
      }),
      func("transferred", {
        from: udt("AccountSnapshot"),
        to: udt("AccountSnapshot"),
        amount: i128,
        kind: udt("TransferKind"),
        token: address,
      }),
      func("created", {
        to: udt("AccountSnapshot"),
        amount: i128,
        token: address,
      }),
      func("destroyed", {
        from: udt("AccountSnapshot"),
        amount: i128,
        token: address,
      }),
    ];
    const sep = ContractStandards.SEP57;
    for (const version of ["0.3.0", "0.4.0"] as const) {
      const minimum = sep.profiles.minimum.compliance.versions[version];
      assertEquals(matchesContractInterface(new Spec(entries), minimum), true);
      assertEquals(
        matchesContractInterface(
          new Spec(entries),
          sep.interfaces.compliance.versions[version],
        ),
        false,
      );
      for (let index = 0; index < entries.length; index++) {
        assertEquals(
          matchesContractInterface(
            new Spec(entries.filter((_, i) => i !== index)),
            minimum,
          ),
          false,
        );
      }
    }
    for (const catalog of Object.values(sep.interfaces)) {
      assertEquals(catalog.latest.version, "0.4.0");
      assertEquals(
        catalog.versions["0.3.0"].interface,
        catalog.versions["0.4.0"].interface,
      );
    }
  });

  it("preserves the SEP-41/57 burn arity conflict instead of manufacturing a joint match", async () => {
    const spec = extractContractSpec(
      await loadWasmFile(
        "_internal/tests/compiled-contracts/sep41_token_contract.wasm",
      ),
    );
    const result = analyzeContractInterface(
      spec,
      ContractStandards.SEP57.latest,
    );
    assertEquals(
      result.incompatibleFunctions.some(({ name, differences }) =>
        name === "burn" &&
        differences.some(({ path }) => path === "inputs.length")
      ),
      true,
    );
    assertEquals(
      ContractStandards.SEP41.latest.interface.functions.find(({ name }) =>
        name === "burn"
      )!.inputs.length,
      2,
    );
    assertEquals(
      ContractStandards.SEP57.latest.interface.functions.find(({ name }) =>
        name === "burn"
      )!.inputs.length,
      3,
    );
  });
});
