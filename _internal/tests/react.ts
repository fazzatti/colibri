// Shared DOM harness; no implementation coverage is claimed for this fixture.
// @deno-types="npm:@types/react@19.3.0"
import { act, type ReactNode } from "npm:react@19.3.0";
// @deno-types="npm:@types/react-dom@19.2.3/client"
import { createRoot } from "npm:react-dom@19.3.0/client";
// @deno-types="npm:@types/jsdom@21.1.7"
import { JSDOM } from "npm:jsdom@26.1.0";
import { assert } from "@std/assert";
export async function mountReact(node: ReactNode) {
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
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
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
        if (value) Object.defineProperty(globalThis, key, value);
        else Reflect.deleteProperty(globalThis, key);
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
