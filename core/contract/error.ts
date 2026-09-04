import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

/**
 * Metadata stored on contract errors.
 */
export type Meta = {
  cause: Error | null;
  data: unknown;
};

/**
 * Shape accepted by {@link ContractError} constructors.
 */
export type ContractErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: unknown;
};

/**
 * Base class for contract-module errors.
 */
export abstract class ContractError<Code extends string> extends ColibriError<
  Code,
  Meta
> {
  /** Structured metadata attached to the error instance. */
  override readonly meta: Meta;

  /**
   * Creates a contract error with Colibri-standard metadata.
   *
   * @param args - Error payload used to build the instance.
   */
  constructor(args: ContractErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "contract" as const,
      source: "@colibri/contract",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic || undefined,
      meta,
    });

    this.meta = meta;
  }
}

/**
 * Stable error codes emitted by the contract module.
 */
export enum Code {
  UNEXPECTED_ERROR = "CONTR_000",
  MISSING_ARG = "CONTR_001",
  MISSING_RPC_URL = "CONTR_002",
  INVALID_CONTRACT_CONFIG = "CONTR_003",
  FAILED_TO_UPLOAD_WASM = "CONTR_004",
  MISSING_REQUIRED_PROPERTY = "CONTR_005",
  PROPERTY_ALREADY_SET = "CONTR_006",
  MISSING_SPEC_IN_WASM = "CONTR_007",
  FAILED_TO_DEPLOY_CONTRACT = "CONTR_008",
  CONTRACT_INSTANCE_NOT_FOUND = "CONTR_009",
  CONTRACT_CODE_NOT_FOUND = "CONTR_010",
  INVALID_CONTRACT_ID = "CONTR_011",
  CONTRACT_ERROR_MATCHER_ALREADY_CONFIGURED = "CONTR_012",
  CONTRACT_CONFIG_SOURCES_CONFLICT = "CONTR_013",
  STELLAR_ASSET_EXECUTABLE_HAS_NO_WASM = "CONTR_014",
  NETWORK_EXECUTABLE_NOT_AVAILABLE = "CONTR_015",
  INVALID_WASM_FOR_METADATA = "CONTR_016",
  FAILED_TO_DECODE_METADATA_SECTION = "CONTR_017",
  INVALID_SEP_IDENTIFIER = "CONTR_018",
  INVALID_WASM_FOR_SPEC = "CONTR_019",
  FAILED_TO_DECODE_SPEC_SECTION = "CONTR_020",
}

// Currently unused, reserving
//
// export class UNEXPECTED_ERROR extends ContractError<Code> {
//   constructor(cause: Error) {
//     super({
//       code: Code.UNEXPECTED_ERROR,
//       message: "An unexpected error occurred in the Contract module!",
//       details: "See the 'cause' for more details",
//       cause,
//       data: {},
//     });
//   }
// }

/**
 * Raised when a required contract constructor argument is missing.
 */
export class MISSING_ARG extends ContractError<Code> {
  /**
   * Creates a missing-argument contract error.
   *
   * @param argName - Name of the missing argument.
   */
  constructor(argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      details:
        `The argument '${argName}' is required to construct a new Contract instance but was not provided.`,
      data: { argName },
    });
  }
}

/**
 * Raised when no RPC server can be derived for the contract instance.
 */
export class MISSING_RPC_URL extends ContractError<Code> {
  /** Creates a missing-RPC-URL contract error. */
  constructor() {
    super({
      code: Code.MISSING_RPC_URL,
      message: `Missing required argument: rpcUrl`,
      details:
        `The argument 'rpcUrl' is required in the provided 'networkConfig'.`,
      diagnostic: {
        suggestion:
          "Either provide a 'rpc' instance or a valid 'rpcUrl' in the 'networkConfig'.",
        rootCause:
          "The 'rpcUrl' is necessary for the Contract to communicate with the Stellar network. When no 'rpc' instance is provided, the Contract needs the 'rpcUrl' to create its own Server instance.",
      },
      data: {},
    });
  }
}

/**
 * Raised when contract construction does not provide usable contract identity.
 */
export class INVALID_CONTRACT_CONFIG extends ContractError<Code> {
  /** Creates an invalid-contract-config error. */
  constructor() {
    super({
      code: Code.INVALID_CONTRACT_CONFIG,
      message: `Invalid contract configuration`,
      details:
        `The contract must be initialized with exactly one of the following: contractId, wasm, wasmHash, externalRef.`,
      data: {},
    });
  }
}

