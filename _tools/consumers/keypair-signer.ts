/** Explicit Keypair adaptation through existing public signer and step contracts. */
import {
  Account,
  Address,
  authorizeEntry,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import {
  ColibriError,
  LocalSigner,
  LocalSignerErrors,
  steps,
  type TransactionConfig,
} from "@colibri/core";

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const native = Keypair.random();
const adapter = LocalSigner.fromKeypair(native, true);
const local = LocalSigner.generateRandom();
const config: TransactionConfig = {
  source: adapter.publicKey(),
  fee: "100",
  timeout: 0,
  signers: [adapter, local],
  extraSigners: [local.signerKey()],
};
const transaction = new TransactionBuilder(new Account(config.source, "1"), {
  fee: "100",
  networkPassphrase: Networks.TESTNET,
}).addOperation(Operation.setOptions({})).setTimeout(0)
  .setExtraSigners(config.extraSigners!).build();
const signed = await steps.createSignEnvelopeStep()({
  transaction,
  signers: config.signers,
  signatureRequirements: [{
    address: config.source as `G${string}`,
    thresholdLevel: 1,
  }],
});
check(signed.signatures.length === 2, "Mixed signer count");
check(
  native.verify(signed.hash(), signed.signatures[0].signature.toBytes()),
  "Native envelope signature",
);
check(
  local.verifySignature(
    signed.hash(),
    signed.signatures[1].signature.toBytes(),
  ),
  "Colibri envelope signature",
);

const auth = new xdr.SorobanAuthorizationEntry({
  credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
    new xdr.SorobanAddressCredentials({
      address: new Address(config.source).toScAddress(),
      nonce: xdr.Int64(7),
      signatureExpirationLedger: 0,
      signature: xdr.ScVal.scvVec([]),
    }),
  ),
  rootInvocation: new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction
      .sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: Address.contract(new Uint8Array(32)).toScAddress(),
          functionName: "noop",
          args: [],
        }),
      ),
    subInvocations: [],
  }),
});
const [signedAuth] = await steps.createSignAuthEntriesStep()({
  auth: [auth],
  signers: config.signers,
  networkPassphrase: Networks.TESTNET,
  rpc: new Server("https://example.invalid"),
  validity: { validUntilLedgerSeq: 123 },
});
const expectedAuth = await authorizeEntry(auth, native, 123, Networks.TESTNET);
check(
  signedAuth.toXdr("base64") === expectedAuth.toXdr("base64"),
  "Native auth encoding and signature",
);
check(
  config.signers[0] === adapter && config.signers[1] === local,
  "Caller signer identity",
);

let rejected = false;
try {
  LocalSigner.fromKeypair(Keypair.fromPublicKey(native.publicKey()));
} catch (error) {
  check(error instanceof ColibriError, "Core error identity");
  check(
    error instanceof LocalSignerErrors.KEYPAIR_CANNOT_SIGN,
    "Signer input error identity",
  );
  check(error.code === "SIG_LOC_007", "Public-only keypair error");
  rejected = true;
}
check(rejected, "Public-only keypair rejected");
adapter.destroy();
const bytes = new TextEncoder().encode("caller ownership");
check(
  native.verify(bytes, native.sign(bytes)),
  "Caller keypair remains usable after disposal",
);
function typeChecks() {
  // @ts-expect-error TransactionConfig continues to accept Colibri signers only.
  const raw: TransactionConfig["signers"] = [native];
  void raw;
}
void typeChecks;
console.log(
  "Keypair factory consumer passed: mixed envelope signatures, Soroban auth, borrowed identity and structured errors.",
);
