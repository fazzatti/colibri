import { ColibriError } from "@/error/index.ts";

/** Stable SDEX operation-construction errors; pipeline errors retain their own codes. */
export enum Code {
  CREATE_SELL_FAILED = "SDEX_001",
  UPDATE_SELL_FAILED = "SDEX_002",
  CREATE_BUY_FAILED = "SDEX_003",
  UPDATE_BUY_FAILED = "SDEX_004",
  CREATE_PASSIVE_FAILED = "SDEX_005",
  OFFER_NOT_FOUND = "SDEX_006",
  INVALID_UPDATE_SELL_ID = "SDEX_007",
  INVALID_UPDATE_BUY_ID = "SDEX_008",
  UNSAFE_OFFER_ID = "SDEX_009",
  READ_OFFER_FAILED = "SDEX_010",
}

/** Shared diagnostic shape for SDEX's distinct failures. */
class SDEXError<C extends Code> extends ColibriError<C> {
  constructor(code: C, message: string, cause?: unknown) {
    super({
      domain: "core",
      source: "@colibri/core/markets/sdex",
      code,
      message,
      meta: { cause },
    });
  }
}

/** Native SDK rejected creation of a sell operation. */
export class CREATE_SELL_FAILED extends SDEXError<Code.CREATE_SELL_FAILED> {
  /** Retains the native SDK validation cause. */
  constructor(cause: unknown) {
    super(
      Code.CREATE_SELL_FAILED,
      "Could not construct the sell offer.",
      cause,
    );
  }
}
/** Native SDK rejected an update to a sell operation. */
export class UPDATE_SELL_FAILED extends SDEXError<Code.UPDATE_SELL_FAILED> {
  /** Retains the native SDK validation cause. */
  constructor(cause: unknown) {
    super(
      Code.UPDATE_SELL_FAILED,
      "Could not construct the sell-offer update.",
      cause,
    );
  }
}
/** Native SDK rejected creation of a buy operation. */
export class CREATE_BUY_FAILED extends SDEXError<Code.CREATE_BUY_FAILED> {
  /** Retains the native SDK validation cause. */
  constructor(cause: unknown) {
    super(Code.CREATE_BUY_FAILED, "Could not construct the buy offer.", cause);
  }
}
/** Native SDK rejected an update to a buy operation. */
export class UPDATE_BUY_FAILED extends SDEXError<Code.UPDATE_BUY_FAILED> {
  /** Retains the native SDK validation cause. */
  constructor(cause: unknown) {
    super(
      Code.UPDATE_BUY_FAILED,
      "Could not construct the buy-offer update.",
      cause,
    );
  }
}
/** Native SDK rejected creation of a passive operation. */
export class CREATE_PASSIVE_FAILED
  extends SDEXError<Code.CREATE_PASSIVE_FAILED> {
  /** Retains the native SDK validation cause. */
  constructor(cause: unknown) {
    super(
      Code.CREATE_PASSIVE_FAILED,
      "Could not construct the passive sell offer.",
      cause,
    );
  }
}
/** A known-offer cancellation found no live offer at the requested key. */
export class OFFER_NOT_FOUND extends SDEXError<Code.OFFER_NOT_FOUND> {
  /** Records the offer identity. */
  constructor(seller: string, offerId: string) {
    super(
      Code.OFFER_NOT_FOUND,
      `No offer ${offerId} exists for seller ${seller}.`,
    );
  }
}
/** The sell-update method requires an existing positive int64 offer ID. */
export class INVALID_UPDATE_SELL_ID
  extends SDEXError<Code.INVALID_UPDATE_SELL_ID> {
  /** Explains that creation and updates are explicit separate methods. */
  constructor() {
    super(
      Code.INVALID_UPDATE_SELL_ID,
      "Sell-offer update requires a positive int64 offer ID.",
    );
  }
}
/** The buy-update method requires an existing positive int64 offer ID. */
export class INVALID_UPDATE_BUY_ID
  extends SDEXError<Code.INVALID_UPDATE_BUY_ID> {
  /** Explains that creation and updates are explicit separate methods. */
  constructor() {
    super(
      Code.INVALID_UPDATE_BUY_ID,
      "Buy-offer update requires a positive int64 offer ID.",
    );
  }
}

/** A numeric offer ID is not a safe integer and may already have lost precision. */
export class UNSAFE_OFFER_ID extends SDEXError<Code.UNSAFE_OFFER_ID> {
  /** Rejects number inputs whose integer identity cannot be trusted. */
  constructor(offerId: number) {
    super(
      Code.UNSAFE_OFFER_ID,
      `Offer ID ${offerId} must be a safe integer number; use a string or bigint for large IDs.`,
    );
  }
}

/** Native transport failed while querying a known offer. */
export class READ_OFFER_FAILED extends SDEXError<Code.READ_OFFER_FAILED> {
  /** Retains the original transport cause. */
  constructor(cause: unknown) {
    super(Code.READ_OFFER_FAILED, "Could not read the Stellar offer.", cause);
  }
}

/** SDEX errors indexed by stable code. */
export const ERROR_SDEX = {
  ["SDEX_001" as Code.CREATE_SELL_FAILED]: CREATE_SELL_FAILED,
  ["SDEX_002" as Code.UPDATE_SELL_FAILED]: UPDATE_SELL_FAILED,
  ["SDEX_003" as Code.CREATE_BUY_FAILED]: CREATE_BUY_FAILED,
  ["SDEX_004" as Code.UPDATE_BUY_FAILED]: UPDATE_BUY_FAILED,
  ["SDEX_005" as Code.CREATE_PASSIVE_FAILED]: CREATE_PASSIVE_FAILED,
  ["SDEX_006" as Code.OFFER_NOT_FOUND]: OFFER_NOT_FOUND,
  ["SDEX_007" as Code.INVALID_UPDATE_SELL_ID]: INVALID_UPDATE_SELL_ID,
  ["SDEX_008" as Code.INVALID_UPDATE_BUY_ID]: INVALID_UPDATE_BUY_ID,
  ["SDEX_009" as Code.UNSAFE_OFFER_ID]: UNSAFE_OFFER_ID,
  ["SDEX_010" as Code.READ_OFFER_FAILED]: READ_OFFER_FAILED,
};
