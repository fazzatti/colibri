import { TransformerError } from "../../error.ts";
import type { MuxedAddress } from "../../../common/types.ts";
import { regex } from "../../../common/index.ts";

export enum Code {
  INVALID_MUXED_ADDRESS = "TRN_MTBA_001",
  FAILED_TO_LOAD_MUXED_ACCOUNT_FROM_ADDRESS = "TRN_MTBA_002",
  FAILED_TO_RETRIEVE_THE_BASE_ACCOUNT_ID = "TRN_MTBA_003",
}

export type MetaData = {
  muxedAddress: MuxedAddress;
};

export abstract class MuxedAddressToBaseAccountError extends TransformerError<
  Code,
  MetaData
> {
  override readonly source =
    "@colibri/core/transformers/address/muxed-to-base-account";
}

export class INVALID_MUXED_ADDRESS extends MuxedAddressToBaseAccountError {
  constructor(muxedAddress: MuxedAddress) {
    super({
      code: Code.INVALID_MUXED_ADDRESS,
      message: "Invalid muxed address!",
      data: {
        muxedAddress,
      },
      details: `The address provided does not match the expected format for Muxed Addresses. This is verified against the regex ${regex.muxedAddress} `,
      cause: undefined,
    });
  }
}

export class FAILED_TO_LOAD_MUXED_ACCOUNT_FROM_ADDRESS extends MuxedAddressToBaseAccountError {
  constructor(muxedAddress: MuxedAddress, cause?: Error) {
    super({
      code: Code.FAILED_TO_LOAD_MUXED_ACCOUNT_FROM_ADDRESS,
      message: "Failed to load muxed account from address!",
      data: {
        muxedAddress,
      },
      details: `The muxed account could not be loaded from the address provided. See the cause for more details.`,
      cause,
    });
  }
}

export class FAILED_TO_RETRIEVE_THE_BASE_ACCOUNT_ID extends MuxedAddressToBaseAccountError {
  constructor(muxedAddress: MuxedAddress, cause?: Error) {
    super({
      code: Code.FAILED_TO_RETRIEVE_THE_BASE_ACCOUNT_ID,
      message: "Failed to retrieve the base account ID!",
      data: {
        muxedAddress,
      },
      details: `The base account ID could not be retrieved from the muxed account. See the cause for more details.`,
      cause,
    });
  }
}

export const ERROR_TRN_MTBA = {
  [Code.INVALID_MUXED_ADDRESS]: INVALID_MUXED_ADDRESS,
  [Code.FAILED_TO_LOAD_MUXED_ACCOUNT_FROM_ADDRESS]:
    FAILED_TO_LOAD_MUXED_ACCOUNT_FROM_ADDRESS,
  [Code.FAILED_TO_RETRIEVE_THE_BASE_ACCOUNT_ID]:
    FAILED_TO_RETRIEVE_THE_BASE_ACCOUNT_ID,
};