/** Raised when multiple mutually exclusive contract sources are configured. */
export class CONTRACT_CONFIG_SOURCES_CONFLICT extends ContractError<Code> {
  /**
   * Creates a conflicting-contract-sources error.
   *
   * @param configuredSources - Source property names supplied together.
   */
  constructor(configuredSources: readonly string[]) {
    super({
      code: Code.CONTRACT_CONFIG_SOURCES_CONFLICT,
      message: "Contract configuration sources conflict",
      details:
        "Contract configuration must select exactly one of contractId, wasm, wasmHash, or externalRef.",
      data: { configuredSources: [...configuredSources] },
    });
  }
}

/**
 * Raised when uploading WASM binaries fails.
 */
export class FAILED_TO_UPLOAD_WASM extends ContractError<Code> {
  /**
   * Creates a failed-upload error.
   *
   * @param cause - Underlying upload failure.
   */
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_UPLOAD_WASM,
      message: `Failed to upload WASM to the network`,
      details:
        `An error occurred while attempting to upload the provided WASM to the Stellar network. See the 'cause' for more details.`,
      cause,
      data: {},
    });
  }
}

/**
 * Raised when a required contract property has not been initialized.
 */
export class MISSING_REQUIRED_PROPERTY extends ContractError<Code> {
  /**
   * Creates a missing-property error.
   *
   * @param propertyName - Missing property name.
   */
  constructor(propertyName: string) {
    super({
      code: Code.MISSING_REQUIRED_PROPERTY,
      message: `Missing required contract property: ${propertyName}`,
      details:
        `The contract property '${propertyName}' is required but was not set.`,
      diagnostic: {
        suggestion:
          `Ensure that the contract is initialized and configured to include the required property.`,
        rootCause:
          `The contract cannot execute the function called properly without the required property '${propertyName}'.`,
      },
      data: { propertyName },
    });
  }
}

/**
 * Raised when the loaded WASM does not contain a contract specification.
 */
export class MISSING_SPEC_IN_WASM extends ContractError<Code> {
  /** Creates a missing-spec-in-wasm error. */
  constructor() {
    super({
      code: Code.MISSING_SPEC_IN_WASM,
      message: `Missing spec in WASM`,
      details: `The provided WASM does not contain a valid spec.`,
      diagnostic: {
        suggestion:
          `Ensure that the WASM file is correctly compiled and includes the necessary spec information.`,
        rootCause:
          `The contract could not load a 'Spec' from the WASM binaries. These are included in the 'contractspecv0' section of the compiled file.`,
      },
      data: {},
    });
  }
}

/**
 * Raised when deploying a contract fails.
 */
export class FAILED_TO_DEPLOY_CONTRACT extends ContractError<Code> {
  /**
   * Creates a failed-deploy error.
   *
   * @param cause - Underlying deployment failure.
   */
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_DEPLOY_CONTRACT,
      message: `Failed to deploy contract to the network`,
      details:
        `An error occurred while attempting to deploy the contract to the Stellar network. See the 'cause' for more details.`,
      cause,
      data: {},
    });
  }
}

/**
 * Raised when code tries to mutate an immutable contract property.
 */
export class PROPERTY_ALREADY_SET extends ContractError<Code> {
  /**
   * Creates a property-already-set error.
   *
   * @param propertyName - Immutable property name.
   */
  constructor(propertyName: string) {
    super({
      code: Code.PROPERTY_ALREADY_SET,
      message: `Property already set: ${propertyName}`,
      details:
        `The contract property '${propertyName}' has already been set and cannot be modified.`,
      diagnostic: {
        suggestion:
          `If you need to change the value of '${propertyName}', consider creating a new Contract instance.`,
        rootCause:
          `To maintain the integrity and consistency of the contract, certain properties are immutable once set. The function called attempted to modify such a property.`,
      },
      data: { propertyName },
    });
  }
}

/**
 * Raised when a contract instance ledger entry cannot be found.
 */
export class CONTRACT_INSTANCE_NOT_FOUND extends ContractError<Code> {
  /**
   * Creates a missing-contract-instance error.
   *
   * @param contractId - Contract id that was looked up.
   */
  constructor(contractId: string) {
    super({
      code: Code.CONTRACT_INSTANCE_NOT_FOUND,
      message: `Contract instance not found: ${contractId}`,
      details:
        `The contract instance with ID '${contractId}' was not found on the Stellar network.`,
      diagnostic: {
        suggestion:
          `Verify that the contract ID is correct and that the contract has been deployed to the network.`,
        rootCause:
          `The contract ID provided does not correspond to any existing contract instance on the network. This could be due to a typo in the ID or because the contract has not been deployed yet.`,
      },
      data: { contractId },
    });
  }
}

