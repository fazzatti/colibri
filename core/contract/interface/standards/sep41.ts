import {
  functionDefinition,
  interfaceDefinition,
  standardProvider,
  types,
} from "@/contract/interface/standards/definition.ts";
import type {
  ContractInterfaceDefinition,
  ContractInterfaceFunction,
  ContractStandardCatalog,
} from "@/contract/interface/types.ts";
import type { xdr } from "stellar-sdk";

const commonFunctions = (
  transferDestination: xdr.ScSpecTypeDef,
): readonly ContractInterfaceFunction[] => [
  functionDefinition("allowance", [
    ["from", types.address],
    ["spender", types.address],
  ], [types.i128]),
  functionDefinition("approve", [
    ["from", types.address],
    ["spender", types.address],
    ["amount", types.i128],
    ["live_until_ledger", types.u32],
  ]),
  functionDefinition("balance", [["id", types.address]], [types.i128]),
  functionDefinition("transfer", [
    ["from", types.address],
    ["to", transferDestination],
    ["amount", types.i128],
  ]),
  functionDefinition("transfer_from", [
    ["spender", types.address],
    ["from", types.address],
    ["to", types.address],
    ["amount", types.i128],
  ]),
  functionDefinition("burn", [
    ["from", types.address],
    ["amount", types.i128],
  ]),
  functionDefinition("burn_from", [
    ["spender", types.address],
    ["from", types.address],
    ["amount", types.i128],
  ]),
  functionDefinition("decimals", [], [types.u32]),
  functionDefinition("name", [], [types.string]),
  functionDefinition("symbol", [], [types.string]),
];

const v010Interface: ContractInterfaceDefinition = interfaceDefinition(
  "token",
  "Token",
  [
    ...commonFunctions(types.address),
    functionDefinition(
      "spendable_balance",
      [["id", types.address]],
      [types.i128],
    ),
  ],
);
const addressInterface: ContractInterfaceDefinition = interfaceDefinition(
  "token",
  "Token",
  commonFunctions(types.address),
);
const muxedInterface: ContractInterfaceDefinition = interfaceDefinition(
  "token",
  "Token",
  commonFunctions(types.muxedAddress),
);

/** SEP-41 functions used when composing explicitly dependent standards. */
export const SEP41_LATEST_FUNCTIONS = muxedInterface.functions;

/** SEP-41 document versions represented by the bundled providers. */
export type Sep41Version =
  | "0.1.0"
  | "0.2.0"
  | "0.3.0"
  | "0.4.0"
  | "0.4.1"
  | "0.5.0"
  | "0.5.1";

const versions: ContractStandardCatalog<Sep41Version>["versions"] = {
  "0.1.0": standardProvider(41, "0.1.0", v010Interface),
  "0.2.0": standardProvider(41, "0.2.0", addressInterface),
  "0.3.0": standardProvider(41, "0.3.0", addressInterface),
  "0.4.0": standardProvider(41, "0.4.0", muxedInterface),
  "0.4.1": standardProvider(41, "0.4.1", muxedInterface),
  "0.5.0": standardProvider(41, "0.5.0", muxedInterface),
  "0.5.1": standardProvider(41, "0.5.1", muxedInterface),
} as const;

/** SEP-41 Soroban Token Interface providers. */
export const SEP41: ContractStandardCatalog<Sep41Version> = {
  versions,
  latest: versions["0.5.1"],
} as const;
