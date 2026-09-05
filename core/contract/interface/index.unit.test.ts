import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import {
  analyzeContractInterface,
  Contract,
  ContractStandards,
  extractContractMetadata,
  extractContractSpec,
  extractSepClaims,
  inspectContractStandards,
  matchesContractInterface,
  NetworkConfig,
} from "@/mod.ts";
import * as E from "@/contract/error.ts";
import {
  normalizeContractInterfaceValue,
  normalizeContractUserType,
} from "@/contract/interface/normalize-contract-interface.ts";
import type {
  ContractInterfaceDefinition,
  ContractInterfaceTypeRequirement,
  ContractStandardProvider,
} from "@/contract/interface/types.ts";
import {
  enumDefinition,
  functionDefinition,
  interfaceDefinition,
  standardProvider,
  types,
} from "@/contract/interface/standards/definition.ts";
import { claimsSep } from "@/contract/metadata/extract-sep-claims.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";

const WASM_HEADER = new Uint8Array([
  0x00,
  0x61,
  0x73,
  0x6d,
  0x01,
  0x00,
  0x00,
  0x00,
]);

const encodeUnsignedLeb128 = (value: number): number[] => {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return bytes;
};

const customSection = (name: string, payload: Uint8Array): Uint8Array => {
  const nameBytes = new TextEncoder().encode(name);
  const contents = new Uint8Array([
    ...encodeUnsignedLeb128(nameBytes.length),
    ...nameBytes,
    ...payload,
  ]);
  return new Uint8Array([
    0,
    ...encodeUnsignedLeb128(contents.length),
    ...contents,
  ]);
};

const wasmWithSections = (
  sections: readonly { name: string; payload: Uint8Array }[],
): Uint8Array =>
  new Uint8Array([
    ...WASM_HEADER,
    ...sections.flatMap(({ name, payload }) => [
      ...customSection(name, payload),
    ]),
  ]);

const metadataEntry = (key: string, value: string): Uint8Array =>
  xdr.ScMetaEntry.scMetaV0(
    new xdr.ScMetaV0({ key, val: value }),
  ).toXdr();

const concat = (...values: readonly Uint8Array[]): Uint8Array =>
  new Uint8Array(values.flatMap((value) => [...value]));

const exact = (
  type: xdr.ScSpecTypeDef,
): ContractInterfaceTypeRequirement => ({
  kind: "exact",
  type: normalizeContractInterfaceValue(type.toJSON()) as never,
});

const functionEntry = ({
  name,
  inputs = [],
  outputs = [],
}: {
  name: string;
  inputs?: readonly [name: string, type: xdr.ScSpecTypeDef][];
  outputs?: readonly xdr.ScSpecTypeDef[];
}): xdr.ScSpecEntry =>
  xdr.ScSpecEntry.scSpecEntryFunctionV0(
    new xdr.ScSpecFunctionV0({
      doc: "ignored documentation",
      name,
      inputs: inputs.map(([inputName, type]) =>
        new xdr.ScSpecFunctionInputV0({
          doc: "ignored documentation",
          name: inputName,
          type,
        })
      ),
      outputs: [...outputs],
    }),
  );

const structEntry = (
  name: string,
  fields: readonly [name: string, type: xdr.ScSpecTypeDef][],
): xdr.ScSpecEntry =>
  xdr.ScSpecEntry.scSpecEntryUdtStructV0(
    new xdr.ScSpecUdtStructV0({
      doc: "ignored documentation",
      lib: "ignored_library",
      name,
      fields: fields.map(([fieldName, type]) =>
        new xdr.ScSpecUdtStructFieldV0({
          doc: "ignored documentation",
          name: fieldName,
          type,
        })
      ),
    }),
  );

const unionEntry = (name: string): xdr.ScSpecEntry =>
  xdr.ScSpecEntry.scSpecEntryUdtUnionV0(
    new xdr.ScSpecUdtUnionV0({
      doc: "ignored documentation",
      lib: "ignored_library",
      name,
      cases: [
        xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseVoidV0(
          new xdr.ScSpecUdtUnionCaseVoidV0({
            doc: "ignored documentation",
            name: "None",
          }),
        ),
      ],
    }),
  );

