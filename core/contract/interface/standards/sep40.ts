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
  ContractStandardCatalog,
} from "@/contract/interface/types.ts";

const priceFeed: ContractInterfaceDefinition = interfaceDefinition(
  "price-feed",
  "Price Feed",
  [
    functionDefinition("base", [], [types.udt("Asset")]),
    functionDefinition("assets", [], [types.vec(types.udt("Asset"))]),
    functionDefinition("decimals", [], [types.u32]),
    functionDefinition("resolution", [], [types.u32]),
    functionDefinition("price", [
      ["asset", types.udt("Asset")],
      ["timestamp", types.u64],
    ], [types.option(types.udt("PriceData"))]),
    functionDefinition("prices", [
      ["asset", types.udt("Asset")],
      ["records", types.u32],
    ], [types.option(types.vec(types.udt("PriceData")))]),
    functionDefinition("lastprice", [
      ["asset", types.udt("Asset")],
    ], [types.option(types.udt("PriceData"))]),
  ],
  [
    unionDefinition("Asset", [
      ["Stellar", [types.address]],
      ["Other", [types.symbol]],
    ]),
    structDefinition("PriceData", [
      ["price", types.i128],
      ["timestamp", types.u64],
    ]),
  ],
);

const versions: ContractStandardCatalog<"0.1.0">["versions"] = {
  "0.1.0": standardProvider(40, "0.1.0", priceFeed),
} as const;

/** SEP-40 Oracle Consumer Interface providers. */
export const SEP40: ContractStandardCatalog<"0.1.0"> = {
  versions,
  latest: versions["0.1.0"],
} as const;
