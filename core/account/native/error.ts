import { AccountError } from "@/account/error.ts";

/**
 * Stable error codes emitted by the native-account helpers.
 */
export enum Code {
  // UNEXPECTED = "ACC_NAT_000", // Reserved for unexpected errors - not currently used in NativeAccount
  INVALID_ED25519_PUBLIC_KEY = "ACC_NAT_001",
  INVALID_MUXED_ID = "ACC_NAT_002",
  INVALID_MUXED_ADDRESS_GENERATED = "ACC_NAT_003",
  MISSING_MASTER_SIGNER = "ACC_NAT_004",
  UNSUPPORTED_ADDRESS_TYPE = "ACC_NAT_005",
}

/**
 * Metadata payload carried by native-account errors.
 */
export type MetaData = unknown;

/**
 * Base class for native-account errors.
 */
export abstract class NativeAccountError extends AccountError<Code, MetaData> {
  /** Source identifier for native-account failures. */
  override readonly source = "@colibri/core/account/native";
}

// Reserved for unexpected errors - not currently used in NativeAccount
// All error cases in NativeAccount are expected/recoverable user input errors
// for now
//
// export class UNEXPECTED extends NativeAccountError {
//   constructor(cause: Error) {
//     super({
//       code: Code.UNEXPECTED,
//       message: "An unexpected error occurred when using Friendbot!",
//       data: null,
//       details: "See the 'cause' for more details",
//       cause,
//     });
//   }
// }

/**
 * Raised when the provided public key is not a valid Stellar ed25519 account id.
 */
export class INVALID_ED25519_PUBLIC_KEY extends NativeAccountError {
  /**
   * Creates an invalid-ed25519-public-key error.
   *
   * @param address - Invalid account public key.
   */
  constructor(address: string) {
    super({
      code: Code.INVALID_ED25519_PUBLIC_KEY,
      message: "The provided ED25519 public key is invalid!",
      data: null,
      details: `When validating the provided public key '${address}', it was found to not match the expected ED25519 format with the Strkey encoding.`,
      diagnostic: {
        rootCause: "The public key is not properly formatted.",
        suggestion:
          "Ensure the public key is a valid ED25519 key and properly encoded in standard Strkey format for Stellar addresses.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md",
        ],
      },
    });
  }
}

/**
 * Raised when the provided muxed id is not a valid uint64 string.
 */
export class INVALID_MUXED_ID extends NativeAccountError {
  /**
   * Creates an invalid-muxed-id error.
   *
   * @param id - Invalid muxed id.
   */
  constructor(id: string) {
    super({
      code: Code.INVALID_MUXED_ID,
      message: "The provided Muxed ID is invalid!",
      data: null,
      details: `When validating the provided Muxed ID '${id}', it was found to not be a valid uint64 string.`,
      diagnostic: {
        rootCause: "The Muxed ID is not a valid uint64 string.",
        suggestion:
          "Ensure the Muxed ID is a valid uint64 string representing the desired Muxed Account ID.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/core/cap-0027.md",
        ],
      },
    });
  }
}

/**
 * Raised when generating a muxed address produces an invalid value.
 */
export class INVALID_MUXED_ADDRESS_GENERATED extends NativeAccountError {
  /** Structured metadata describing the invalid muxed address output. */
  override readonly meta: {
    data: {
      muxedAddress: string;
      muxedId: string;
      baseAddress: string;
    };
    cause: null;
  };

  /**
   * Creates an invalid-generated-muxed-address error.
   *
   * @param address - Invalid generated muxed address.
   * @param id - Muxed id used to generate the address.
   * @param baseAddress - Base account address used to generate the muxed address.
   */
  constructor(address: string, id: string, baseAddress: string) {
    super({
      code: Code.INVALID_MUXED_ADDRESS_GENERATED,
      message: "The Muxed Address generated is invalid!",
      data: null,
      details: `Something went wrong when generating the Muxed Address with the provided id. Check the parameters used under the 'meta' section and make sure they are correct.`,
    });

    this.meta = {
      data: {
        muxedAddress: address,
        muxedId: id,
        baseAddress,
      },
      cause: null,
    };
  }
}

/**
 * Raised when a native account is used without a master signer.
 */
export class MISSING_MASTER_SIGNER extends NativeAccountError {
  /**
   * Creates a missing-master-signer error.
   *
   * @param address - Native account address missing its signer.
   */
  constructor(address: string) {
    super({
      code: Code.MISSING_MASTER_SIGNER,
      message: "The master signer is missing!",
      data: null,
      details: `The master signer is required for this operation but is missing. Make sure to provide a valid master signer when creating the NativeAccount instance.`,
      diagnostic: {
        rootCause: `The NativeAccount instance for ${address} was created without a master signer.`,
        suggestion:
          "Provide a valid master signer when creating the NativeAccount instance if you plan to perform operations that require it.",
      },
    });
  }
}

/**
 * Raised when the provided address type is unsupported by native accounts.
 */
export class UNSUPPORTED_ADDRESS_TYPE extends NativeAccountError {
  /**
   * Creates an unsupported-address-type error.
   *
   * @param address - Unsupported address value.
   */
  constructor(address: string) {
    super({
      code: Code.UNSUPPORTED_ADDRESS_TYPE,
      message: "The provided address type is unsupported!",
      data: null,
      details: `The address '${address}' is of an unsupported type for NativeAccount. Only ED25519 public keys are supported.`,
      diagnostic: {
        rootCause: "The address type is not supported by NativeAccount.",
        suggestion:
          "Use an ED25519 public key as the address for NativeAccount instances.",
      },
    });
  }
}

/**
 * Native-account error constructors indexed by stable code.
 */
export const ERROR_ACC_NAT = {
  // [Code.UNEXPECTED]: UNEXPECTED,
  [Code.INVALID_ED25519_PUBLIC_KEY]: INVALID_ED25519_PUBLIC_KEY,
  [Code.INVALID_MUXED_ID]: INVALID_MUXED_ID,
  [Code.INVALID_MUXED_ADDRESS_GENERATED]: INVALID_MUXED_ADDRESS_GENERATED,
  [Code.MISSING_MASTER_SIGNER]: MISSING_MASTER_SIGNER,
  [Code.UNSUPPORTED_ADDRESS_TYPE]: UNSUPPORTED_ADDRESS_TYPE,
};
