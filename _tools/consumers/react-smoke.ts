/// <reference lib="dom" />
/** Public React consumer: SSR, hydration, shared cache and connection updates. */
// @deno-types="npm:@types/react@^19.1.13"
import { createElement, useEffect } from "npm:react@^19.1.1";
// @deno-types="npm:@types/react-dom@^19.1.9/server"
import { renderToString } from "npm:react-dom@^19.1.1/server";
// @deno-types="npm:@types/react-dom@^19.1.9/client"
import { hydrateRoot } from "npm:react-dom@^19.1.1/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "npm:@tanstack/react-query@^5.87.4";
import { NetworkConfig } from "@colibri/core/network";
import {
  ColibriProvider,
  createColibriConfig,
  useConnection,
  useNetwork,
} from "@colibri/react";
import { colibriQueryKey, colibriQueryOptions } from "@colibri/react/query";
import { AccountIdenticon } from "@colibri/react/identicon";

const address = "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO";
const network = NetworkConfig.TestNet();
const config = createColibriConfig({
  network,
  connectors: [{
    id: "test-wallet",
    connect: () =>
      Promise.resolve({
        address,
        networkPassphrase: network.networkPassphrase,
        signers: [],
      }),
  }],
});
const client = new QueryClient({
  defaultOptions: { queries: { gcTime: Infinity, retry: false } },
});
client.setQueryData(
  colibriQueryKey(config, "consumer", { amount: 123n }),
  123n,
);
await config.connect("test-wallet");
let mounted: () => void = () => {};
function Consumer() {
  const connection = useConnection();
  const selected = useNetwork();
  const query = useQuery(
    colibriQueryOptions(
      config,
      "consumer",
      { amount: 123n },
      () => Promise.resolve(123n),
    ),
  );
  useEffect(() => {
    if (connection.status === "connected" && query.data === 123n) mounted();
  }, [connection.status, query.data]);
  if (selected.networkPassphrase !== network.networkPassphrase) {
    throw new Error("React network changed");
  }
  return createElement(
    "div",
    null,
    createElement("output", null, `${connection.status}:${query.data}`),
    createElement(AccountIdenticon, { address, alt: "Account", size: 28 }),
  );
}
const tree = createElement(
  QueryClientProvider,
  { client },
  createElement(ColibriProvider, { config }, createElement(Consumer)),
);
const html = renderToString(tree);
if (!html.includes("disconnected:123")) {
  throw new Error("React SSR snapshot leaked wallet state or lost bigint data");
}
if (typeof document !== "undefined") {
  const element = document.createElement("section");
  element.innerHTML = html;
  document.body.append(element);
  const errors: unknown[] = [];
  const ready = new Promise<void>((resolve) => {
    mounted = resolve;
  });
  const root = hydrateRoot(element, tree, {
    onRecoverableError: (error) => errors.push(error),
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ready,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("React hydration timed out")),
          10000,
        );
      }),
    ]);
    if (
      errors.length ||
      element.querySelector("output")?.textContent !== "connected:123"
    ) throw new Error("React hydration or cache sharing failed");
    if (!element.querySelector("img")?.src.startsWith("data:image/svg+xml")) {
      throw new Error("React identicon failed");
    }
  } finally {
    clearTimeout(timeout);
    root.unmount();
    element.remove();
  }
}
await config.disconnect();
client.clear();
config.destroy();
console.log(
  "React SSR/cache consumer passed; hydration also executed when a DOM was available.",
);
