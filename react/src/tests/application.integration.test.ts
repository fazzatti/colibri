import {
  Account,
  Asset,
  Memo,
  Operation,
  TransactionBuilder,
} from "stellar-sdk/base";
import { Server } from "stellar-sdk/rpc";
import { readContract } from "@colibri/core/contract-read";
import { useClassicTransaction } from "@/transactions/classic/hook.ts";
import { useSorobanTransaction } from "@/transactions/soroban/hook.ts";
import { useSimulateSorobanTransaction } from "@/transactions/simulation/hook.ts";
import {
  createContractEvents,
  useContractEvents,
} from "@/events/subscription.ts";
import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createElement } from "react";
import {
  QueryClient,
  QueryClientProvider,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { StellarTestLedger } from "@colibri/test-tooling";
import {
  Contract,
  EventFilter,
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
  type TransactionConfig,
} from "@colibri/core";
import {
  Demo,
  type GetCountOutput,
} from "colibri-internal/tests/generated-bindings/demo/index.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
import { act, mountReact, until } from "colibri-internal/tests/react.ts";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { createColibriConfig } from "@/context/config.ts";
import { ColibriProvider, useConnection } from "@/context/provider.ts";
import { useConnect, useDisconnect } from "@/context/connection.ts";
import { useContract } from "@/contracts/instance.ts";
import {
  contractReadQueryOptions,
  useContractRead,
} from "@/contracts/read/hooks.ts";
import { useContractInvoke } from "@/contracts/invoke/hooks.ts";
import { useSigners } from "@/signers/hooks.ts";
describe(
  "React application flow on local Stellar",
  disableSanitizeConfig,
  () => {
    it("connects, reads, simulates, invokes both pipeline flavors, observes events and disconnects", async () => {
      const ledger = new StellarTestLedger({
        containerName: `colibri-react-${crypto.randomUUID()}`,
        containerImageVersion: "testing",
        logLevel: "silent",
      });
      let view: Awaited<ReturnType<typeof mountReact>> | undefined;
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity },
          mutations: { gcTime: Infinity },
        },
      });
      try {
        await ledger.start();
        const details = await ledger.getNetworkDetails();
        const network = NetworkConfig.CustomNet(details);
        const signer = LocalSigner.generateRandom();
        const address = signer.publicKey();
        await initializeWithFriendbot(details.friendbotUrl, address, {
          rpcUrl: details.rpcUrl,
          allowHttp: true,
        });
        const transactionConfig: TransactionConfig = {
          source: address,
          fee: "10000000",
          timeout: 30,
          signers: [signer],
        };
        const deployed = new Contract({
          networkConfig: network,
          contractConfig: {
            wasm: await loadWasmFile(
              "./_internal/tests/compiled-contracts/bindings_demo_contract.wasm",
            ),
          },
        });
        await deployed.uploadWasm(transactionConfig);
        await deployed.deploy({ config: transactionConfig });
        const config = createColibriConfig({
          network,
          connectors: [{
            id: "local-test-wallet",
            connect: () =>
              Promise.resolve({
                address,
                networkPassphrase: network.networkPassphrase,
                signers: [signer],
              }),
          }],
        });
        const rpc = new Server(details.rpcUrl, { allowHttp: true });
        const subscription = createContractEvents(config, {
          filters: [
            new EventFilter({
              contractIds: [deployed.getContractId() as `C${string}`],
            }),
          ],
          startLedger: (await rpc.getLatestLedger()).sequence,
          streaming: { waitLedgerIntervalMs: 100, pagingIntervalMs: 50 },
        });
        let events!: ReturnType<typeof useContractEvents>;
        let classic!: ReturnType<typeof useClassicTransaction>;
        let soroban!: ReturnType<typeof useSorobanTransaction>;
        let simulate!: ReturnType<typeof useSimulateSorobanTransaction>;
        let read!: UseQueryResult<GetCountOutput, Error>;
        let invoke!: UseMutationResult<
          Awaited<ReturnType<Demo["increment"]["invoke"]>>,
          Error,
          Parameters<Demo["increment"]["invoke"]>[0]
        >;
        let current!: Demo;
        let connect!: ReturnType<typeof useConnect>;
        let disconnect!: ReturnType<typeof useDisconnect>;
        let txConfig!: TransactionConfig;
        let identity: Demo | undefined;
        const Application = () => {
          current = useContract(() =>
            new Demo({
              networkConfig: config.network,
              contractConfig: { contractId: deployed.getContractId() },
            }), [config]);
          if (identity) {
            assertEquals(current, identity);
          }
          identity = current;
          classic = useClassicTransaction();
          soroban = useSorobanTransaction();
          simulate = useSimulateSorobanTransaction();
          events = useContractEvents(subscription);
          connect = useConnect();
          disconnect = useDisconnect();
          const state = useConnection();
          const signers = useSigners();
          txConfig = { ...transactionConfig, signers: [...signers] };
          read = useContractRead({
            contract: current,
            method: "getCount",
            args: [],
          });
          invoke = useContractInvoke(current, "increment", {
            onSuccess: async () => {
              await queryClient.invalidateQueries({
                queryKey: contractReadQueryOptions(config, {
                  contract: current,
                  method: "getCount",
                  args: [],
                }).queryKey,
              });
            },
          });
          return createElement(
            "output",
            null,
            `${state.status}:${
              read.data === undefined ? "loading" : Number(read.data)
            }`,
          );
        };
        view = await mountReact(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(
              ColibriProvider,
              { config },
              createElement(Application),
            ),
          ),
        );
        await until(() => read.isSuccess);
        assertEquals(Number(read.data), 0);
        await act(async () => {
          await connect("local-test-wallet");
        });
        await until(() => config.getSnapshot().status === "connected");
        let result!: Awaited<ReturnType<Demo["increment"]["invoke"]>>;
        await act(async () => {
          result = await invoke.mutateAsync({
            methodArgs: { by: 3 },
            config: txConfig,
          });
        });
        assert(result.hash.length === 64);
        assert(result.ledger > 0);
        await until(() => Number(read.data) === 3);
        assert(view.document.body.textContent?.includes("connected:3"));
        const granular = await readContract({
          networkConfig: network,
          contractId: deployed.getContractId() as `C${string}`,
          spec: current.getSpec(),
          method: "get_count",
        });
        assertEquals(Number(granular), 3);
        const operation = Operation.invokeContractFunction({
          contract: deployed.getContractId(),
          function: "increment",
          args: current.getSpec().funcArgsToScVals("increment", { by: 2 }),
        });
        const prepared = new TransactionBuilder(new Account(address, "1"), {
          networkPassphrase: network.networkPassphrase,
          fee: "10000000",
        }).addOperation(operation).setTimeout(30).build();
        await act(async () => {
          const simulation = await simulate.mutateAsync(prepared);
          assert(simulation.result);
        });
        assertEquals(Number(await current.getCount.read()), 3);
        await act(async () => {
          const outcome = await soroban.mutateAsync({
            operations: [operation],
            config: txConfig,
          });
          assert(outcome.hash.length === 64);
        });
        assertEquals(Number(await current.getCount.read()), 5);
        await act(async () => {
          const outcome = await classic.mutateAsync({
            operations: [
              Operation.payment({
                destination: address,
                asset: Asset.native(),
                amount: "0.0000001",
              }),
            ],
            config: { ...txConfig, memo: Memo.text("react") },
          });
          assertEquals(outcome.operations[0].type, "payment");
          assert(typeof outcome.feeCharged === "bigint");
        });
        await until(() => events.events.length >= 2, 20000);
        await act(async () => {
          await disconnect();
        });
        assertEquals(config.getSnapshot().status, "disconnected");
        await view.close();
        view = undefined;
        subscription.destroy();
        config.destroy();
      } finally {
        await view?.close();
        queryClient.clear();
        await ledger.stop();
        await ledger.destroy();
      }
    });
  },
);
