import { BuildVerificationError, Code } from "../../error/base.ts";

/** Raised when metadata parsing fails outside its typed core contract. */
export class ParseContractMetadataUnexpectedError
  extends BuildVerificationError<Code.PARSE_METADATA_UNEXPECTED> {
  /** Creates an unexpected metadata-process error. */
  constructor(cause: unknown) {
    super({
      code: Code.PARSE_METADATA_UNEXPECTED,
      source: "@colibri/build-verification/processes/parse-contract-metadata",
      message: "Unexpected contract metadata parsing failure",
      details: "The metadata process failed outside a known typed occurrence.",
      cause,
    });
  }
}
