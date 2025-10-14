import { ColibriError, type Diagnostic } from "@colibri/core";

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

export const ERROR_CONTR = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.MISSING_RPC_URL]: MISSING_RPC_URL,
  [Code.INVALID_CONTRACT_CONFIG]: INVALID_CONTRACT_CONFIG,
  [Code.FAILED_TO_UPLOAD_WASM]: FAILED_TO_UPLOAD_WASM,
};
