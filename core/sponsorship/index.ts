import { Operation } from "stellar-sdk";
import type { xdr } from "stellar-sdk";
import { StrKey } from "@/strkeys/index.ts";
import type { WrapSponsorshipArgs } from "@/sponsorship/types.ts";
import * as E from "@/sponsorship/error.ts";

/**
 * Wraps native Stellar operations in a reserve-sponsorship block (CAP-33).
 *
 * The begin operation uses `sponsor`; the end operation uses `sponsored`.
 * Inner operations are not cloned, reordered, or assigned a source. An omitted
 * source still means the transaction source, not automatically `sponsored`.
 * Both accounts must authorize the transaction through the normal signer list.
 *
 * This is composition, not a reserve or transaction-validity check. The network
 * enforces balances, legal sponsorship relationships, and the 100-operation
 * limit (including these two added operations). Fees are not sponsored here;
 * use a fee-bump transaction for a separate fee payer. Existing sponsorship
 * revocation and transfer remain explicit native operations.
 *
 * @returns A new array of native XDR operations, accepted by the Stellar SDK
 * and Colibri's classic transaction pipeline.
 * @throws {E.INVALID_SPONSOR} If the sponsor is not a valid G or M address.
 * @throws {E.INVALID_SPONSORED_ACCOUNT} If the sponsored ID is not a valid G address.
 */
export const wrapSponsorship = (
  { sponsor, sponsored, operations }: WrapSponsorshipArgs,
): xdr.Operation[] => {
  if (
    !StrKey.isValidEd25519PublicKey(sponsor) &&
    !StrKey.isValidMuxedAddress(sponsor)
  ) {
    throw new E.INVALID_SPONSOR(sponsor);
  }
  if (!StrKey.isValidEd25519PublicKey(sponsored)) {
    throw new E.INVALID_SPONSORED_ACCOUNT(sponsored);
  }

  return [
    Operation.beginSponsoringFutureReserves({
      source: sponsor,
      sponsoredId: sponsored,
    }),
    ...operations,
    Operation.endSponsoringFutureReserves({ source: sponsored }),
  ];
};

export type { WrapSponsorshipArgs } from "@/sponsorship/types.ts";
/** Typed failures emitted while composing a sponsorship block. */
export const SponsorshipErrors: typeof E = E;
