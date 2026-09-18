import { assertEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { createElement, useEffect } from "react";
import { mountReact } from "colibri-internal/tests/react.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("React DOM harness", () => {
  it("mounts through CommonJS React DOM and restores globals between views", async () => {
    const keys = [
      "window",
      "document",
      "navigator",
      "IS_REACT_ACT_ENVIRONMENT",
    ];
    const original = keys.map((key) =>
      Object.getOwnPropertyDescriptor(globalThis, key)
    );
    let effects = 0;
    function View() {
      useEffect(() => {
        effects++;
        return () => {
          effects--;
        };
      }, []);
      return createElement("output", null, "mounted");
    }
    for (let index = 0; index < 2; index++) {
      const view = await mountReact(createElement(View));
      try {
        assertEquals(
          view.document.querySelector("output")?.textContent,
          "mounted",
        );
        assertEquals(effects, 1);
      } finally {
        await view.close();
      }
      assertEquals(effects, 0);
      assertEquals(
        keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key)),
        original,
      );
    }
  });
});
