import type {
  Ed25519PublicKey,
  MuxedAddress,
  ContractId,
} from "@/strkeys/types.ts";

export type AnyAddress = Ed25519PublicKey | MuxedAddress | ContractId;
