import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals, assertExists } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { Account, Operation, TransactionBuilder, type xdr } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import { NetworkConfig } from "@/network/index.ts";
import { createClassicTransactionPipeline } from "@/pipelines/classic-transaction/index.ts";
import { sendTransaction } from "@/processes/send-transaction/index.ts";
import { signEnvelope } from "@/processes/sign-envelope/index.ts";
import { HashXSigner } from "@/signer/hash-x/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { PreAuthorizedTransactionSigner } from "@/signer/pre-authorized-transaction/index.ts";
import { Ed25519SignedPayloadSigner } from "@/signer/signed-payload/index.ts";
import { OperationThreshold } from "@/signer/types.ts";
import { StrKey } from "@/strkeys/index.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";

describe(
  "[Testnet] Classic transaction signer mechanisms",
  disableSanitizeConfig,
  () => {
    const networkConfig = NetworkConfig.TestNet();
    const rpc = new Server(networkConfig.rpcUrl, {
      allowHttp: networkConfig.allowHttp,
    });
    const pipeline = createClassicTransactionPipeline({ networkConfig, rpc });
    const hashXAccount = LocalSigner.generateRandom();
    const signedPayloadAccount = LocalSigner.generateRandom();
    const preAuthAccount = LocalSigner.generateRandom();

    beforeAll(async () => {
      for (
        const account of [
          hashXAccount,
          signedPayloadAccount,
          preAuthAccount,
        ]
      ) {
        await initializeWithFriendbot(
          networkConfig.friendbotUrl,
          account.publicKey(),
          {
            rpcUrl: networkConfig.rpcUrl,
            allowHttp: networkConfig.allowHttp,
          },
        );
      }
    });

    const configFor = (
      source: Ed25519PublicKey,
      signers: TransactionConfig["signers"],
    ): TransactionConfig => ({
      fee: "100",
      timeout: 60,
      source,
      signers,
    });

    const installAccountSigner = (
      account: LocalSigner,
      operation: xdr.Operation,
    ) =>
      pipeline.run({
        operations: [operation],
        config: configFor(account.publicKey(), [account]),
      });

    it("submits an envelope authorized only by a Hash-X preimage", async () => {
      const signer = HashXSigner.generateRandom(true);
      await installAccountSigner(
        hashXAccount,
        Operation.setOptions({
          lowThreshold: 1,
          medThreshold: 1,
          highThreshold: 1,
          signer: {
            sha256Hash: StrKey.decodeSha256Hash(signer.signerKey()),
            weight: 1,
          },
        }),
      );
      signer.addTarget(hashXAccount.publicKey());

      const result = await pipeline.run({
        operations: [
          Operation.manageData({
            name: "colibri-hash-x",
            value: crypto.randomUUID(),
          }),
        ],
        config: configFor(hashXAccount.publicKey(), [signer]),
      });

      assertExists(result.hash);
      assertEquals(signer.signsFor(hashXAccount.publicKey()), true);
    });

    it("submits an envelope authorized only by a signed payload", async () => {
      const payloadKeypair = LocalSigner.generateRandom();
      const signer = Ed25519SignedPayloadSigner.fromPayload({
        signer: payloadKeypair,
        payload: crypto.getRandomValues(new Uint8Array(32)),
      });
      await installAccountSigner(
        signedPayloadAccount,
        Operation.setOptions({
          lowThreshold: 1,
          medThreshold: 1,
          highThreshold: 1,
          signer: {
            ed25519SignedPayload: signer.signerKey(),
            weight: 1,
          },
        }),
      );
      signer.addTarget(signedPayloadAccount.publicKey());

      const result = await pipeline.run({
        operations: [
          Operation.manageData({
            name: "colibri-signed-payload",
            value: crypto.randomUUID(),
          }),
        ],
        config: configFor(signedPayloadAccount.publicKey(), [signer]),
      });

      assertExists(result.hash);
      assertEquals(signer.signsFor(signedPayloadAccount.publicKey()), true);
    });

    it("submits an exact pre-authorized transaction without a signature", async () => {
      const source = preAuthAccount.publicKey();
      const currentAccount = await rpc.getAccount(source);
      const transaction = new TransactionBuilder(
        new Account(
          source,
          (BigInt(currentAccount.sequenceNumber()) + 1n).toString(),
        ),
        {
          fee: "100",
          networkPassphrase: networkConfig.networkPassphrase,
        },
      )
        .addOperation(
          Operation.manageData({
            name: "colibri-preauth",
            value: crypto.randomUUID(),
          }),
        )
        .setTimeout(120)
        .build();
      const signer = PreAuthorizedTransactionSigner.fromTransaction(
        transaction,
      );

      await installAccountSigner(
        preAuthAccount,
        Operation.setOptions({
          lowThreshold: 1,
          medThreshold: 1,
          highThreshold: 1,
          signer: {
            preAuthTx: StrKey.decodePreAuthTx(signer.signerKey()),
            weight: 1,
          },
        }),
      );
      signer.addTarget(source);

      const authorized = await signEnvelope({
        transaction,
        signatureRequirements: [{
          address: source,
          thresholdLevel: OperationThreshold.medium,
        }],
        signers: [signer],
      });
      assertEquals(authorized.signatures.length, 0);

      const result = await sendTransaction({
        transaction: authorized,
        rpc,
      });

      assertExists(result.hash);
    });
  },
);
