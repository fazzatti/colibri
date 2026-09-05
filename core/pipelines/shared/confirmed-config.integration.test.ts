import { assert, assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import {
  Account,
  Asset,
  FeeBumpTransaction,
  MuxedAccount,
  Operation,
  Transaction,
  TransactionBuilder,
} from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import {
  createClassicTransactionPipeline,
  createInvokeContractPipeline,
  initializeWithFriendbot,
  Ledger,
  LocalSigner,
  type MuxedAddress,
  NetworkConfig,
  parseEventsFromLedgerCloseMeta,
} from "@/mod.ts";
import { sendTransaction } from "@/processes/send-transaction/index.ts";
import { ERROR_STATUS } from "@/processes/send-transaction/error.ts";
import { wrapFeeBump } from "@/processes/wrap-fee-bump/index.ts";
import { getTransactionResourceFee } from "@/common/helpers/transaction-fee.ts";
import { StellarTestLedger } from "@colibri/test-tooling";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";

describe(
  "[Quickstart] confirmed transaction configuration",
  disableSanitizeConfig,
  () => {
    const ledger = new StellarTestLedger({
      containerName: "colibri-confirmed-config-regressions",
      containerImageVersion: "testing",
      logLevel: "silent",
    });
    const sourceSigner = LocalSigner.generateRandom();
    const operationSigner = LocalSigner.generateRandom();
    let networkConfig: NetworkConfig;
    let rpc: Server;
    let wasm: Uint8Array;

    beforeAll(async () => {
      await ledger.start();
      const details = await ledger.getNetworkDetails();
      networkConfig = NetworkConfig.CustomNet(details);
      rpc = new Server(details.rpcUrl, { allowHttp: true });
      wasm = await loadWasmFile(
        "_internal/tests/compiled-contracts/sep57_identity_claims_contract.wasm",
      );
      for (const signer of [sourceSigner, operationSigner]) {
        await initializeWithFriendbot(
          details.friendbotUrl,
          signer.publicKey(),
          { rpcUrl: details.rpcUrl, allowHttp: true },
        );
      }
    });
    afterAll(async () => {
      await ledger.destroy();
    });

    for (const operationSourceKind of ["none", "G"] as const) {
      it(`confirms a G Soroban source with ${operationSourceKind} operation source, exact max fee, and timeout`, async () => {
        const source = sourceSigner.publicKey();
        const operationSource = operationSourceKind === "none"
          ? undefined
          : operationSigner.publicKey();
        const execute = createInvokeContractPipeline({ networkConfig, rpc });
        const before = Math.floor(Date.now() / 1000);
        const result = await execute({
          operations: [
            Operation.uploadContractWasm({ wasm, source: operationSource }),
          ],
          config: {
            source,
            fee: { max: "100000000" },
            timeout: 60,
            signers: [sourceSigner, operationSigner],
          },
        });
        const confirmed = new Transaction(
          result.response.envelopeXdr,
          networkConfig.networkPassphrase,
        );
        assertEquals(confirmed.source, source);
        assertEquals(confirmed.operations[0].source, operationSource);
        assertEquals(confirmed.fee, "100000000");
        assert(
          getTransactionResourceFee(confirmed) + 100n <=
            BigInt(confirmed.fee),
        );
        assert(Number(confirmed.timeBounds?.maxTime) >= before + 60);
        assert(
          Number(confirmed.timeBounds?.maxTime) <=
            Math.floor(Date.now() / 1000) + 60,
        );
        assert(result.response.resultXdr.feeCharged <= 100000000n);
      });
    }

    it("preserves an explicit muxed operation source for the node to reject, rather than silently replacing it", async () => {
      const execute = createInvokeContractPipeline({ networkConfig, rpc });
      const operationSource = new MuxedAccount(
        new Account(operationSigner.publicKey(), "0"),
        "456",
      ).accountId();
      const error = await assertRejects(() =>
        execute({
          operations: [
            Operation.uploadContractWasm({ wasm, source: operationSource }),
          ],
          config: {
            source: sourceSigner.publicKey(),
            fee: "100000000",
            timeout: 60,
            signers: [sourceSigner, operationSigner],
          },
        }), ERROR_STATUS);
      assertEquals(error.meta.data.errorResult, ["txSorobanInvalid"]);
      assertEquals(
        error.meta.data.input.transaction.operations[0].source,
        operationSource,
      );
    });

    it("confirms classic exact inclusion and finite timeout with an extra signer", async () => {
      const execute = createClassicTransactionPipeline({ networkConfig, rpc });
      const before = Math.floor(Date.now() / 1000);
      const result = await execute({
        operations: [Operation.setOptions({}), Operation.setOptions({})],
        config: {
          source: new MuxedAccount(
            new Account(sourceSigner.publicKey(), "0"),
            "123",
          ).accountId() as MuxedAddress,
          fee: { inclusion: "205" },
          timeout: 60,
          signers: [sourceSigner, operationSigner],
          extraSigners: [operationSigner.signerKey()],
        },
      });
      const confirmed = new Transaction(
        result.response.envelopeXdr,
        networkConfig.networkPassphrase,
      );
      assertEquals(confirmed.fee, "205");
      assertEquals(confirmed.extraSigners?.length, 1);
      assert(Number(confirmed.timeBounds?.maxTime) >= before + 60);
      assert(result.response.resultXdr.feeCharged <= 205n);
    });

    it("confirms a two-operation inner transaction with an outer per-operation fee below the inner total", async () => {
      const passphrase = networkConfig.networkPassphrase;
      const unsigned = new TransactionBuilder(
        await rpc.getAccount(sourceSigner.publicKey()),
        { fee: "100", networkPassphrase: passphrase },
      )
        .addOperation(
          Operation.payment({
            destination: operationSigner.publicKey(),
            asset: Asset.native(),
            amount: "0.01",
          }),
        )
        .addOperation(Operation.setOptions({})).setTimeout(60).build();
      const inner = new Transaction(
        sourceSigner.signTransaction(unsigned),
        passphrase,
      );
      const outer = wrapFeeBump({
        transaction: inner,
        networkPassphrase: passphrase,
        config: {
          source: operationSigner.publicKey(),
          fee: "150",
          signers: [operationSigner],
        },
      });
      const signed = new FeeBumpTransaction(
        operationSigner.signTransaction(outer),
        passphrase,
      );
      const result = await sendTransaction({ transaction: signed, rpc });
      const confirmed = new FeeBumpTransaction(
        result.response.envelopeXdr,
        passphrase,
      );
      assertEquals(confirmed.fee, "450");
      assertEquals(confirmed.innerTransaction.fee, "200");
      assertEquals(
        result.response.resultXdr.result.type,
        "txFeeBumpInnerSuccess",
      );
      const archived = await rpc.getLedgers({
        startLedger: result.ledger,
        pagination: { limit: 1 },
      });
      const parsed = Ledger.fromEntry(archived.ledgers[0]);
      const parsedTransaction = parsed.transactions.find((transaction) =>
        transaction.hash === result.hash
      );
      assertEquals(parsedTransaction?.successful, true);
      assertEquals(parsedTransaction?.resultCode, "txFeeBumpInnerSuccess");
      const eventStatuses: boolean[] = [];
      await parseEventsFromLedgerCloseMeta(
        parsed.meta,
        (event) => {
          if (event.txHash === result.hash) {
            eventStatuses.push(
              event.inSuccessfulContractCall,
            );
          }
        },
      );
      assert(eventStatuses.length > 0);
      assert(eventStatuses.every(Boolean));
    });
  },
);
