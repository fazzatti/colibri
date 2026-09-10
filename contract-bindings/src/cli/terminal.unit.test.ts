import { Code } from "@/error.ts";
import { assert, assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createTerminalIO } from "@/cli/terminal.ts";
import { BindingError } from "@/error.ts";
import { validateCliValue } from "@/cli/validation.ts";
import { contractId } from "colibri-internal/tests/binding-fixtures.ts";

function terminal(chunks: (string | Error)[], tty = true) {
  const raw: boolean[] = [];
  let text = "";
  const io = createTerminalIO({
    isTerminal: () => tty,
    setRaw: (mode) => {
      raw.push(mode);
    },
    read: (buffer) => {
      const chunk = chunks.shift();
      if (chunk instanceof Error) return Promise.reject(chunk);
      if (chunk === undefined) return Promise.resolve(null);
      const bytes = new TextEncoder().encode(chunk);
      buffer.set(bytes.subarray(0, buffer.length));
      if (bytes.length > buffer.length) {
        chunks.unshift(new TextDecoder().decode(bytes.subarray(buffer.length)));
      }
      return Promise.resolve(Math.min(bytes.length, buffer.length));
    },
  }, {
    isTerminal: () => tty,
    writeSync: (data) => {
      text += new TextDecoder().decode(data);
      return data.length;
    },
  });
  return { io, raw, text: () => text };
}

describe("bindings terminal prompts", () => {
  it("preserves validation failures and avoids changing raw mode on a nonterminal", async () => {
    for (const tty of [true, false]) {
      const cause = new BindingError(
        Code.INVALID_OPTIONS,
        "Validation unavailable",
      );
      const term = terminal(["answer", "\r"], tty);
      const error = await assertRejects(
        () =>
          Promise.resolve(term.io.prompt("Input", undefined, () => {
            throw cause;
          })),
        BindingError,
      );
      assertEquals(error, cause);
      if (tty) assertEquals(term.raw.at(-1), false);
      else assertEquals(term.raw, []);
    }
  });
  it("keeps an invalid ID in the input editor until corrected or cancelled", async () => {
    const invalid = "decodeInvocationResult";
    const term = terminal([
      invalid,
      "\r",
      "\x7f".repeat(invalid.length),
      contractId,
      "\r",
    ]);
    assertEquals(
      await term.io.prompt(
        "Input the contract ID",
        undefined,
        (value) => validateCliValue("contract-id", value, {}),
      ),
      contractId,
    );
    assert(term.text().includes("Invalid contract ID"));
    assertEquals(term.raw.at(-1), false);
    const cancelled = terminal([invalid, "\r", "\x03"]);
    assertEquals(
      await cancelled.io.prompt(
        "Input the contract ID",
        undefined,
        (value) => validateCliValue("contract-id", value, {}),
      ),
      null,
    );
    assertEquals(cancelled.raw.at(-1), false);
  });

  const options = [
    { name: "Mainnet", value: "mainnet" },
    { name: "Testnet", value: "testnet" },
    { name: "Futurenet", value: "futurenet" },
  ];
  it("renders labeled choices and handles both arrow directions and Enter", async () => {
    const term = terminal(["\x1b[B", "\x1b[B", "\x1b[A", "\r"]);
    assertEquals(
      await term.io.select!("Select the network", options),
      "testnet",
    );
    for (const name of ["Mainnet", "Testnet", "Futurenet"]) {
      assert(term.text().includes(name));
    }
    assert(term.raw.includes(true));
    assertEquals(term.raw.at(-1), false);
    const defaulted = terminal(["\r"]);
    assertEquals(
      await defaulted.io.select!("Network", options, "futurenet"),
      "futurenet",
    );
  });
  it("accepts pasted paths, edits and default values", async () => {
    const term = terminal(["./a folder/token.wasmx", "\x7f", "\r", "\r"]);
    assertEquals(
      await term.io.prompt("Input the path to the WASM file"),
      "./a folder/token.wasm",
    );
    assertEquals(
      await term.io.prompt("Input the output directory", "./bindings"),
      "./bindings",
    );
    assertEquals(term.raw.at(-1), false);
    term.io.log("Generated Token");
    assert(term.text().includes("Generated Token\n"));
  });
  it("cancels on Ctrl+C, Ctrl+D and EOF and always restores the terminal", async () => {
    for (const chunks of [["\x03"], ["\x04"], []]) {
      for (const menu of [true, false]) {
        const term = terminal([...chunks]);
        assertEquals(
          await (menu
            ? term.io.select!("Network", options)
            : term.io.prompt("Input the contract ID")),
          null,
        );
        assertEquals(term.raw.at(-1), false);
        assert(term.text().includes("\x1b[?25h"));
      }
    }
    const failed = terminal([new Error("Disconnected")]);
    await assertRejects(
      () => Promise.resolve(failed.io.prompt("Input")),
      BindingError,
      "Could not read",
    );
    assertEquals(failed.raw.at(-1), false);
  });
  it("disables the wizard when either stream is not a terminal", () => {
    const term = terminal([], false);
    assertEquals(term.io.interactive, false);
    assertEquals(term.text(), "");
    assertEquals(term.raw, []);
    assertEquals(
      createTerminalIO().interactive,
      Deno.stdin.isTerminal() && Deno.stdout.isTerminal(),
    );
  });
});
