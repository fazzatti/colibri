import { TransactionBuilder, xdr } from "stellar-sdk";
import * as ERROR from "@/ledger-parser/error.ts";

/** Match by native network-bound hashes, retaining execution-result order. @internal */
export function matchTransactionEnvelopes(
  results: xdr.TransactionResultMeta[],
  envelopes: xdr.TransactionEnvelope[],
  passphrase: string,
): xdr.TransactionEnvelope[] {
  const byHash = new Map<string, xdr.TransactionEnvelope>();
  for (const envelope of envelopes) {
    let hash: string;
    try {
      hash = xdr.encodeBytes(
        TransactionBuilder.fromXdr(envelope.toXdr("base64"), passphrase).hash(),
        "hex",
      );
    } catch (cause) {
      throw new ERROR.ENVELOPE_HASH_FAILED(cause as Error);
    }
    if (byHash.has(hash)) throw new ERROR.DUPLICATE_ENVELOPE_HASH(hash);
    byHash.set(hash, envelope);
  }
  const matched = results.map((result) => {
    const hash = result.result.transactionHash.toXdr("hex");
    const envelope = byHash.get(hash);
    if (!envelope) throw new ERROR.RESULT_ENVELOPE_NOT_FOUND(hash);
    byHash.delete(hash);
    return envelope;
  });
  if (byHash.size) {
    throw new ERROR.UNMATCHED_TRANSACTION_ENVELOPES([...byHash.keys()]);
  }
  return matched;
}
