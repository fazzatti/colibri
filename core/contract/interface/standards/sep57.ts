import {
  functionDefinition,
  interfaceDefinition,
  standardProvider,
  structDefinition,
  types,
  unionDefinition,
} from "@/contract/interface/standards/definition.ts";
import type {
  ContractInterfaceDefinition,
  ContractInterfaceUserType,
  ContractStandardCatalog,
} from "@/contract/interface/types.ts";

const rwaToken: ContractInterfaceDefinition = interfaceDefinition(
  "rwa-token",
  "RWA Token",
  [
    functionDefinition("total_supply", [], [types.i128]),
    functionDefinition("forced_transfer", [
      ["from", types.address],
      ["to", types.address],
      ["amount", types.i128],
      ["operator", types.address],
    ]),
    functionDefinition("mint", [
      ["to", types.address],
      ["amount", types.i128],
      ["operator", types.address],
    ]),
    functionDefinition("burn", [
      ["user_address", types.address],
      ["amount", types.i128],
      ["operator", types.address],
    ]),
    functionDefinition("recover_balance", [
      ["old_account", types.address],
      ["new_account", types.address],
      ["operator", types.address],
    ], [types.bool]),
    functionDefinition("set_address_frozen", [
      ["user_address", types.address],
      ["freeze", types.bool],
      ["operator", types.address],
    ]),
    functionDefinition("freeze_partial_tokens", [
      ["user_address", types.address],
      ["amount", types.i128],
      ["operator", types.address],
    ]),
    functionDefinition("unfreeze_partial_tokens", [
      ["user_address", types.address],
      ["amount", types.i128],
      ["operator", types.address],
    ]),
    functionDefinition("is_frozen", [["user_address", types.address]], [
      types.bool,
    ]),
    functionDefinition("get_frozen_tokens", [["user_address", types.address]], [
      types.i128,
    ]),
    functionDefinition("version", [], [types.string]),
    functionDefinition("onchain_id", [], [types.address]),
    functionDefinition("set_compliance", [
      ["compliance", types.address],
      ["operator", types.address],
    ]),
    functionDefinition("set_identity_verifier", [
      ["identity_verifier", types.address],
      ["operator", types.address],
    ]),
    functionDefinition("compliance", [], [types.address]),
    functionDefinition("identity_verifier", [], [types.address]),
    functionDefinition("pause", [["caller", types.address]]),
    functionDefinition("unpause", [["caller", types.address]]),
  ],
);

const identityVerifier: ContractInterfaceDefinition = interfaceDefinition(
  "identity-verifier",
  "Identity Verifier",
  [
    functionDefinition("verify_identity", [["user_address", types.address]]),
    functionDefinition(
      "recovery_target",
      [["old_account", types.address]],
      [types.option(types.address)],
    ),
    functionDefinition("set_claim_topics_and_issuers", [
      ["contract", types.address],
      ["operator", types.address],
    ]),
    functionDefinition("claim_topics_and_issuers", [], [types.address]),
  ],
);

const accountSnapshot: ContractInterfaceUserType = structDefinition(
  "AccountSnapshot",
  [
    ["address", types.address],
    ["balance", types.i128],
    ["frozen", types.i128],
  ],
);
const transferKind: ContractInterfaceUserType = unionDefinition(
  "TransferKind",
  [
    ["Standard"],
    ["Delegated", [types.address]],
    ["Forced"],
  ],
);
const complianceHook: ContractInterfaceUserType = unionDefinition(
  "ComplianceHook",
  [
    ["Transferred"],
    ["Created"],
    ["Destroyed"],
  ],
);

