import { ColibriError, type Diagnostic } from "@colibri/core";
import { Asset } from "stellar-sdk";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type ContractErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: unknown;
};

export abstract class ContractError<Code extends string> extends ColibriError<
  Code,
  Meta
> {
  override readonly meta: Meta;

  constructor(args: ContractErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "plugins" as const,
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
  FAILED_TO_WRAP_ASSET = "CONTR_009",
  CONTRACT_INSTANCE_NOT_FOUND = "CONTR_010",
  CONTRACT_CODE_NOT_FOUND = "CONTR_011",
}

export class UNEXPECTED_ERROR extends ContractError<Code> {
  constructor(cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "An unexpected error occurred in the Contract module!",
      details: "See the 'cause' for more details",
      cause,
      data: {},
    });
  }
}

export class MISSING_ARG extends ContractError<Code> {
  constructor(argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      details: `The argument '${argName}' is required to construct a new Contract instance but was not provided.`,
      data: { argName },
    });
  }
}

export class MISSING_RPC_URL extends ContractError<Code> {
  constructor() {
    super({
      code: Code.MISSING_RPC_URL,
      message: `Missing required argument: rpcUrl`,
      details: `The argument 'rpcUrl' is required in the provided 'networkConfig'.`,
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

export class INVALID_CONTRACT_CONFIG extends ContractError<Code> {
  constructor() {
    super({
      code: Code.INVALID_CONTRACT_CONFIG,
      message: `Invalid contract configuration`,
      details: `The contract must be initialized with at least one of the following: contractId, wasm, wasmHash.`,
      data: {},
    });
  }
}

export class FAILED_TO_UPLOAD_WASM extends ContractError<Code> {
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_UPLOAD_WASM,
      message: `Failed to upload WASM to the network`,
      details: `An error occurred while attempting to upload the provided WASM to the Stellar network. See the 'cause' for more details.`,
      cause,
      data: {},
    });
  }
}

export class MISSING_REQUIRED_PROPERTY extends ContractError<Code> {
  constructor(propertyName: string) {
    super({
      code: Code.MISSING_REQUIRED_PROPERTY,
      message: `Missing required contract property: ${propertyName}`,
      details: `The contract property '${propertyName}' is required but was not set.`,
      diagnostic: {
        suggestion: `Ensure that the contract is initialized and configured to include the required property.`,
        rootCause: `The contract cannot execute the function called properly without the required property '${propertyName}'.`,
      },
      data: { propertyName },
    });
  }
}

export class MISSING_SPEC_IN_WASM extends ContractError<Code> {
  constructor() {
    super({
      code: Code.MISSING_SPEC_IN_WASM,
      message: `Missing spec in WASM`,
      details: `The provided WASM does not contain a valid spec.`,
      diagnostic: {
        suggestion: `Ensure that the WASM file is correctly compiled and includes the necessary spec information.`,
        rootCause: `The contract could not load a 'Spec' from the WASM binaries. These are included in the 'contractspecv0' section of the compiled file.`,
      },
      data: {},
    });
  }
}

export class FAILED_TO_DEPLOY_CONTRACT extends ContractError<Code> {
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_DEPLOY_CONTRACT,
      message: `Failed to deploy contract to the network`,
      details: `An error occurred while attempting to deploy the contract to the Stellar network. See the 'cause' for more details.`,
      cause,
      data: {},
    });
  }
}

export class PROPERTY_ALREADY_SET extends ContractError<Code> {
  constructor(propertyName: string) {
    super({
      code: Code.PROPERTY_ALREADY_SET,
      message: `Property already set: ${propertyName}`,
      details: `The contract property '${propertyName}' has already been set and cannot be modified.`,
      diagnostic: {
        suggestion: `If you need to change the value of '${propertyName}', consider creating a new Contract instance.`,
        rootCause: `To maintain the integrity and consistency of the contract, certain properties are immutable once set. The function called attempted to modify such a property.`,
      },
      data: { propertyName },
    });
  }
}

export class FAILED_TO_WRAP_ASSET extends ContractError<Code> {
  constructor(asset: Asset, cause: Error) {
    super({
      code: Code.FAILED_TO_WRAP_ASSET,
      message: `Failed to wrap asset`,
      details: `An error occurred while attempting to wrap the asset. See the 'cause' for more details.`,
      cause,
      data: {
        asset: {
          code: asset.code,
          issuer: asset.issuer,
        },
      },
    });
  }
}

export class CONTRACT_INSTANCE_NOT_FOUND extends ContractError<Code> {
  constructor(contractId: string) {
    super({
      code: Code.CONTRACT_INSTANCE_NOT_FOUND,
      message: `Contract instance not found: ${contractId}`,
      details: `The contract instance with ID '${contractId}' was not found on the Stellar network.`,
      diagnostic: {
        suggestion: `Verify that the contract ID is correct and that the contract has been deployed to the network.`,
        rootCause: `The contract ID provided does not correspond to any existing contract instance on the network. This could be due to a typo in the ID or because the contract has not been deployed yet.`,
      },
      data: { contractId },
    });
  }
}

export class CONTRACT_CODE_NOT_FOUND extends ContractError<Code> {
  constructor(wasmHash: string) {
    super({
      code: Code.CONTRACT_CODE_NOT_FOUND,
      message: `Contract code not found for WASM hash: ${wasmHash}`,
      details: `No contract code was found on the Stellar network for the provided WASM hash '${wasmHash}'.`,
      diagnostic: {
        suggestion: `Ensure that the WASM hash is correct and that the corresponding contract code has been uploaded to the network.`,
        rootCause: `The WASM hash provided does not match any contract code stored on the network. This could be due to an incorrect hash or because the contract code has not been uploaded yet.`,
      },
      data: { wasmHash },
    });
  }
}

export const ERROR_CONTR = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.MISSING_RPC_URL]: MISSING_RPC_URL,
  [Code.INVALID_CONTRACT_CONFIG]: INVALID_CONTRACT_CONFIG,
  [Code.FAILED_TO_UPLOAD_WASM]: FAILED_TO_UPLOAD_WASM,
  [Code.MISSING_REQUIRED_PROPERTY]: MISSING_REQUIRED_PROPERTY,
  [Code.MISSING_SPEC_IN_WASM]: MISSING_SPEC_IN_WASM,
  [Code.FAILED_TO_DEPLOY_CONTRACT]: FAILED_TO_DEPLOY_CONTRACT,
  [Code.PROPERTY_ALREADY_SET]: PROPERTY_ALREADY_SET,
  [Code.FAILED_TO_WRAP_ASSET]: FAILED_TO_WRAP_ASSET,
  [Code.CONTRACT_INSTANCE_NOT_FOUND]: CONTRACT_INSTANCE_NOT_FOUND,
  [Code.CONTRACT_CODE_NOT_FOUND]: CONTRACT_CODE_NOT_FOUND,
};
