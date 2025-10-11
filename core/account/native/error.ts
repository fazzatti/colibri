import { AccountError } from "../error.ts";

export enum Code {
  UNEXPECTED = "ACC_NAT_000",
  INVALID_ED25519_PUBLIC_KEY = "ACC_NAT_001",
  INVALID_MUXED_ID = "ACC_NAT_002",

  INVALID_MUXED_ADDRESS_GENERATED = "ACC_NAT_003",
  MISSING_MASTER_SIGNER = "ACC_NAT_004",
}
export type MetaData = unknown;

export abstract class NativeAccountError extends AccountError<Code, MetaData> {
  override readonly source = "@colibri/core/account/native";
}

export class UNEXPECTED extends NativeAccountError {
  constructor(cause: Error) {
    super({
      code: Code.UNEXPECTED,
      message: "An unexpected error occurred when using Friendbot!",
      data: null,
      details: "See the 'cause' for more details",
      cause,
    });
  }
}

export class INVALID_ED25519_PUBLIC_KEY extends NativeAccountError {
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

export class INVALID_MUXED_ID extends NativeAccountError {
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

export class INVALID_MUXED_ADDRESS_GENERATED extends NativeAccountError {
  override readonly meta: {
    data: {
      muxedAddress: string;
      muxedId: string;
      baseAddress: string;
    };
    cause: null;
  };

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

export class MISSING_MASTER_SIGNER extends NativeAccountError {
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

export const ERROR_ACC_NAT = {
  [Code.UNEXPECTED]: UNEXPECTED,
  [Code.INVALID_ED25519_PUBLIC_KEY]: INVALID_ED25519_PUBLIC_KEY,
  [Code.INVALID_MUXED_ID]: INVALID_MUXED_ID,
  [Code.INVALID_MUXED_ADDRESS_GENERATED]: INVALID_MUXED_ADDRESS_GENERATED,
  [Code.MISSING_MASTER_SIGNER]: MISSING_MASTER_SIGNER,
};
