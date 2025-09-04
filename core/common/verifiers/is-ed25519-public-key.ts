import { regex } from "../../mod.ts";
import type { Ed25519PublicKey } from "../types.ts";

export const isEd25519PublicKey = (
  address: string
): address is Ed25519PublicKey => {
  return typeof address === "string" && regex.ed25519PublicKey.test(address);
};
