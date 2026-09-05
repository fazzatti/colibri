import { ColibriError } from "@/error/index.ts";

/** Stable errors for reserve-sponsorship composition. */
export enum Code {
  INVALID_SPONSOR = "SPNS_001",
  INVALID_SPONSORED_ACCOUNT = "SPNS_002",
}

/** The sponsor is not a valid G or M operation source. */
export class INVALID_SPONSOR extends ColibriError<Code.INVALID_SPONSOR> {
  /** Records the invalid sponsor without altering the supplied operations. */
  constructor(sponsor: string) {
    super({
      domain: "core",
      source: "@colibri/core/sponsorship",
      code: Code.INVALID_SPONSOR,
      message: "Reserve sponsor must be a valid G or M address.",
      meta: { data: { sponsor } },
    });
  }
}

/** The sponsored account is not a valid G account ID. */
export class INVALID_SPONSORED_ACCOUNT
  extends ColibriError<Code.INVALID_SPONSORED_ACCOUNT> {
  /** Records the invalid sponsored account. */
  constructor(sponsored: string) {
    super({
      domain: "core",
      source: "@colibri/core/sponsorship",
      code: Code.INVALID_SPONSORED_ACCOUNT,
      message: "The sponsored account must be a valid G address.",
      meta: { data: { sponsored } },
    });
  }
}

/** Reserve-sponsorship errors indexed by their stable codes. */
export const ERROR_SPNS = {
  [Code.INVALID_SPONSOR]: INVALID_SPONSOR,
  [Code.INVALID_SPONSORED_ACCOUNT]: INVALID_SPONSORED_ACCOUNT,
};
