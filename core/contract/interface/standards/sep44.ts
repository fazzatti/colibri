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

const memoExtension: ContractInterfaceDefinition = interfaceDefinition(
  "token-memo-extension",
  "Token Memo Extension",
  [
    functionDefinition("transfer_memo", [
      ["from", types.address],
      ["to", types.address],
      ["amount", types.i128],
      ["memo", types.u64],
    ]),
  ],
);

/** SEP-44 document versions represented by the bundled providers. */
export type Sep44Version = "0.1.0" | "0.2.0" | "0.2.1";

const versions: ContractStandardCatalog<Sep44Version>["versions"] = {
  "0.1.0": standardProvider(44, "0.1.0", memoExtension),
  "0.2.0": standardProvider(44, "0.2.0", memoExtension),
  "0.2.1": standardProvider(44, "0.2.1", memoExtension),
} as const;

/** SEP-44 token memo-extension interface providers. */
export const SEP44: ContractStandardCatalog<Sep44Version> = {
  versions,
  latest: versions["0.2.1"],
} as const;
