import { assert, assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Contract,
  Event,
  initializeWithFriendbot,
  KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
  LocalSigner,
  NetworkConfig,
  type TransactionConfig,
} from "@colibri/core";
import { StellarTestLedger } from "@colibri/test-tooling";
import { runCli } from "@/cli/run.ts";
import { loadBindingSource } from "@/source/load.ts";
import { generateBindings } from "@/generation/generate.ts";
import { writeBindings } from "@/output/write.ts";
import { pathToFileURL } from "node:url";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";

describe(
  "[Quickstart] generated clients and network sources",
  disableSanitizeConfig,
  () => {
    it("loads the same deployed ABI by ID/hash, invokes native types and installs customized errors once", async () => {
      const ledger = new StellarTestLedger({
        containerName: "colibri-contract-bindings",
        containerImageVersion: "testing",
        logLevel: "silent",
      });
      const directory = await Deno.makeTempDir();
      try {
        await ledger.start();
        const details = await ledger.getNetworkDetails();
        const networkConfig = NetworkConfig.CustomNet({
          ...details,
          allowHttp: true,
        });
        const signer = LocalSigner.generateRandom();
        await initializeWithFriendbot(
          details.friendbotUrl,
          signer.publicKey(),
          { rpcUrl: details.rpcUrl, allowHttp: true },
        );
        const config: TransactionConfig = {
          source: signer.publicKey(),
          fee: "100000000",
          timeout: 60,
          signers: [signer],
        };
        for (
          const [fixture, name] of [["types_harness", "Harness"], [
            "errors_contract",
            "Errors",
          ], ["bindings_demo_contract", "Demo"]]
        ) {
          const loaded = await loadBindingSource({
            kind: "wasm",
            wasm: await Deno.readFile(
              `_internal/tests/compiled-contracts/${fixture}.wasm`,
            ),
          });
          await writeBindings(
            generateBindings(loaded.spec, { className: name }),
            { directory: `${directory}/${name}` },
          );
          const exports = await import(
            pathToFileURL(`${directory}/${name}/index.ts`).href
          );
          const upload = new Contract({
            networkConfig,
            contractConfig: {
              wasm: await Deno.readFile(
                `_internal/tests/compiled-contracts/${fixture}.wasm`,
              ),
            },
          });
          await upload.uploadWasm(config);
          await upload.deploy({ config });
          const contractId = upload.getContractId();
          const byId = await loadBindingSource({
            kind: "contract",
            contractId,
            networkConfig,
          });
          const byHash = await loadBindingSource({
            kind: "hash",
            wasmHash: upload.getWasmHash(),
            networkConfig,
          });
          assertEquals(byId.provenance.wasmHash, byHash.provenance.wasmHash);
          assertEquals(byHash.provenance.wasmHash, loaded.provenance.wasmHash);
          assert(byId.provenance.snapshot?.observedAtLedger);
          const client = new exports[name]({
            networkConfig,
            contractConfig: { contractId },
            ...(name === "Errors"
              ? {
                errors: {
                  ...exports.ErrorsErrors,
                  265: {
                    ...exports.ErrorsErrors[265],
                    message: "Prepared custom message",
                  },
                },
              }
              : {}),
          });
          if (name === "Harness") {
            assertEquals(
              await client.read({ method: "i128", methodArgs: { v: 42n } }),
              42n,
            );
            const output = await client.invoke({
              method: "i128",
              methodArgs: { v: 42n },
              config,
            });
            assertEquals(output.value, 42n);
            assert(output.returnValue);
            assert(output.hash);
            for (
              const sourceArgs of [["--contract-id", contractId], [
                "--wasm-hash",
                upload.getWasmHash(),
              ]]
            ) {
              const written = await runCli([
                ...sourceArgs,
                "--network",
                "custom",
                "--rpc-url",
                details.rpcUrl,
                "--network-passphrase",
                details.networkPassphrase,
                "--allow-http",
                "--non-interactive",
                "--out",
                `${directory}/cli-${sourceArgs[0]}`,
              ], { interactive: false, prompt: () => null, log: () => {} });
              assert(written?.written.includes("index.ts"));
            }
            assertEquals(await client.read({ method: "void" }), null);
            assertEquals(client.events.list().length, 0);
          } else if (name === "Demo") {
            assertEquals(await client.read({ method: "get_count" }), 0);
            const output = await client.invoke({
              method: exports.ContractMethods.Increment,
              methodArgs: { by: 3 },
              config,
            });
            assertEquals(output.value.unwrap(), 3);
            assertEquals(await client.read({ method: "summary" }), {
              count: 3,
              status: 1,
            });
            const filter = client.events.CountChanged.toEventFilter({
              action: "increment",
            });
            const events = await client.rpc.getEvents({
              startLedger: output.ledger,
              filters: [filter.toRawEventFilter()],
            });
            assertEquals(events.events.length, 1);
            const decoded = client.events.CountChanged.fromEvent(
              Event.fromEventResponse(events.events[0]),
            );
            assertEquals(decoded.fields, {
              action: "increment",
              old_count: 0,
              new_count: 3,
            });
            const custom = new exports.Demo({
              networkConfig,
              contractConfig: { contractId },
              errors: {
                ...exports.DemoErrors,
                1: {
                  ...exports.DemoErrors[1],
                  message: "Choose a positive increment",
                },
              },
            });
            const failure = await assertRejects(
              () => custom.read({ method: "increment", methodArgs: { by: 0 } }),
              KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
            );
            assertEquals(
              failure.message,
              "Contract error: Choose a positive increment",
            );
            assertEquals(failure.meta.data.match.name, "InvalidIncrement");
            assertEquals(failure.meta.data.match.category, "CounterError");
          } else {
            const failure = await assertRejects(() =>
              client.read({
                method: "trigger_by_code",
                methodArgs: { error_code: 265 },
              }), KNOWN_CONTRACT_ERROR_SIMULATION_FAILED);
            assertEquals(
              failure.message,
              "Contract error: Prepared custom message",
            );
            assertEquals(failure.meta.data.match.contractId, contractId);
          }
        }
      } finally {
        await ledger.destroy();
        await Deno.remove(directory, { recursive: true });
      }
    });
  },
);
