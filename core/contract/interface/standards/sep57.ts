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
  ["topic", types.u32],
  ["scheme", types.u32],
  ["issuer", types.address],
  ["signature", types.bytes],
  ["data", types.bytes],
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

const version = "0.3.0";
/** Named primary, component, and appendix-reference SEP-57 interfaces. */
export type Sep57InterfaceName =
  | "rwaToken"
  | "identityVerifier"
  | "compliance"
  | "claimTopicsAndIssuers"
  | "identityRegistryStorage"
  | "identityClaims"
  | "claimIssuer";

/** SEP-57 provider catalogs indexed by interface name. */
export type Sep57Interfaces = Readonly<
  Record<Sep57InterfaceName, ContractStandardCatalog<"0.3.0">>
>;

/** Primary, component, and appendix-reference providers bundled for SEP-57. */
export type Sep57Catalog = ContractStandardCatalog<"0.3.0"> & {
  readonly interfaces: Sep57Interfaces;
};

const interfaces: Sep57Interfaces = {
  rwaToken: {
    versions: { [version]: standardProvider(57, version, rwaToken) },
    latest: standardProvider(57, version, rwaToken),
  },
  identityVerifier: {
    versions: { [version]: standardProvider(57, version, identityVerifier) },
    latest: standardProvider(57, version, identityVerifier),
  },
  compliance: {
    versions: { [version]: standardProvider(57, version, compliance) },
    latest: standardProvider(57, version, compliance),
  },
  claimTopicsAndIssuers: {
    versions: {
      [version]: standardProvider(57, version, claimTopicsAndIssuers),
    },
    latest: standardProvider(57, version, claimTopicsAndIssuers),
  },
  identityRegistryStorage: {
    versions: {
      [version]: standardProvider(57, version, identityRegistryStorage),
    },
    latest: standardProvider(57, version, identityRegistryStorage),
  },
  identityClaims: {
    versions: { [version]: standardProvider(57, version, identityClaims) },
    latest: standardProvider(57, version, identityClaims),
  },
  claimIssuer: {
    versions: { [version]: standardProvider(57, version, claimIssuer) },
    latest: standardProvider(57, version, claimIssuer),
  },
} as const;

/**
 * SEP-57 interface providers.
 *
 * `latest` and `versions` identify the primary RWA-token interface. The
 * `interfaces` collection also exposes the separately deployed identity and
 * compliance interfaces. Its claim-based identity entries model the optional
 * reference implementation in the SEP-57 appendix; they are not required for
 * every SEP-57 deployment.
 */
export const SEP57: Sep57Catalog = {
  versions: interfaces.rwaToken.versions,
  latest: interfaces.rwaToken.latest,
  interfaces,
} as const;
