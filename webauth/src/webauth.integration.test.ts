import { Buffer } from "buffer";
import { assert, assertEquals, assertExists, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import {
  Contract,
  initializeWithFriendbot,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  type TransactionConfig,
} from "@colibri/core";
import { StellarTestLedger } from "../../test-tooling/mod.ts";
import { Keypair, rpc, type xdr } from "stellar-sdk";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
import {
  createTestPasskeyCredential,
  setPasskeyAssertion,
  type TestPasskeyAssertion,
  type TestPasskeyCredential,
} from "colibri-internal/tests/helpers/sep45/passkey.ts";
import { SIGNATURELESS_ACCOUNT_SPEC } from "colibri-internal/tests/specs/signatureless-account.ts";
import {
  startTestClientDomainServer,
  startTestWebAuthServer,
  type TestWebAuthServer,
} from "colibri-internal/tests/helpers/webauth/server.ts";
import { PASSKEY_ACCOUNT_SPEC } from "colibri-internal/tests/specs/passkey-account.ts";
import { WEB_AUTH_SPEC } from "colibri-internal/tests/specs/web-auth.ts";
import {
  ContractAuth,
  type ContractAuthContext,
  type ContractAuthHandler,
  Sep45Code,
  Sep45Error,
  WebAuthClient,
  WebAuthCode,
  WebAuthError,
} from "@/index.ts";

type AssertionMutation =
  | "challenge"
  | "flags"
  | "origin"
  | "rp-id"
  | "signature";

function mutateAssertion(
  assertion: TestPasskeyAssertion,
  mutation: AssertionMutation,
): TestPasskeyAssertion {
  const changed = {
    authenticatorData: assertion.authenticatorData.slice(),
    clientDataJSON: assertion.clientDataJSON.slice(),
    signature: assertion.signature.slice(),
  };

  if (mutation === "rp-id") {
    changed.authenticatorData[0] ^= 0xff;
  } else if (mutation === "flags") {
    changed.authenticatorData[32] &= ~0x04;
  } else if (mutation === "signature") {
    changed.signature[0] ^= 0xff;
  } else {
    const clientData = JSON.parse(
      new TextDecoder().decode(changed.clientDataJSON),
    );
    if (mutation === "origin") {
      clientData.origin = "https://wrong.test";
    } else {
      clientData.challenge = `${clientData.challenge}changed`;
    }
    changed.clientDataJSON = new TextEncoder().encode(
      JSON.stringify(clientData),
    );
  }

  return changed;
}

function mutatingHandler(
  credential: TestPasskeyCredential,
  mutation: AssertionMutation,
): ContractAuthHandler {
  return async (
    entry: xdr.SorobanAuthorizationEntry,
    context: ContractAuthContext,
  ) => {
    const assertion = await credential.createAssertion(entry, context);
    return setPasskeyAssertion(
      entry,
      mutateAssertion(assertion, mutation),
    );
  };
}

describe(
  "WebAuth Quickstart lifecycle",
  disableSanitizeConfig,
  () => {
    const ledger = new StellarTestLedger({
      containerName: "colibri-webauth-integration",
      containerImageVersion: "nightly-next",
      logLevel: "silent",
    });
    const admin = NativeAccount.fromMasterSigner(
      LocalSigner.generateRandom(),
    );
    const serverSigner = Keypair.random();
    const clientDomainSigner = Keypair.random();

    let network: ReturnType<typeof NetworkConfig.CustomNet>;
    let rpcServer: rpc.Server;
    let credential: TestPasskeyCredential;
    let contractAccount: string;
    let signaturelessAccount: string;
    let webAuthServer: TestWebAuthServer;
    let clientDomainServer: ReturnType<typeof startTestClientDomainServer>;
    let client: WebAuthClient;

    beforeAll(async () => {
      await ledger.start();
      const details = await ledger.getNetworkDetails();
      network = NetworkConfig.CustomNet(details);
      rpcServer = new rpc.Server(details.rpcUrl, { allowHttp: true });

      await initializeWithFriendbot(
        details.friendbotUrl,
        admin.address(),
        {
          rpcUrl: details.rpcUrl,
          allowHttp: true,
        },
      );
      for (
        const account of [
          serverSigner.publicKey(),
          clientDomainSigner.publicKey(),
        ]
      ) {
        await initializeWithFriendbot(
          details.friendbotUrl,
          account as `G${string}`,
          {
            rpcUrl: details.rpcUrl,
            allowHttp: true,
          },
        );
      }
      const transactionConfig: TransactionConfig = {
        fee: "10000000",
        timeout: 30,
        source: admin.address(),
        signers: [admin.signer()],
      };

      const webAuthContract = new Contract({
        networkConfig: network,
        contractConfig: {
          wasm: await loadWasmFile(
            "./_internal/tests/compiled-contracts/web_auth_contract.wasm",
          ),
          spec: WEB_AUTH_SPEC,
        },
      });
      await webAuthContract.uploadWasm(transactionConfig);
      await webAuthContract.deploy({ config: transactionConfig });

      credential = await createTestPasskeyCredential();
      const passkeyContract = new Contract({
        networkConfig: network,
        contractConfig: {
          wasm: await loadWasmFile(
            "./_internal/tests/compiled-contracts/passkey_account_contract.wasm",
          ),
          spec: PASSKEY_ACCOUNT_SPEC,
        },
      });
      await passkeyContract.uploadWasm(transactionConfig);
      await passkeyContract.deploy({
        config: transactionConfig,
        constructorArgs: {
          public_key: Buffer.from(credential.publicKey),
        },
      });
      contractAccount = passkeyContract.getContractId();
      assertEquals(
        Array.from(
          await passkeyContract.read({
            method: "public_key",
          }) as Uint8Array,
        ),
        Array.from(credential.publicKey),
      );

      const signaturelessContract = new Contract({
        networkConfig: network,
        contractConfig: {
          wasm: await loadWasmFile(
            "./_internal/tests/compiled-contracts/signatureless_account_contract.wasm",
          ),
          spec: SIGNATURELESS_ACCOUNT_SPEC,
        },
      });
      await signaturelessContract.uploadWasm(transactionConfig);
      await signaturelessContract.deploy({ config: transactionConfig });
      signaturelessAccount = signaturelessContract.getContractId();

      clientDomainServer = startTestClientDomainServer(
        clientDomainSigner.publicKey(),
      );
      webAuthServer = startTestWebAuthServer({
        networkPassphrase: details.networkPassphrase,
        rpc: rpcServer,
        webAuthContractId: webAuthContract.getContractId(),
        server: serverSigner,
        clientDomain: {
          domain: clientDomainServer.domain,
          account: clientDomainSigner.publicKey(),
        },
      });
      client = await WebAuthClient.fromDomain(webAuthServer.homeDomain, {
        network,
        allowHttp: true,
      });
    });

    afterAll(async () => {
      await webAuthServer?.close();
      await clientDomainServer?.close();
      await ledger.stop();
      await ledger.destroy();
    });

    it("discovers both protocols and routes G and C accounts without fallback", async () => {
      assertEquals(client.supports("sep10"), true);
      assertEquals(client.supports("sep45"), true);

      const classicAccount = Keypair.random();
      const sep10Token = await client.authenticate({
        account: classicAccount.publicKey(),
        signer: classicAccount,
      });
      assertEquals(sep10Token.protocol, "sep10");
      assertEquals(sep10Token.account, classicAccount.publicKey());

      const sep45Token = await client.authenticate({
        account: contractAccount,
        authorize: credential.authorize,
      });
      assertEquals(sep45Token.protocol, "sep45");
      assertEquals(sep45Token.account, contractAccount);
    });

    it("supports each explicit immutable challenge lifecycle", async () => {
      const classicAccount = Keypair.random();
      const sep10Challenge = await client.sep10.getChallenge({
        account: classicAccount.publicKey(),
      });
      const sep10Signed = await client.sep10.signChallenge(
        sep10Challenge,
        classicAccount,
      );
      const sep10Token = await client.sep10.submitChallenge(sep10Signed);
      assertEquals(sep10Token.protocol, "sep10");

      const sep45Challenge = await client.sep45.getChallenge({
        account: contractAccount,
      });
      const sep45Authorized = await client.sep45.authorizeChallenge(
        sep45Challenge,
        credential.authorize,
      );
      assert(
        sep45Authorized.validUntilLedgerSeq >
          sep45Challenge.verified.serverExpirationLedger - 30,
      );
      const sep45Prepared = await client.sep45.prepareChallenge(
        sep45Authorized,
      );
      assertExists(sep45Prepared.simulation.transactionXdr);
      const sep45Token = await client.sep45.submitChallenge(sep45Prepared);
      assertEquals(sep45Token.protocol, "sep45");
    });

    it("authenticates a deployed account with signatureless authorization", async () => {
      const token = await client.sep45.authenticate({
        account: signaturelessAccount,
        authorize: ContractAuth.none(),
      });

      assertEquals(token.protocol, "sep45");
      assertEquals(token.account, signaturelessAccount);
    });

    it("discovers and signs accepted client-domain entries for both protocols", async () => {
      const classicAccount = Keypair.random();
      const sep10Token = await client.sep10.authenticate({
        account: classicAccount.publicKey(),
        signer: classicAccount,
        clientDomain: clientDomainServer.domain,
        clientDomainSigner,
      });
      assertEquals(
        sep10Token.claims.client_domain,
        clientDomainServer.domain,
      );

      const sep45Token = await client.sep45.authenticate({
        account: contractAccount,
        authorize: credential.authorize,
        clientDomain: clientDomainServer.domain,
        clientDomainSigner,
      });
      assertEquals(
        sep45Token.claims.client_domain,
        clientDomainServer.domain,
      );
    });

    it("submits both protocols as form data when configured", async () => {
      const formClient = await WebAuthClient.fromDomain(
        webAuthServer.homeDomain,
        {
          network,
          allowHttp: true,
          submissionFormat: "form",
        },
      );
      const classicAccount = Keypair.random();
      assertEquals(
        (
          await formClient.sep10.authenticate({
            account: classicAccount.publicKey(),
            signer: classicAccount,
          })
        ).protocol,
        "sep10",
      );
      assertEquals(
        (
          await formClient.sep45.authenticate({
            account: contractAccount,
            authorize: credential.authorize,
          })
        ).protocol,
        "sep45",
      );
    });

    it("enforces single-use challenges for sequential and concurrent replay", async () => {
      const challenge = await client.sep45.getChallenge({
        account: contractAccount,
      });
      const authorized = await client.sep45.authorizeChallenge(
        challenge,
        credential.authorize,
      );
      const prepared = await client.sep45.prepareChallenge(authorized);
      await client.sep45.submitChallenge(prepared);
      const replay = await assertRejects(
        () => client.sep45.submitChallenge(prepared),
        WebAuthError,
      );
      assertEquals(replay.code, WebAuthCode.TRANSPORT);
      assertEquals(replay.meta?.data?.status, 409);

      const concurrentChallenge = await client.sep45.getChallenge({
        account: contractAccount,
      });
      const concurrentPrepared = await client.sep45.prepareChallenge(
        await client.sep45.authorizeChallenge(
          concurrentChallenge,
          credential.authorize,
        ),
      );
      const results = await Promise.allSettled([
        client.sep45.submitChallenge(concurrentPrepared),
        client.sep45.submitChallenge(concurrentPrepared),
      ]);
      assertEquals(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assertEquals(
        results.filter((result) => result.status === "rejected").length,
        1,
      );
    });

    it("rejects expired client authorization before simulation", async () => {
      const challenge = await client.sep45.getChallenge({
        account: contractAccount,
      });
      const authorized = await client.sep45.authorizeChallenge(
        challenge,
        credential.authorize,
        { authorizationValidityLedgers: 1 },
      );
      const deadline = Date.now() + 20_000;
      while (
        (await rpcServer.getLatestLedger()).sequence <
          authorized.validUntilLedgerSeq &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert(
        (await rpcServer.getLatestLedger()).sequence >=
          authorized.validUntilLedgerSeq,
      );
      const error = await assertRejects(
        () => client.sep45.prepareChallenge(authorized),
        Sep45Error,
      );
      assertEquals(error.code, Sep45Code.AUTHORIZATION_EXPIRED);
    });

    for (
      const mutation of [
        "challenge",
        "flags",
        "origin",
        "rp-id",
        "signature",
      ] as const
    ) {
      it(`rejects a mutated passkey ${mutation} during enforcing simulation`, async () => {
        const challenge = await client.sep45.getChallenge({
          account: contractAccount,
        });
        const authorized = await client.sep45.authorizeChallenge(
          challenge,
          mutatingHandler(credential, mutation),
        );
        const error = await assertRejects(
          () => client.sep45.prepareChallenge(authorized),
          Sep45Error,
        );
        assertEquals(error.code, Sep45Code.SIMULATION_FAILED);
      });
    }
  },
);
