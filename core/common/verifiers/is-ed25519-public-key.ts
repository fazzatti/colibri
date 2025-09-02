import { regex } from "../../mod.ts";

export const isEd25519PublicKey = (value: string): boolean => {
  return typeof value === "string" && regex.ed25519PublicKey.test(value);
};