/**
 * Raised when uploaded contract code cannot be found on chain.
 */
export class CONTRACT_CODE_NOT_FOUND extends ContractError<Code> {
  /**
   * Creates a missing-contract-code error.
   *
   * @param wasmHash - WASM hash used for the lookup.
   */
  constructor(wasmHash: string) {
    super({
      code: Code.CONTRACT_CODE_NOT_FOUND,
      message: `Contract code not found for WASM hash: ${wasmHash}`,
      details:
        `No contract code was found on the Stellar network for the provided WASM hash '${wasmHash}'.`,
      diagnostic: {
        suggestion:
          `Ensure that the WASM hash is correct and that the corresponding contract code has been uploaded to the network.`,
        rootCause:
          `The WASM hash provided does not match any contract code stored on the network. This could be due to an incorrect hash or because the contract code has not been uploaded yet.`,
      },
      data: { wasmHash },
    });
  }
}

/** Raised when a Stellar Asset Contract is queried for a Wasm hash. */
export class STELLAR_ASSET_EXECUTABLE_HAS_NO_WASM extends ContractError<Code> {
  /** Creates a Stellar Asset Contract executable error. */
  constructor() {
    super({
      code: Code.STELLAR_ASSET_EXECUTABLE_HAS_NO_WASM,
      message: "Stellar Asset Contract executable has no Wasm hash",
      details:
        "Stellar Asset Contracts use the built-in protocol executable and cannot provide uploaded Wasm code.",
      data: {},
    });
  }
}

/** Raised when network loading has no deployed or uploaded executable source. */
export class NETWORK_EXECUTABLE_NOT_AVAILABLE extends ContractError<Code> {
  /** Creates a missing-network-executable error. */
  constructor() {
    super({
      code: Code.NETWORK_EXECUTABLE_NOT_AVAILABLE,
      message: "Network executable is not available",
      details:
        "Loading contract code from the network requires a contract id, uploaded Wasm hash, or external executable reference.",
      data: {},
    });
  }
}

/** Raised when metadata extraction receives bytes that are not valid Wasm. */
export class INVALID_WASM_FOR_METADATA extends ContractError<Code> {
  /** Creates an invalid-Wasm metadata error. */
  constructor(cause: Error) {
    super({
      code: Code.INVALID_WASM_FOR_METADATA,
      message: "Invalid Wasm for contract metadata extraction",
      details:
        "SEP-46 metadata can only be extracted from a valid WebAssembly module.",
      cause,
      data: {},
    });
  }
}

/** Raised when one SEP-46 metadata section does not contain valid XDR. */
export class FAILED_TO_DECODE_METADATA_SECTION extends ContractError<Code> {
  /** Creates a metadata-section decoding error. */
  constructor(sectionIndex: number, cause: Error) {
    super({
      code: Code.FAILED_TO_DECODE_METADATA_SECTION,
      message: "Failed to decode contract metadata section",
      details:
        "A contractmetav0 section did not contain a valid stream of SCMetaEntry XDR values.",
      cause,
      data: { sectionIndex },
    });
  }
}

/** Raised when a requested SEP number cannot identify a SEP. */
export class INVALID_SEP_IDENTIFIER extends ContractError<Code> {
  /** Creates an invalid-SEP-identifier error. */
  constructor(sep: number) {
    super({
      code: Code.INVALID_SEP_IDENTIFIER,
      message: "Invalid SEP identifier",
      details: "A SEP identifier must be a positive safe integer.",
      data: { sep },
    });
  }
}

/** Raised when specification extraction receives bytes that are not valid Wasm. */
export class INVALID_WASM_FOR_SPEC extends ContractError<Code> {
  /** Creates an invalid-Wasm specification error. */
  constructor(cause: Error) {
    super({
      code: Code.INVALID_WASM_FOR_SPEC,
      message: "Invalid Wasm for contract specification extraction",
      details:
        "A contract specification can only be extracted from a valid WebAssembly module.",
      cause,
      data: {},
    });
  }
}

