import { ToolsError } from "../error.ts";

export enum Code {
  UNEXPECTED = "TOOL_FRDBOT_000",
  INVALID_ADDRESS = "TOOL_FRDBOT_001",
}

export type MetaData = {
  friendbotUrl: string;
};

export abstract class FriendbotError extends ToolsError<Code, MetaData> {
  override readonly source = "@colibri/core/tools/friendbot";
}

export class UNEXPECTED extends FriendbotError {
  constructor(friendbotUrl: string, cause: Error) {
    super({
      code: Code.UNEXPECTED,
      message: "An unexpected error occurred when using Friendbot!",
      data: {
        friendbotUrl,
      },
      details: "See the 'cause' for more details",
      cause,
    });
  }
}

export class INVALID_ADDRESS extends FriendbotError {
  constructor(friendbotUrl: string, address: string) {
    super({
      code: Code.INVALID_ADDRESS,
      message: "The address provided is invalid!",
      data: {
        friendbotUrl,
      },
      details: `The address provided '${address}' is not a valid Stellar address. It must ba a valid public key in the G-address format.`,
      diagnostic: {
        rootCause:
          "The address is not a valid Stellar public key. Accounts in Stellar are Ed25519 public keys represented in the G-address format according to SEP23.",
        suggestion:
          "Make sure a valid Stellar public key is provided, encoded in the correct Strkey format.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md",
        ],
      },
    });
  }
}

export const ERROR_TOOL_FRDBOT = {
  [Code.UNEXPECTED]: UNEXPECTED,
  [Code.INVALID_ADDRESS]: INVALID_ADDRESS,
};
