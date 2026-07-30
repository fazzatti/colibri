/**
 * @module @colibri/plugin-fee-bump
 *
 * Fee-bump plugin for Colibri transaction pipelines.
 */

export {
  createFeeBumpPlugin,
  FEE_BUMP_PLUGIN_ID,
  FEE_BUMP_PLUGIN_TARGET,
} from "@/index.ts";
export type {
  FeeBumpEnvelopeSigner,
  FeeBumpPluginArgs,
  FeeBumpPluginConfig,
  FeeBumpPluginNetworkConfig,
  FeeBumpPluginSigner,
  FeeBumpPluginSignerIdentity,
  FeeBumpPreAuthorizedTransactionSigner,
  FeeBumpSignableTransaction,
} from "@/types.ts";
export type {
  ContractId,
  Ed25519PublicKey,
  PreAuthTx,
  Sha256Hash,
  SignedPayload,
  SignerKey,
} from "@colibri/core";
export { Code, ERROR_PLG_FBP } from "@/error.ts";