const compliance: ContractInterfaceDefinition = interfaceDefinition(
  "compliance",
  "Compliance",
  [
    functionDefinition("add_module_to", [
      ["hook", types.udt("ComplianceHook")],
      ["module", types.address],
      ["operator", types.address],
    ]),
    functionDefinition("remove_module_from", [
      ["hook", types.udt("ComplianceHook")],
      ["module", types.address],
      ["operator", types.address],
    ]),
    functionDefinition(
      "get_modules_for_hook",
      [["hook", types.udt("ComplianceHook")]],
      [types.vec(types.address)],
    ),
    functionDefinition("is_module_registered", [
      ["hook", types.udt("ComplianceHook")],
      ["module", types.address],
    ], [types.bool]),
    functionDefinition("transferred", [
      ["from", types.udt("AccountSnapshot")],
      ["to", types.udt("AccountSnapshot")],
      ["amount", types.i128],
      ["kind", types.udt("TransferKind")],
      ["token", types.address],
    ]),
    functionDefinition("created", [
      ["to", types.udt("AccountSnapshot")],
      ["amount", types.i128],
      ["token", types.address],
    ]),
    functionDefinition("destroyed", [
      ["from", types.udt("AccountSnapshot")],
      ["amount", types.i128],
      ["token", types.address],
    ]),
  ],
  [accountSnapshot, transferKind, complianceHook],
);

const claimTopicsAndIssuers: ContractInterfaceDefinition = interfaceDefinition(
  "claim-topics-and-issuers",
  "Claim Topics and Issuers",
  [
    functionDefinition("add_claim_topic", [
      ["claim_topic", types.u32],
      ["operator", types.address],
    ]),
    functionDefinition("remove_claim_topic", [
      ["claim_topic", types.u32],
      ["operator", types.address],
    ]),
    functionDefinition("get_claim_topics", [], [types.vec(types.u32)]),
    functionDefinition("add_trusted_issuer", [
      ["trusted_issuer", types.address],
      ["claim_topics", types.vec(types.u32)],
      ["operator", types.address],
    ]),
    functionDefinition("remove_trusted_issuer", [
      ["trusted_issuer", types.address],
      ["operator", types.address],
    ]),
    functionDefinition("update_issuer_claim_topics", [
      ["trusted_issuer", types.address],
      ["claim_topics", types.vec(types.u32)],
      ["operator", types.address],
    ]),
    functionDefinition("get_trusted_issuers", [], [types.vec(types.address)]),
    functionDefinition(
      "get_claim_topic_issuers",
      [["claim_topic", types.u32]],
      [types.vec(types.address)],
    ),
    functionDefinition(
      "get_claim_topics_and_issuers",
      [],
      [types.map(types.u32, types.vec(types.address))],
    ),
    functionDefinition(
      "is_trusted_issuer",
      [["issuer", types.address]],
      [types.bool],
    ),
    functionDefinition(
      "get_trusted_issuer_claim_topics",
      [["trusted_issuer", types.address]],
      [types.vec(types.u32)],
    ),
    functionDefinition("has_claim_topic", [
      ["issuer", types.address],
      ["claim_topic", types.u32],
    ], [types.bool]),
  ],
);

const identityRegistryStorage: ContractInterfaceDefinition =
  interfaceDefinition(
    "identity-registry-storage",
    "Identity Registry Storage",
    [
      functionDefinition("add_identity", [
        ["account", types.address],
        ["identity", types.address],
        ["country_data_list", types.vec(types.val)],
        ["operator", types.address],
      ]),
      functionDefinition("remove_identity", [
        ["account", types.address],
        ["operator", types.address],
      ]),
      functionDefinition("modify_identity", [
        ["account", types.address],
        ["identity", types.address],
        ["operator", types.address],
      ]),
      functionDefinition("recover_identity", [
        ["old_account", types.address],
        ["new_account", types.address],
        ["operator", types.address],
      ]),
      functionDefinition("stored_identity", [["account", types.address]], [
        types.address,
      ]),
      functionDefinition(
        "get_recovered_to",
        [["old_account", types.address]],
        [types.option(types.address)],
      ),
    ],
  );

const claim: ContractInterfaceUserType = structDefinition("Claim", [
  // Named struct fields use the Rust SDK's canonical alphabetical ABI order.
  ["data", types.bytes],
  ["issuer", types.address],
  ["scheme", types.u32],
  ["signature", types.bytes],
  ["topic", types.u32],
  ["uri", types.string],
]);

