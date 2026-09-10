import { GENERATED_MARKER } from "@/generation/constants.ts";

/** @internal A deliberately small set of frequently used Core conveniences. */
const VALUES = ["ColibriError", "LocalSigner", "NetworkConfig", "SorobanType"];
const TYPES = [
  "AuthEntrySigner",
  "ContractConfig",
  "ContractConstructorArgs",
  "ContractId",
  "Ed25519PublicKey",
  "EnvelopeSigner",
  "KeypairSigner",
  "Signer",
  "TransactionConfig",
];

function exportsFrom(
  module: string,
  values: string[],
  types: string[],
): string {
  return [
    values.length
      ? `export {\n  ${values.join(",\n  ")},\n} from "${module}";`
      : "",
    types.length
      ? `export type {\n  ${types.join(",\n  ")},\n} from "${module}";`
      : "",
  ].filter(Boolean).join("\n");
}

/** @internal Re-export the original constructors/types; never wrap or duplicate Core. */
export function renderConveniences(): string {
  return `${GENERATED_MARKER}
/**
 * Colibri conveniences for configuring and using this contract client.
 * These are the original Core exports, with the same constructor identity.
 * Use LocalSigner.fromKeypair() to adapt an existing Stellar SDK Keypair.
 * @module
 */
${exportsFrom("@colibri/core", VALUES, TYPES)}
`;
}

/** @internal ABI declarations keep their names; collisions stay available in colibri.ts. */
export function renderConvenienceExports(
  declarations: ReadonlySet<string>,
): string {
  return exportsFrom(
    "./colibri.ts",
    VALUES.filter((name) => !declarations.has(name)),
    TYPES.filter((name) => !declarations.has(name)),
  );
}
