/** Versioned contract-interface providers for SEPs with defined ABIs. */
export { SEP40 } from "@/contract/interface/standards/sep40.ts";
export {
  SEP41,
  type Sep41Version,
} from "@/contract/interface/standards/sep41.ts";
export {
  SEP44,
  type Sep44Version,
} from "@/contract/interface/standards/sep44.ts";
export { SEP50 } from "@/contract/interface/standards/sep50.ts";
export {
  SEP56,
  type Sep56Version,
} from "@/contract/interface/standards/sep56.ts";
export {
  SEP57,
  type Sep57Catalog,
  type Sep57InterfaceName,
  type Sep57Interfaces,
} from "@/contract/interface/standards/sep57.ts";

import { SEP40 } from "@/contract/interface/standards/sep40.ts";
import { SEP41 } from "@/contract/interface/standards/sep41.ts";
import { SEP44 } from "@/contract/interface/standards/sep44.ts";
import { SEP50 } from "@/contract/interface/standards/sep50.ts";
import { SEP56 } from "@/contract/interface/standards/sep56.ts";
import { SEP57 } from "@/contract/interface/standards/sep57.ts";

/** Known SEP contract-interface provider catalog shape. */
export type ContractStandardsRegistry = {
  /** SEP-40 Oracle Consumer Interface providers. */
  readonly SEP40: typeof SEP40;
  /** SEP-41 Soroban Token Interface providers. */
  readonly SEP41: typeof SEP41;
  /** SEP-44 Token Memo Extension providers. */
  readonly SEP44: typeof SEP44;
  /** SEP-50 Non-Fungible Token providers. */
  readonly SEP50: typeof SEP50;
  /** SEP-56 Tokenized Vault providers. */
  readonly SEP56: typeof SEP56;
  /** SEP-57 T-REX component providers. */
  readonly SEP57: typeof SEP57;
};

/** Known SEP contract-interface providers bundled with Colibri. */
export const ContractStandards: ContractStandardsRegistry = {
  SEP40,
  SEP41,
  SEP44,
  SEP50,
  SEP56,
  SEP57,
} as const;