const enumEntry = (name: string): xdr.ScSpecEntry =>
  xdr.ScSpecEntry.scSpecEntryUdtEnumV0(
    new xdr.ScSpecUdtEnumV0({
      doc: "ignored documentation",
      lib: "ignored_library",
      name,
      cases: [
        new xdr.ScSpecUdtEnumCaseV0({
          doc: "ignored documentation",
          name: "One",
          value: 1,
        }),
      ],
    }),
  );

const specificationSection = (
  ...entries: readonly xdr.ScSpecEntry[]
): Uint8Array => concat(...entries.map((entry) => entry.toXdr()));

const provider = (
  contractInterface: ContractInterfaceDefinition,
): ContractStandardProvider => ({
  sep: 999,
  version: "1.0.0",
  interface: contractInterface,
});

describe("contract metadata", () => {
  it("extracts every SEP-46 section and preserves ordered duplicate entries", () => {
    const wasm = wasmWithSections([
      { name: "unrelated", payload: new Uint8Array([1]) },
      {
        name: "contractmetav0",
        payload: concat(
          metadataEntry("sep", "41,50"),
          metadataEntry("name", "first"),
        ),
      },
      { name: "contractmetav0", payload: new Uint8Array() },
      {
        name: "contractmetav0",
        payload: metadataEntry("name", "second"),
      },
    ]);

    assertEquals(extractContractMetadata(wasm), {
      sections: [
        {
          index: 0,
          entries: [
            {
              key: "sep",
              value: "41,50",
              sectionIndex: 0,
              entryIndex: 0,
            },
            {
              key: "name",
              value: "first",
              sectionIndex: 0,
              entryIndex: 1,
            },
          ],
        },
        { index: 1, entries: [] },
        {
          index: 2,
          entries: [{
            key: "name",
            value: "second",
            sectionIndex: 2,
            entryIndex: 0,
          }],
        },
      ],
      entries: [
        {
          key: "sep",
          value: "41,50",
          sectionIndex: 0,
          entryIndex: 0,
        },
        {
          key: "name",
          value: "first",
          sectionIndex: 0,
          entryIndex: 1,
        },
        {
          key: "name",
          value: "second",
          sectionIndex: 2,
          entryIndex: 0,
        },
      ],
    });
  });

  it("returns an empty result when metadata is absent", () => {
    assertEquals(extractContractMetadata(WASM_HEADER), {
      sections: [],
      entries: [],
    });
  });

  it("rejects non-Wasm input with a typed occurrence-specific error", () => {
    const error = assertThrows(
      () => extractContractMetadata(new Uint8Array([1, 2, 3])),
      E.INVALID_WASM_FOR_METADATA,
    );
    assertEquals(error.code, E.Code.INVALID_WASM_FOR_METADATA);
  });

  it("identifies the exact malformed metadata section", () => {
    const error = assertThrows(
      () =>
        extractContractMetadata(wasmWithSections([
          {
            name: "contractmetav0",
            payload: metadataEntry("name", "valid"),
          },
          { name: "contractmetav0", payload: new Uint8Array([1]) },
        ])),
      E.FAILED_TO_DECODE_METADATA_SECTION,
    );
    assertEquals(error.code, E.Code.FAILED_TO_DECODE_METADATA_SECTION);
    assertEquals(error.meta.data, { sectionIndex: 1 });
  });
});

