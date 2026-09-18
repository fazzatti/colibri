// Shared DOM harness; no implementation coverage is claimed for this fixture.
// @deno-types="npm:@types/react@19.3.0"
import { act, type ReactNode } from "npm:react@19.3.0";
// @deno-types="npm:@types/react-dom@19.2.3/client"
import { createRoot } from "npm:react-dom@19.3.0/client";
// @deno-types="npm:@types/jsdom@21.1.7"
import { JSDOM } from "npm:jsdom@26.1.0";
import { assert } from "@std/assert";
export async function mountReact(node: ReactNode) {
  const [major, minor] = Deno.version.deno.split(".").map(Number);
  assert(
    major > 2 || (major === 2 && minor >= 7),
    "React tests require Deno 2.7 or newer (CI uses 2.7.11). Deno 2.6 has incompatible CommonJS globals/timers; update your local runtime before running these tests.",
  );
  const dom = new JSDOM("<!doctype html><div id='root'></div>", {
    url: "http://localhost/",
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (
    const [key, value] of Object.entries({
      window: dom.window,
      document: dom.window.document,
      navigator: dom.window.navigator,
      IS_REACT_ACT_ENVIRONMENT: true,
    })
  ) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Reflect.deleteProperty(globalThis, key);
    // Deno 2.7's CommonJS global proxy observes assignment, not defineProperty.
    // React DOM must see the same window as the ESM test code.
    Reflect.set(globalThis, key, value);
  }
  const root = createRoot(dom.window.document.getElementById("root")!);
  await act(async () => {
    root.render(node);
  });
  return {
    root,
    document: dom.window.document,
    async close() {
      await act(async () => {
        root.unmount();
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
      dom.window.close();
      for (const [key, value] of previous) {
        Reflect.deleteProperty(globalThis, key);
        if (value) Object.defineProperty(globalThis, key, value);
      }
    },
  };
}
export async function until(
  predicate: () => boolean,
  timeout = 10000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!predicate() && Date.now() < deadline) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  assert(predicate(), "React state did not reach the expected result");
}
// @deno-types="npm:@types/react-dom@19.2.3/server"
export { renderToString } from "npm:react-dom@19.3.0/server";
export { act };
