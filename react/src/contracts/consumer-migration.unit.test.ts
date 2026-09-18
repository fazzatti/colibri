import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NetworkConfig } from "@colibri/core/network";
import { NetworkConfig as PreviousNetwork } from "colibri-internal/previous-core";
import { act, mountReact, until } from "colibri-internal/tests/react.ts";
import { createColibriConfig } from "@/context/config.ts";
import { ColibriProvider } from "@/context/provider.ts";
import {
  contractReadQueryOptions,
  useContractRead,
} from "@/contracts/read/hooks.ts";
import { specFingerprint } from "@/contracts/fingerprint.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const config = createColibriConfig({ network: NetworkConfig.TestNet() });
function client() {
  let calls = 0;
  return {
    networkConfig: PreviousNetwork.TestNet(),
    getContractId: () => "C-test",
    getSpec: () => ({ entries: [{ toXdr: () => "abi" }] }),
    balance: {
      read: (address: string): Promise<bigint> => {
        calls++;
        return Promise.resolve(BigInt(address.length));
      },
    },
    calls: () => calls,
  };
}
describe("consumer compatibility and async clients", () => {
  it("accepts public clients from a preceding Core minor with exact inference", async () => {
    const contract = client();
    const options = contractReadQueryOptions(config, {
      contract,
      method: "balance",
      args: ["account"],
    });
    const cache = new QueryClient();
    try {
      const result: bigint = await cache.fetchQuery(options);
      assertEquals(result, 7n);
      contractReadQueryOptions(config, {
        contract,
        method: "balance",
        // @ts-expect-error Generated method arguments remain checked.
        args: [7],
      });
      contractReadQueryOptions(config, {
        contract,
        // @ts-expect-error Unknown helper properties remain rejected.
        method: "missing",
        args: ["ok"],
      });
    } finally {
      cache.clear();
    }
  });
  it("keeps an unresolved client idle, then shares and reuses its result", async () => {
    const contract = client();
    const cache = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    let value: typeof contract | undefined;
    let state!: ReturnType<typeof useContractRead<typeof contract, "balance">>;
    function View() {
      state = useContractRead({
        contract: value,
        method: "balance",
        args: ["abc"],
      });
      return createElement("span", null, state.data?.toString());
    }
    const tree = () =>
      createElement(
        QueryClientProvider,
        { client: cache },
        createElement(ColibriProvider, { config }, createElement(View)),
      );
    const view = await mountReact(tree());
    try {
      assertEquals(state.fetchStatus, "idle");
      assertEquals(contract.calls(), 0);
      value = contract;
      await act(() => view.root.render(tree()));
      await until(() => state.isSuccess);
      assertEquals(state.data, 3n);
      await act(() => view.root.render(tree()));
      assertEquals(contract.calls(), 1);
    } finally {
      await view.close();
      cache.clear();
    }
  });
  it("uses a bounded fingerprint while detecting in-place ABI changes", () => {
    let text = "a".repeat(50000);
    const spec = { entries: [{ toXdr: () => text }] };
    const first = specFingerprint(spec);
    assertEquals(first.length, 64);
    assertEquals(specFingerprint(spec), first);
    text = "different ABI";
    assertNotEquals(specFingerprint(spec), first);
    const key = JSON.stringify(
      contractReadQueryOptions(config, {
        contract: client(),
        method: "balance",
        args: ["abc"],
      }).queryKey,
    );
    assert(key.length < 1000);
  });
});
