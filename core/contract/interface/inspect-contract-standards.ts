import { analyzeContractInterface } from "@/contract/interface/analyze-contract-interface.ts";
import { extractContractSpec } from "@/contract/interface/extract-contract-spec.ts";
import type {
  ContractStandardInspection,
  InspectContractStandardsArgs,
} from "@/contract/interface/types.ts";
import { extractContractMetadata } from "@/contract/metadata/extract-contract-metadata.ts";
import { extractSepClaims } from "@/contract/metadata/extract-sep-claims.ts";

/**
 * Inspects SEP-47 claims and Colibri interface compatibility for multiple
 * standard providers using one contract Wasm module.
 *
 * The two results remain independent. A declared claim does not make a
 * mismatching interface pass, and a matching interface does not fabricate a
 * missing SEP-47 declaration.
 */
export const inspectContractStandards = ({
  wasm,
  standards,
}: InspectContractStandardsArgs): readonly ContractStandardInspection[] => {
  const claims = extractSepClaims(extractContractMetadata(wasm));
  const spec = extractContractSpec(wasm);

  return standards.map((provider) => {
    const declarations = claims.claims.filter(({ sep }) =>
      sep === provider.sep
    );
    return {
      standard: {
        sep: provider.sep,
        version: provider.version,
        interfaceId: provider.interface.id,
        interfaceName: provider.interface.name,
      },
      claim: {
        declared: declarations.length > 0,
        declarations,
      },
      interface: analyzeContractInterface(spec, provider),
    };
  });
};