describe("SEP-47 claims", () => {
  const metadata = extractContractMetadata(wasmWithSections([
    {
      name: "contractmetav0",
      payload: concat(
        metadataEntry("unrelated", "41"),
        metadataEntry("sep", "41,50,41"),
        metadataEntry(
          "sep",
          ",01, 44,abc,9007199254740992",
        ),
      ),
    },
  ]));
  const analysis = extractSepClaims(metadata);

  it("keeps valid occurrences, a unique list, and malformed diagnostics", () => {
    assertEquals(analysis.seps, [41, 50]);
    assertEquals(
      analysis.claims.map(({ sep, valueIndex }) => ({
        sep,
        valueIndex,
      })),
      [
        { sep: 41, valueIndex: 0 },
        { sep: 50, valueIndex: 1 },
        { sep: 41, valueIndex: 2 },
      ],
    );
    assertEquals(
      analysis.invalidClaims.map(({ value, reason, valueIndex }) => ({
        value,
        reason,
        valueIndex,
      })),
      [
        { value: "", reason: "empty", valueIndex: 0 },
        { value: "01", reason: "invalid-identifier", valueIndex: 1 },
        { value: " 44", reason: "invalid-identifier", valueIndex: 2 },
        { value: "abc", reason: "invalid-identifier", valueIndex: 3 },
        {
          value: "9007199254740992",
          reason: "unsafe-identifier",
          valueIndex: 4,
        },
      ],
    );
  });

  it("checks a valid SEP identifier without interpreting interface support", () => {
    assertEquals(claimsSep(analysis, 41), true);
    assertEquals(claimsSep(analysis, 44), false);
  });

  it("rejects non-positive and unsafe requested SEP identifiers", () => {
    for (const sep of [0, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      const error = assertThrows(
        () => claimsSep(analysis, sep),
        E.INVALID_SEP_IDENTIFIER,
      );
      assertEquals(error.code, E.Code.INVALID_SEP_IDENTIFIER);
      assertEquals(error.meta.data, { sep });
    }
  });
});

describe("contract specification extraction", () => {
  it("combines ordered SEP-48 entries from every specification section", () => {
    const spec = extractContractSpec(wasmWithSections([
      {
        name: "contractspecv0",
        payload: specificationSection(functionEntry({ name: "first" })),
      },
      { name: "contractspecv0", payload: new Uint8Array() },
      {
        name: "contractspecv0",
        payload: specificationSection(functionEntry({ name: "second" })),
      },
    ]));

    assertEquals(spec.funcs().map((func) => func.name.toString()), [
      "first",
      "second",
    ]);
  });

  it("rejects invalid Wasm independently from missing specification metadata", () => {
    assertInstanceOf(
      assertThrows(
        () => extractContractSpec(new Uint8Array([1, 2, 3])),
      ),
      E.INVALID_WASM_FOR_SPEC,
    );
    assertInstanceOf(
      assertThrows(() => extractContractSpec(WASM_HEADER)),
      E.MISSING_SPEC_IN_WASM,
    );
  });

  it("identifies the exact malformed specification section", () => {
    const error = assertThrows(
      () =>
        extractContractSpec(wasmWithSections([
          {
            name: "contractspecv0",
            payload: specificationSection(functionEntry({ name: "valid" })),
          },
          { name: "contractspecv0", payload: new Uint8Array([1]) },
        ])),
      E.FAILED_TO_DECODE_SPEC_SECTION,
    );
    assertEquals(error.code, E.Code.FAILED_TO_DECODE_SPEC_SECTION);
    assertEquals(error.meta.data, { sectionIndex: 1 });
  });
});

describe("contract interface analysis", () => {
  it("matches the current SEP-41 interface and permits contract extensions", async () => {
    const wasm = await loadWasmFile(
      "./_internal/tests/compiled-contracts/sep41_token_contract.wasm",
    );
    const spec = extractContractSpec(wasm);
    const analysis = analyzeContractInterface(
      spec,
      ContractStandards.SEP41.latest,
    );

    assertEquals(analysis.matches, true);
    assert(analysis.additionalFunctions.includes("mint_with_reference"));
    assertEquals(
      matchesContractInterface(
        spec,
        ContractStandards.SEP41.latest,
      ),
      true,
    );
    assertEquals(
      matchesContractInterface(
        spec,
        ContractStandards.SEP41.versions["0.1.0"],
      ),
      false,
    );
  });

  it("reports missing and incompatible functions without rejecting additions", () => {
    const definition: ContractInterfaceDefinition = {
      id: "diagnostic",
      name: "Diagnostic",
      functions: [
        {
          name: "check",
          inputs: [
            { name: "id", type: exact(xdr.ScSpecTypeDef.scSpecTypeU64()) },
            { name: "flag", type: exact(xdr.ScSpecTypeDef.scSpecTypeBool()) },
          ],
          outputs: [
            exact(xdr.ScSpecTypeDef.scSpecTypeBool()),
            exact(xdr.ScSpecTypeDef.scSpecTypeU32()),
          ],
        },
        { name: "absent", inputs: [], outputs: [] },
      ],
      types: [],
    };
    const spec = new Spec([
      functionEntry({
        name: "check",
        inputs: [["different", xdr.ScSpecTypeDef.scSpecTypeI64()]],
        outputs: [xdr.ScSpecTypeDef.scSpecTypeString()],
      }),
      functionEntry({ name: "additional" }),
    ]);

    const analysis = analyzeContractInterface(spec, provider(definition));
    assertEquals(analysis.matches, false);
    assertEquals(analysis.missingFunctions, ["absent"]);
    assertEquals(analysis.additionalFunctions, ["additional"]);
    assertEquals(analysis.incompatibleFunctions[0].name, "check");
    assertEquals(
      analysis.incompatibleFunctions[0].differences.map(({ path }) => path),
      [
        "inputs.length",
        "inputs[0].name",
        "inputs[0].type",
        "outputs.length",
        "outputs[0]",
      ],
    );
  });

  it("reports missing, wrong-kind, and structurally different user types", () => {
    const expectedShape = normalizeContractUserType(structEntry("Shape", [
      ["one", xdr.ScSpecTypeDef.scSpecTypeU32()],
      ["two", xdr.ScSpecTypeDef.scSpecTypeBool()],
    ]));
    const expectedKind = normalizeContractUserType(structEntry("Kind", []));
    const expectedObject = {
      kind: "struct",
      name: "ObjectShape",
      definition: { name: "ObjectShape", expectedOnly: true },
    } as const;
    assert(expectedShape);
    assert(expectedKind);

    const spec = new Spec([
      structEntry("Shape", [
        ["one", xdr.ScSpecTypeDef.scSpecTypeU64()],
        ["three", xdr.ScSpecTypeDef.scSpecTypeString()],
        ["four", xdr.ScSpecTypeDef.scSpecTypeBool()],
      ]),
      unionEntry("Kind"),
      structEntry("ObjectShape", []),
      enumEntry("Additional"),
    ]);
    const analysis = analyzeContractInterface(
      spec,
      provider({
        id: "types",
        name: "Types",
        functions: [],
        types: [
          expectedShape,
          expectedKind,
          expectedObject,
          { ...expectedKind, name: "Missing" },
        ],
      }),
    );

    assertEquals(analysis.matches, false);
    assertEquals(analysis.missingTypes, [{ kind: "struct", name: "Missing" }]);
    assertEquals(analysis.incompatibleTypes.map(({ name }) => name), [
      "Shape",
      "Kind",
      "ObjectShape",
    ]);
    assertEquals(analysis.additionalTypes, [{
      kind: "enum",
      name: "Additional",
    }]);
    assert(
      analysis.incompatibleTypes[0].differences.some(({ path }) =>
        path === "definition.fields.length"
      ),
    );
    assertEquals(analysis.incompatibleTypes[1].differences, [{
      path: "kind",
      expected: "struct",
      actual: "union",
    }]);
    assertEquals(
      analysis.incompatibleTypes[2].differences.map(({ path }) => path),
      ["definition.expectedOnly", "definition.fields"],
    );
  });

  it("supports SEP-50 reusable unsigned-integer type constraints", () => {
    const tokenId: ContractInterfaceTypeRequirement = {
      kind: "variable",
      name: "token-id",
      allowedTypes: [
        normalizeContractInterfaceValue(
          xdr.ScSpecTypeDef.scSpecTypeU64().toJSON(),
        ) as never,
        normalizeContractInterfaceValue(
          xdr.ScSpecTypeDef.scSpecTypeU128().toJSON(),
        ) as never,
      ],
    };
    const constrained = provider({
      id: "constrained",
      name: "Constrained",
      functions: [
        {
          name: "owner_of",
          inputs: [{ name: "token_id", type: tokenId }],
          outputs: [],
        },
        {
          name: "transfer",
          inputs: [{ name: "token_id", type: tokenId }],
          outputs: [],
        },
      ],
      types: [],
    });
    const matching = new Spec([
      functionEntry({
        name: "owner_of",
        inputs: [["token_id", xdr.ScSpecTypeDef.scSpecTypeU64()]],
      }),
      functionEntry({
        name: "transfer",
        inputs: [["token_id", xdr.ScSpecTypeDef.scSpecTypeU64()]],
      }),
    ]);
    const inconsistent = new Spec([
      functionEntry({
        name: "owner_of",
        inputs: [["token_id", xdr.ScSpecTypeDef.scSpecTypeU64()]],
      }),
      functionEntry({
        name: "transfer",
        inputs: [["token_id", xdr.ScSpecTypeDef.scSpecTypeU128()]],
      }),
    ]);
    const signed = new Spec([
      functionEntry({
        name: "owner_of",
        inputs: [["token_id", xdr.ScSpecTypeDef.scSpecTypeI64()]],
      }),
      functionEntry({
        name: "transfer",
        inputs: [["token_id", xdr.ScSpecTypeDef.scSpecTypeI64()]],
      }),
    ]);

    assertEquals(matchesContractInterface(matching, constrained), true);
    assertEquals(matchesContractInterface(inconsistent, constrained), false);
    assertEquals(matchesContractInterface(signed, constrained), false);
  });

  it("normalizes interface values and ignores non-user-defined entries", () => {
    assertEquals(
      normalizeContractInterfaceValue({
        doc: "ignored",
        lib: "ignored",
        keep: [true, null, 1, "value"],
      }),
      { keep: [true, null, 1, "value"] },
    );
    assertEquals(
      normalizeContractUserType(functionEntry({ name: "function" })),
      undefined,
    );
    assertEquals(
      normalizeContractUserType({
        toJSON: () => ({ udt_struct_v0: null }),
      } as unknown as xdr.ScSpecEntry),
      undefined,
    );
    assertEquals(
      normalizeContractUserType({
        toJSON: () => ({ udt_struct_v0: { name: 42 } }),
      } as unknown as xdr.ScSpecEntry),
      undefined,
    );
    assertEquals(
      normalizeContractUserType({
        toJSON: () => ({}),
      } as unknown as xdr.ScSpecEntry),
      undefined,
    );
  });

  it("builds exact result, tuple, and enum provider definitions", () => {
    const built = standardProvider(
      998,
      "1.2.3",
      interfaceDefinition(
        "factory",
        "Factory",
        [
          functionDefinition(
            "convert",
            [["pair", types.tuple([types.u32, types.string])]],
            [types.result(types.bool, types.error)],
          ),
        ],
        [enumDefinition("State", [["Ready", 1]])],
      ),
    );

    assertEquals(built.sep, 998);
    assertEquals(built.interface.functions[0].inputs[0].type.kind, "exact");
    assertEquals(built.interface.functions[0].outputs[0].kind, "exact");
    assertEquals(built.interface.types[0].kind, "enum");
  });
});

describe("known contract standards", () => {
  const functionNames = (
    standard: ContractStandardProvider,
  ): readonly string[] => standard.interface.functions.map(({ name }) => name);

  it("exposes every current SEP with a concrete contract interface", () => {
    assertEquals(Object.keys(ContractStandards), [
      "SEP40",
      "SEP41",
      "SEP44",
      "SEP50",
      "SEP56",
      "SEP57",
    ]);
    assertEquals(ContractStandards.SEP40.latest.version, "0.1.0");
    assertEquals(ContractStandards.SEP41.latest.version, "0.5.1");
    assertEquals(ContractStandards.SEP44.latest.version, "0.2.1");
    assertEquals(ContractStandards.SEP50.latest.version, "0.1.0");
    assertEquals(ContractStandards.SEP56.latest.version, "0.1.2");
    assertEquals(ContractStandards.SEP57.latest.version, "0.3.0");
    assertEquals(Object.keys(ContractStandards.SEP57.interfaces), [
      "rwaToken",
      "identityVerifier",
      "compliance",
      "claimTopicsAndIssuers",
      "identityRegistryStorage",
      "identityClaims",
      "claimIssuer",
    ]);
  });

  it("keeps explicitly represented historical versions selectable", () => {
    assertEquals(Object.keys(ContractStandards.SEP41.versions), [
      "0.1.0",
      "0.2.0",
      "0.3.0",
      "0.4.0",
      "0.4.1",
      "0.5.0",
      "0.5.1",
    ]);
    assertEquals(Object.keys(ContractStandards.SEP44.versions), [
      "0.1.0",
      "0.2.0",
      "0.2.1",
    ]);
    assertEquals(Object.keys(ContractStandards.SEP56.versions), [
      "0.1.0",
      "0.1.1",
      "0.1.2",
    ]);
  });

  it("contains every function in each current single-interface SEP", () => {
    assertEquals(functionNames(ContractStandards.SEP40.latest), [
      "base",
      "assets",
      "decimals",
      "resolution",
      "price",
      "prices",
      "lastprice",
    ]);
    assertEquals(functionNames(ContractStandards.SEP44.latest), [
      "transfer_memo",
    ]);
    assertEquals(functionNames(ContractStandards.SEP50.latest), [
      "balance",
      "owner_of",
      "transfer",
      "transfer_from",
      "approve",
      "approve_for_all",
      "get_approved",
      "is_approved_for_all",
      "name",
      "symbol",
      "token_uri",
    ]);
    assertEquals(functionNames(ContractStandards.SEP56.latest), [
      "total_supply",
      "query_asset",
      "total_assets",
      "convert_to_shares",
      "convert_to_assets",
      "max_deposit",
      "preview_deposit",
      "deposit",
      "max_mint",
      "preview_mint",
      "mint",
      "max_withdraw",
      "preview_withdraw",
      "withdraw",
      "max_redeem",
      "preview_redeem",
      "redeem",
    ]);
  });

  it("contains every function in each current SEP-57 component interface", () => {
    const interfaces = ContractStandards.SEP57.interfaces;
    assertEquals(functionNames(interfaces.rwaToken.latest), [
      "total_supply",
      "forced_transfer",
      "mint",
      "burn",
      "recover_balance",
      "set_address_frozen",
      "freeze_partial_tokens",
      "unfreeze_partial_tokens",
      "is_frozen",
      "get_frozen_tokens",
      "version",
      "onchain_id",
      "set_compliance",
      "set_identity_verifier",
      "compliance",
      "identity_verifier",
      "pause",
      "unpause",
    ]);
    assertEquals(functionNames(interfaces.identityVerifier.latest), [
      "verify_identity",
      "recovery_target",
      "set_claim_topics_and_issuers",
      "claim_topics_and_issuers",
    ]);
    assertEquals(functionNames(interfaces.compliance.latest), [
      "add_module_to",
      "remove_module_from",
      "get_modules_for_hook",
      "is_module_registered",
      "transferred",
      "created",
      "destroyed",
    ]);
    assertEquals(functionNames(interfaces.claimTopicsAndIssuers.latest), [
      "add_claim_topic",
      "remove_claim_topic",
      "get_claim_topics",
      "add_trusted_issuer",
      "remove_trusted_issuer",
      "update_issuer_claim_topics",
      "get_trusted_issuers",
      "get_claim_topic_issuers",
      "get_claim_topics_and_issuers",
      "is_trusted_issuer",
      "get_trusted_issuer_claim_topics",
      "has_claim_topic",
    ]);
    assertEquals(functionNames(interfaces.identityRegistryStorage.latest), [
      "add_identity",
      "remove_identity",
      "modify_identity",
      "recover_identity",
      "stored_identity",
      "get_recovered_to",
    ]);
    assertEquals(functionNames(interfaces.identityClaims.latest), [
      "add_claim",
      "get_claim",
      "get_claim_ids_by_topic",
    ]);
    assertEquals(functionNames(interfaces.claimIssuer.latest), [
      "is_claim_valid",
    ]);
  });

  it("validates the complete SEP-57 reference Claim structure", () => {
    const claimFields: readonly [name: string, type: xdr.ScSpecTypeDef][] = [
      ["data", types.bytes],
      ["issuer", types.address],
      ["scheme", types.u32],
      ["signature", types.bytes],
      ["topic", types.u32],
      ["uri", types.string],
    ];
    const identityClaimsSpec = (
      fields?: readonly [name: string, type: xdr.ScSpecTypeDef][],
    ): Spec =>
      new Spec([
        functionEntry({
          name: "add_claim",
          inputs: [
            claimFields[4],
            claimFields[2],
            claimFields[1],
            claimFields[3],
            claimFields[0],
            claimFields[5],
          ],
          outputs: [types.bytesN(32)],
        }),
        functionEntry({
          name: "get_claim",
          inputs: [["claim_id", types.bytesN(32)]],
          outputs: [types.udt("Claim")],
        }),
        functionEntry({
          name: "get_claim_ids_by_topic",
          inputs: [["topic", types.u32]],
          outputs: [types.vec(types.bytesN(32))],
        }),
        ...(fields ? [structEntry("Claim", fields)] : []),
      ]);
    const provider = ContractStandards.SEP57.interfaces.identityClaims.latest;

    assertEquals(
      analyzeContractInterface(identityClaimsSpec(claimFields), provider)
        .matches,
      true,
    );

    const missing = analyzeContractInterface(identityClaimsSpec(), provider);
    assertEquals(missing.matches, false);
    assertEquals(missing.missingTypes, [{ kind: "struct", name: "Claim" }]);

    const reordered = analyzeContractInterface(
      identityClaimsSpec([
        claimFields[1],
        claimFields[0],
        ...claimFields.slice(2),
      ]),
      provider,
    );
    assertEquals(reordered.matches, false);
    assertEquals(
      reordered.incompatibleTypes.map(({ name }) => name),
      ["Claim"],
    );

    const wrongType = analyzeContractInterface(
      identityClaimsSpec([
        ...claimFields.slice(0, 3),
        ["signature", types.string],
        ...claimFields.slice(4),
      ]),
      provider,
    );
    assertEquals(wrongType.matches, false);
    assertEquals(
      wrongType.incompatibleTypes.map(({ name }) => name),
      ["Claim"],
    );
  });
});

describe("standard inspection", () => {
  const wasm = wasmWithSections([
    {
      name: "contractmetav0",
      payload: concat(
        metadataEntry("sep", "41,50"),
        metadataEntry("sep", "41"),
      ),
    },
    {
      name: "contractspecv0",
      payload: specificationSection(functionEntry({ name: "ping" })),
    },
  ]);
  const ping = provider({
    id: "ping",
    name: "Ping",
    functions: [{ name: "ping", inputs: [], outputs: [] }],
    types: [],
  });
  const differentSep = { ...ping, sep: 50 };

  it("keeps declaration and interface results independent and ordered", () => {
    const result = inspectContractStandards({
      wasm,
      standards: [differentSep, ping],
    });

    assertEquals(result.map(({ standard }) => standard.sep), [50, 999]);
    assertEquals(result[0].claim.declared, true);
    assertEquals(result[0].claim.declarations.length, 1);
    assertEquals(result[0].interface.matches, true);
    assertEquals(result[1].claim.declared, false);
    assertEquals(result[1].interface.matches, true);
  });

  it("exposes the same granular and aggregate operations on Contract", () => {
    const contract = new Contract({
      networkConfig: NetworkConfig.TestNet(),
      contractConfig: { wasm },
      rpc: {} as never,
    });

    assertEquals(contract.getMetadata().sections.length, 1);
    assertEquals(contract.getSepClaims().seps, [41, 50]);
    assertEquals(contract.claimsSep(41), true);
    assertEquals(contract.analyzeInterface(ping).matches, true);
    assertEquals(contract.matchesInterface(ping), true);
    assertEquals(contract.inspectStandards([ping])[0].claim.declared, false);
  });

  it("uses an explicitly configured spec without requiring local Wasm", () => {
    const spec = new Spec([functionEntry({ name: "ping" })]);
    const contract = new Contract({
      networkConfig: NetworkConfig.TestNet(),
      contractConfig: { wasmHash: "00", spec },
      rpc: {} as never,
    });

    assertEquals(contract.analyzeInterface(ping).matches, true);
    assertEquals(contract.matchesInterface(ping), true);
  });
});