/** Raised when one SEP-48 specification section does not contain valid XDR. */
export class FAILED_TO_DECODE_SPEC_SECTION extends ContractError<Code> {
  /** Creates a specification-section decoding error. */
  constructor(sectionIndex: number, cause: Error) {
    super({
      code: Code.FAILED_TO_DECODE_SPEC_SECTION,
      message: "Failed to decode contract specification section",
      details:
        "A contractspecv0 section did not contain a valid stream of SCSpecEntry XDR values.",
      cause,
      data: { sectionIndex },
    });
  }
}

/**
 * Raised when a contract id does not match the expected format.
 */
export class INVALID_CONTRACT_ID extends ContractError<Code> {
  /**
   * Creates an invalid-contract-id error.
   *
   * @param contractId - Invalid contract id value.
   */
  constructor(contractId: string) {
    super({
      code: Code.INVALID_CONTRACT_ID,
      message: `Invalid contract ID: ${contractId}`,
      details: `The provided contract ID '${contractId}' is not valid.`,
      diagnostic: {
        suggestion:
          `Ensure that the contract ID is correctly formatted and valid.`,
        rootCause:
          `The contract ID does not conform to the expected format or criteria.`,
      },
      data: { contractId },
    });
  }
}

/**
 * Raised when automatic contract-error loading would duplicate the matcher plugin.
 */
export class CONTRACT_ERROR_MATCHER_ALREADY_CONFIGURED
  extends ContractError<Code> {
  /**
   * Creates an already-configured contract-error matcher error.
   *
   * @param args - Which owned pipelines already contain the matcher plugin.
   */
  constructor(args: { invokePipe: boolean; readPipe: boolean }) {
    super({
      code: Code.CONTRACT_ERROR_MATCHER_ALREADY_CONFIGURED,
      message: "Contract error matcher already configured",
      details:
        "The contract error matcher plugin is already attached to at least one owned contract pipeline.",
      diagnostic: {
        suggestion:
          "Create a new Contract instance or configure plugins explicitly instead of calling loadContractErrorsFromWasm again.",
        rootCause:
          "Adding a second matcher would make plugin ordering and error matching behavior ambiguous.",
      },
      data: args,
    });
  }
}

/**
 * Contract error constructors indexed by stable error code.
 */
export const ERROR_CONTR = {
  // [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.MISSING_RPC_URL]: MISSING_RPC_URL,
  [Code.INVALID_CONTRACT_CONFIG]: INVALID_CONTRACT_CONFIG,
  [Code.FAILED_TO_UPLOAD_WASM]: FAILED_TO_UPLOAD_WASM,
  [Code.MISSING_REQUIRED_PROPERTY]: MISSING_REQUIRED_PROPERTY,
  [Code.MISSING_SPEC_IN_WASM]: MISSING_SPEC_IN_WASM,
  [Code.FAILED_TO_DEPLOY_CONTRACT]: FAILED_TO_DEPLOY_CONTRACT,
  [Code.PROPERTY_ALREADY_SET]: PROPERTY_ALREADY_SET,
  [Code.CONTRACT_INSTANCE_NOT_FOUND]: CONTRACT_INSTANCE_NOT_FOUND,
  [Code.CONTRACT_CODE_NOT_FOUND]: CONTRACT_CODE_NOT_FOUND,
  [Code.INVALID_CONTRACT_ID]: INVALID_CONTRACT_ID,
  [Code.CONTRACT_ERROR_MATCHER_ALREADY_CONFIGURED]:
    CONTRACT_ERROR_MATCHER_ALREADY_CONFIGURED,
  [Code.CONTRACT_CONFIG_SOURCES_CONFLICT]: CONTRACT_CONFIG_SOURCES_CONFLICT,
  [Code.STELLAR_ASSET_EXECUTABLE_HAS_NO_WASM]:
    STELLAR_ASSET_EXECUTABLE_HAS_NO_WASM,
  [Code.NETWORK_EXECUTABLE_NOT_AVAILABLE]: NETWORK_EXECUTABLE_NOT_AVAILABLE,
  [Code.INVALID_WASM_FOR_METADATA]: INVALID_WASM_FOR_METADATA,
  [Code.FAILED_TO_DECODE_METADATA_SECTION]: FAILED_TO_DECODE_METADATA_SECTION,
  [Code.INVALID_SEP_IDENTIFIER]: INVALID_SEP_IDENTIFIER,
  [Code.INVALID_WASM_FOR_SPEC]: INVALID_WASM_FOR_SPEC,
  [Code.FAILED_TO_DECODE_SPEC_SECTION]: FAILED_TO_DECODE_SPEC_SECTION,
};
