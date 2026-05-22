// deno-coverage-ignore-file
import { Spec } from "stellar-sdk/contract";

export const ErrorByCode = {
  1: { message: "One" },
  265: { message: "TwoHundredSixtyFive" },
  3477: { message: "ThreeThousandFourHundredSeventySeven" },
  65535: { message: "SixtyFiveThousandFiveHundredThirtyFive" },
  700001: { message: "SevenHundredThousandOne" },
};

export const ERRORS_CONTRACT_SPEC = new Spec([
  "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABQAAAAAAAAADT25lAAAAAAEAAAAAAAAAE1R3b0h1bmRyZWRTaXh0eUZpdmUAAAABCQAAAAAAAAAkVGhyZWVUaG91c2FuZEZvdXJIdW5kcmVkU2V2ZW50eVNldmVuAAANlQAAAAAAAAAmU2l4dHlGaXZlVGhvdXNhbmRGaXZlSHVuZHJlZFRoaXJ0eUZpdmUAAAAA//8AAAAAAAAAF1NldmVuSHVuZHJlZFRob3VzYW5kT25lAAAKrmE=",
  "AAAAAAAAAAAAAAAedHJpZ2dlcl9jcm9zc19jb250cmFjdF9ieV9jb2RlAAAAAAACAAAAAAAAAA90YXJnZXRfY29udHJhY3QAAAAAEwAAAAAAAAAKZXJyb3JfY29kZQAAAAAABAAAAAEAAAAR",
  "AAAAAAAAAAAAAAAedHJpZ2dlcl9jcm9zc19jb250cmFjdF9nZW5lcmljAAAAAAACAAAAAAAAAA90YXJnZXRfY29udHJhY3QAAAAAEwAAAAAAAAAHbWVzc2FnZQAAAAAQAAAAAQAAABE=",
  "AAAAAAAAAAAAAAAadHJpZ2dlcl9jcm9zc19yZXRocm93X2NvZGUAAAAAAAMAAAAAAAAAD3RhcmdldF9jb250cmFjdAAAAAATAAAAAAAAABF0YXJnZXRfZXJyb3JfY29kZQAAAAAAAAQAAAAAAAAAEnJldGhyb3dfZXJyb3JfY29kZQAAAAAABAAAAAEAAAAR",
  "AAAAAAAAAAAAAAAPdHJpZ2dlcl9ieV9jb2RlAAAAAAEAAAAAAAAACmVycm9yX2NvZGUAAAAAAAQAAAABAAAAEQ==",
  "AAAAAAAAAAAAAAAPdHJpZ2dlcl9nZW5lcmljAAAAAAEAAAAAAAAAB21lc3NhZ2UAAAAAEAAAAAEAAAAR",
]);

export enum ERRORS_CONTRACT_METHODS {
  trigger_cross_contract_by_code = "trigger_cross_contract_by_code",
  trigger_cross_contract_generic = "trigger_cross_contract_generic",
  trigger_cross_rethrow_code = "trigger_cross_rethrow_code",
  trigger_by_code = "trigger_by_code",
  trigger_generic = "trigger_generic",
}
