import {
  functionDefinition,
  interfaceDefinition,
  standardProvider,
  types,
} from "@/contract/interface/standards/definition.ts";
import type {
  ContractInterfaceDefinition,
  ContractStandardCatalog,
} from "@/contract/interface/types.ts";

const tokenizedVault: ContractInterfaceDefinition = interfaceDefinition(
  "tokenized-vault",
  "Tokenized Vault",
  [
    functionDefinition("total_supply", [], [types.i128]),
    functionDefinition("query_asset", [], [types.address]),
    functionDefinition("total_assets", [], [types.i128]),
    functionDefinition("convert_to_shares", [["assets", types.i128]], [
      types.i128,
    ]),
    functionDefinition("convert_to_assets", [["shares", types.i128]], [
      types.i128,
    ]),
    functionDefinition("max_deposit", [["receiver", types.address]], [
      types.i128,
    ]),
    functionDefinition("preview_deposit", [["assets", types.i128]], [
      types.i128,
    ]),
    functionDefinition("deposit", [
      ["assets", types.i128],
      ["receiver", types.address],
      ["from", types.address],
      ["operator", types.address],
    ], [types.i128]),
    functionDefinition("max_mint", [["receiver", types.address]], [types.i128]),
    functionDefinition("preview_mint", [["shares", types.i128]], [types.i128]),
    functionDefinition("mint", [
      ["shares", types.i128],
      ["receiver", types.address],
      ["from", types.address],
      ["operator", types.address],
    ], [types.i128]),
    functionDefinition("max_withdraw", [["owner", types.address]], [
      types.i128,
    ]),
    functionDefinition("preview_withdraw", [["assets", types.i128]], [
      types.i128,
    ]),
    functionDefinition("withdraw", [
      ["assets", types.i128],
      ["receiver", types.address],
      ["owner", types.address],
      ["operator", types.address],
    ], [types.i128]),
    functionDefinition("max_redeem", [["owner", types.address]], [types.i128]),
    functionDefinition("preview_redeem", [["shares", types.i128]], [
      types.i128,
    ]),
    functionDefinition("redeem", [
      ["shares", types.i128],
      ["receiver", types.address],
      ["owner", types.address],
      ["operator", types.address],
    ], [types.i128]),
  ],
);

/** SEP-56 document versions represented by the bundled providers. */
export type Sep56Version = "0.1.0" | "0.1.1" | "0.1.2";

const versions: ContractStandardCatalog<Sep56Version>["versions"] = {
  "0.1.0": standardProvider(56, "0.1.0", tokenizedVault),
  "0.1.1": standardProvider(56, "0.1.1", tokenizedVault),
  "0.1.2": standardProvider(56, "0.1.2", tokenizedVault),
} as const;

/** SEP-56 Tokenized Vault Interface providers. */
export const SEP56: ContractStandardCatalog<Sep56Version> = {
  versions,
  latest: versions["0.1.2"],
} as const;
