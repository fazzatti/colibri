import { StrKey } from "stellar-sdk";
import { WebAuthCode, WebAuthError } from "@/error.ts";
import type { WebAuthProtocol } from "@/types.ts";

/** Selects the WebAuth protocol for a fully validated Stellar address. */
export function protocolForAccount(account: string): WebAuthProtocol {
  if (StrKey.isValidEd25519PublicKey(account)) {
    return "sep10";
  }
  if (StrKey.isValidMed25519PublicKey(account)) {
    return "sep10";
  }
  if (StrKey.isValidContract(account)) {
    return "sep45";
  }

  const prefix = account[0];
  if (prefix === "G" || prefix === "M" || prefix === "C") {
    throw new WebAuthError({
      code: WebAuthCode.INVALID_ACCOUNT,
      message: "Invalid Stellar account",
      details: "The account has an invalid length, payload, or checksum.",
      data: { prefix },
    });
  }

  throw new WebAuthError({
    code: WebAuthCode.UNSUPPORTED_ACCOUNT,
    message: "Unsupported Stellar account type",
    details: "WebAuth supports only G, M, and C addresses.",
    data: { prefix },
  });
}
