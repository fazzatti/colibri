import { analyzeContractInterface } from "@/contract/interface/analyze-contract-interface.ts";
import type {
  ContractSpec,
  ContractStandardProvider,
} from "@/contract/interface/types.ts";

/** Returns only whether a contract spec matches one interface provider. */
export const matchesContractInterface = (
  spec: ContractSpec,
  provider: ContractStandardProvider,
): boolean => analyzeContractInterface(spec, provider).matches;
