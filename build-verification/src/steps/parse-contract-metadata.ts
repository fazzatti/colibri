import { type Step, step } from "convee";
import { parseContractMetadata } from "@/processes/parse-contract-metadata/index.ts";
import { PARSE_CONTRACT_METADATA_STEP_ID } from "@/steps/ids.ts";

/** Creates the parse-contract-metadata step used in verifier pipelines. */
export const createParseContractMetadataStep = (): Step<
  Parameters<typeof parseContractMetadata>[0],
  Awaited<ReturnType<typeof parseContractMetadata>>,
  Error,
  typeof PARSE_CONTRACT_METADATA_STEP_ID
> => step(parseContractMetadata, { id: PARSE_CONTRACT_METADATA_STEP_ID });
