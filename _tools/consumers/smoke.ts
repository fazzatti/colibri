import {
  Account,
  Asset,
  Claimant,
  Keypair,
  Memo,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import { Server } from "stellar-sdk/rpc";
import {
  ClaimableBalancePredicates,
  Contract,
  createClassicTransactionPipeline,
  isMessageSigner,
  LocalSigner,
  NativeLiquidityPool,
  NetworkConfig,
  SDEX,
  StellarAsset,
  StellarPrice,
  StrKey,
  type TransactionConfig,
  wrapSponsorship,
  type WrapSponsorshipArgs,
} from "@colibri/core";
import { Identicon } from "@colibri/identicon";
import { createLedgerStreamer, RPCStreamer } from "@colibri/rpc-streamer";
import { WebAuthClient } from "@colibri/webauth";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";
import { createChannelAccountsPlugin } from "@colibri/plugin-channel-accounts";
import { checkMemoRequired, createSep29Plugin } from "@colibri/plugin-sep29";

// This is a consumer, not a workspace test. The same source is type-checked
// against isolated Deno modules and installed npm declarations, then executed.
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const nativeKey = Keypair.random();
const secret = nativeKey.secret();
check(
  StrKey.isValidEd25519SecretSeed(secret),
  "Native key is a valid Stellar seed",
);
const signer = LocalSigner.fromSecret(secret);
const networkConfig = NetworkConfig.TestNet();
const rpc = new Server(networkConfig.rpcUrl!);
const usd = new Asset("USD", signer.publicKey());
const nativeAsset = new StellarAsset({ asset: usd, networkConfig, rpc });
check(
  nativeAsset.asset === usd,
  "Asset helper accepts the consumer's native Asset",
);
check(
  nativeAsset.toString() === `USD:${signer.publicKey()}`,
  "Canonical asset identity",
);
check(
  nativeAsset.parseAmount("1.25") === 12_500_000n,
  "Exact native asset units",
);
check(
  nativeAsset.formatAmount(12_500_000n) === "1.25",
  "Asset-scoped amount formatter",
);
check(
  nativeAsset.toContract().contractId ===
    usd.contractId(networkConfig.networkPassphrase),
  "Explicit SAC binding preserves native asset identity",
);
const pool = new NativeLiquidityPool({
  assets: [usd, Asset.native()],
  networkConfig,
  rpc,
});
const poolTrustOperation: xdr.Operation = pool.changeTrustOperation({
  source: signer.publicKey(),
});
const bounds = pool.priceBounds({
  baseAsset: Asset.native(),
  quoteAsset: usd,
  minimum: "2",
  maximum: "2",
});
check(
  bounds.minPrice.n === 1 && bounds.minPrice.d === 2,
  "Labelled pool bounds retain exact native prices",
);
check(
  poolTrustOperation.body.type === "changeTrust",
  "Pool operations remain native XDR",
);
check(
  new SDEX({ networkConfig, rpc }).ledgerEntries.rpc === rpc,
  "SDEX retains native RPC",
);
const claim = new Claimant(
  signer.publicKey(),
  ClaimableBalancePredicates.unconditional(),
);
check(
  claim.predicate.type === "claimPredicateUnconditional",
  "Predicate helper returns a native claim predicate",
);
check(
  StellarPrice.fromDecimal("1.25").n === 5,
  "Exact price helper works in the installed artifact",
);
check(
  StellarPrice.fromAmounts({ baseAmount: "3", quoteAmount: "2" }).d === 3,
  "Quantity prices retain exact repeating fractions",
);
check(
  isMessageSigner(signer),
  "Optional message-signing capability is exported",
);
check(
  nativeKey.verifyMessage("consumer", signer.signMessage("consumer")),
  "Native SDK verifies SEP-53 messages",
);
check(
  signer.verifyMessage("consumer", nativeKey.signMessage("consumer")),
  "LocalSigner verifies native SEP-53 signatures",
);
check(
  RPCStreamer.transaction({ rpc }).rpc === rpc,
  "Transaction streamer accepts consumer RPC",
);
check(
  RPCStreamer.operation({ rpc }).rpc === rpc,
  "Operation streamer accepts consumer RPC",
);
const spec = new Spec([
  xdr.ScSpecEntry.scSpecEntryFunctionV0(
    new xdr.ScSpecFunctionV0({
      doc: "",
      name: "ping",
      inputs: [],
      outputs: [],
    }),
  ),
]);
const contract = new Contract({
  networkConfig,
  rpc,
  contractConfig: { wasmHash: "01".repeat(32), spec },
});
check(contract.getSpec() === spec, "Keep the consumer's native Spec");
const unsigned = new TransactionBuilder(
  new Account(nativeKey.publicKey(), "0"),
  { fee: "100", networkPassphrase: Networks.TESTNET },
)
  .addOperation(Operation.setOptions({})).setTimeout(60).build();
const memoConfig: TransactionConfig = {
  source: signer.publicKey(),
  fee: "100",
  timeout: 60,
  signers: [signer],
  memo: Memo.id("29"),
};
const nativeMemo: Memo | undefined = memoConfig.memo;
check(
  nativeMemo?.value === "29",
  "Native SDK Memo in Colibri configuration",
);
const nativeOperation = Operation.manageData({ name: "consumer", value: "1" });
const sponsorshipInput: WrapSponsorshipArgs = {
  sponsor: signer.publicKey(),
  sponsored: LocalSigner.generateRandom().publicKey(),
  operations: Object.freeze([nativeOperation]),
};
const nativeInputs: readonly xdr.Operation[] = sponsorshipInput.operations;
const nativeOutputs: xdr.Operation[] = wrapSponsorship(sponsorshipInput);
check(
  nativeInputs[0] === nativeOperation && nativeOutputs[1] === nativeOperation,
  "Sponsorship inputs and outputs preserve native SDK operations",
);
await checkMemoRequired({ transaction: unsigned, rpc });
createClassicTransactionPipeline({ networkConfig, rpc }).use(
  createSep29Plugin(),
);
const signed = new Transaction(
  signer.signTransaction(unsigned),
  Networks.TESTNET,
);
check(
  signed.signatures.length === 1,
  "Sign a consumer-owned native transaction",
);
check(
  nativeKey.verify(signed.hash(), signed.signatures[0].signature),
  "Native SDK verifies the signature",
);
check(
  createLedgerStreamer({ rpc }).rpc === rpc,
  "Keep the consumer's native RPC client",
);
check(
  typeof createClassicTransactionPipeline({ networkConfig, rpc }) ===
    "function",
  "Pipeline remains callable",
);
check(
  new Identicon(nativeKey.publicKey()).toSvg().includes("<svg"),
  "Render SVG without a DOM",
);
check(
  new Identicon(nativeKey.publicKey()).toPng().length > 8,
  "Render PNG without a DOM",
);
check(typeof WebAuthClient === "function", "WebAuth import");
check(typeof createFeeBumpPlugin === "function", "Fee-bump plugin import");
check(
  typeof createChannelAccountsPlugin === "function",
  "Channel-account plugin import",
);
console.log(
  "Consumer checks passed: native SDK objects, signing, callable pipelines, streamer, WebAuth, plugins, SVG and PNG.",
);
