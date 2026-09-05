import type { Ed25519PublicKey } from "@colibri/core";
import type { Transaction } from "@/types.ts";

/** @internal One lookup per distinct non-muxed destination, in operation order. */
export const memoDestinations = (
  transaction: Transaction,
): { destination: Ed25519PublicKey; operationIndex: number }[] => {
  const destinations = new Map<Ed25519PublicKey, number>();
  for (const [operationIndex, operation] of transaction.operations.entries()) {
    switch (operation.type) {
      case "payment":
      case "pathPaymentStrictSend":
      case "pathPaymentStrictReceive":
      case "accountMerge":
        break;
      default:
        continue;
    }
    if (operation.destination.startsWith("M")) continue;
    const destination = operation.destination as Ed25519PublicKey;
    if (!destinations.has(destination)) {
      destinations.set(destination, operationIndex);
    }
  }
  return [...destinations].map(([destination, operationIndex]) => ({
    destination,
    operationIndex,
  }));
};