const identityClaims: ContractInterfaceDefinition = interfaceDefinition(
  "identity-claims",
  "Identity Claims",
  [
    functionDefinition("add_claim", [
      ["topic", types.u32],
      ["scheme", types.u32],
      ["issuer", types.address],
      ["signature", types.bytes],
      ["data", types.bytes],
      ["uri", types.string],
    ], [types.bytesN(32)]),
    functionDefinition(
      "get_claim",
      [["claim_id", types.bytesN(32)]],
      [types.udt("Claim")],
    ),
    functionDefinition(
      "get_claim_ids_by_topic",
      [["topic", types.u32]],
      [types.vec(types.bytesN(32))],
    ),
  ],
  [claim],
);

const claimIssuer: ContractInterfaceDefinition = interfaceDefinition(
  "claim-issuer",
  "Claim Issuer",
  [
    functionDefinition("is_claim_valid", [
      ["identity", types.address],
      ["claim_topic", types.u32],
      ["scheme", types.u32],
      ["sig_data", types.bytes],
      ["claim_data", types.bytes],
    ]),
  ],
);

/** SEP-57 document versions represented by the bundled catalogs. */
export type Sep57Version = "0.3.0" | "0.4.0";
/** Named primary, component, and appendix-reference SEP-57 interfaces. */
export type Sep57InterfaceName =
  | "rwaToken"
  | "identityVerifier"
  | "compliance"
  | "claimTopicsAndIssuers"
  | "identityRegistryStorage"
  | "identityClaims"
  | "claimIssuer";
/** Full reference providers, retaining the existing component requirements. */
export type Sep57Interfaces = Readonly<
  Record<Sep57InterfaceName, ContractStandardCatalog<Sep57Version>>
>;
/** Minimum required component providers, without optional management functions. */
export type Sep57MinimumInterfaces = Readonly<
  Record<
    "identityVerifier" | "compliance",
    ContractStandardCatalog<Sep57Version>
  >
>;
/** Primary and explicitly selected component/reference catalogs. */
export type Sep57Catalog = ContractStandardCatalog<Sep57Version> & {
  /** Existing full reference catalogs; an alias of profiles.reference. */
  readonly interfaces: Sep57Interfaces;
  /** Explicit minimum requirements versus reference implementation features. */
  readonly profiles: {
    readonly minimum: Sep57MinimumInterfaces;
    readonly reference: Sep57Interfaces;
  };
};

const catalog = (
  definition: ContractInterfaceDefinition,
): ContractStandardCatalog<Sep57Version> => {
  const versions = {
    "0.3.0": standardProvider(57, "0.3.0", definition),
    "0.4.0": standardProvider(57, "0.4.0", definition),
  };
  return { versions, latest: versions["0.4.0"] };
};
const interfaces: Sep57Interfaces = {
  rwaToken: catalog(rwaToken),
  identityVerifier: catalog(identityVerifier),
  compliance: catalog(compliance),
  claimTopicsAndIssuers: catalog(claimTopicsAndIssuers),
  identityRegistryStorage: catalog(identityRegistryStorage),
  identityClaims: catalog(identityClaims),
  claimIssuer: catalog(claimIssuer),
};
const minimum: Sep57MinimumInterfaces = {
  identityVerifier: catalog(
    interfaceDefinition(
      "identity-verifier-minimum",
      "Minimum Identity Verifier",
      identityVerifier.functions.filter((fn) =>
        ["verify_identity", "recovery_target"].includes(fn.name)
      ),
    ),
  ),
  compliance: catalog(
    interfaceDefinition(
      "compliance-minimum",
      "Minimum Compliance",
      compliance.functions.filter((fn) =>
        ["transferred", "created", "destroyed"].includes(fn.name)
      ),
      [accountSnapshot, transferKind],
    ),
  ),
};

/**
 * SEP-57 structural interface providers, independent of behavioral conformance.
 * Existing interfaces retain full reference requirements. Select profiles.minimum
 * for only the mandatory identity/compliance hooks. Appendix claim providers are
 * optional. The SEP-57 three-argument burn and SEP-41 two-argument burn remain
 * distinct; matching one provider does not establish a match against the other.
 */
export const SEP57: Sep57Catalog = {
  versions: interfaces.rwaToken.versions,
  latest: interfaces.rwaToken.latest,
  interfaces,
  profiles: { minimum, reference: interfaces },
};
