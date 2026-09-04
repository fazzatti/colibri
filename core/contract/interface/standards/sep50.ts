import {
  functionDefinition,
  interfaceDefinition,
  standardProvider,
  types,
  typeVariable,
} from "@/contract/interface/standards/definition.ts";
import type {
  ContractInterfaceDefinition,
  ContractInterfaceTypeRequirement,
  ContractStandardCatalog,
} from "@/contract/interface/types.ts";
import type { xdr } from "stellar-sdk";

const unsignedIntegerTypes: readonly xdr.ScSpecTypeDef[] = [
  types.u32,
  types.u64,
  types.u128,
  types.u256,
];
const tokenId: ContractInterfaceTypeRequirement = typeVariable(
  "token-id",
  unsignedIntegerTypes,
);
const balance: ContractInterfaceTypeRequirement = typeVariable(
  "balance",
  unsignedIntegerTypes,
);

const nonFungibleToken: ContractInterfaceDefinition = interfaceDefinition(
  "non-fungible-token",
  "Non-Fungible Token",
  [
    functionDefinition("balance", [["owner", types.address]], [balance]),
    functionDefinition("owner_of", [["token_id", tokenId]], [types.address]),
    functionDefinition("transfer", [
      ["from", types.address],
      ["to", types.address],
      ["token_id", tokenId],
    ]),
    functionDefinition("transfer_from", [
      ["spender", types.address],
      ["from", types.address],
      ["to", types.address],
      ["token_id", tokenId],
    ]),
    functionDefinition("approve", [
      ["approver", types.address],
      ["approved", types.address],
      ["token_id", tokenId],
      ["live_until_ledger", types.u32],
    ]),
    functionDefinition("approve_for_all", [
      ["owner", types.address],
      ["operator", types.address],
      ["live_until_ledger", types.u32],
    ]),
    functionDefinition(
      "get_approved",
      [["token_id", tokenId]],
      [types.option(types.address)],
    ),
    functionDefinition("is_approved_for_all", [
      ["owner", types.address],
      ["operator", types.address],
    ], [types.bool]),
    functionDefinition("name", [], [types.string]),
    functionDefinition("symbol", [], [types.string]),
    functionDefinition("token_uri", [["token_id", tokenId]], [types.string]),
  ],
);

const versions: ContractStandardCatalog<"0.1.0">["versions"] = {
  "0.1.0": standardProvider(50, "0.1.0", nonFungibleToken),
} as const;

/** SEP-50 Non-Fungible Token Interface providers. */
export const SEP50: ContractStandardCatalog<"0.1.0"> = {
  versions,
  latest: versions["0.1.0"],
} as const;
