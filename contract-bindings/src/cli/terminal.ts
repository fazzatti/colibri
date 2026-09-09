import { Input } from "@cliffy/prompt/input";
import { Select } from "@cliffy/prompt/select";
import type { CliIO } from "@/cli/options.ts";
import { BindingError, Code } from "@/error.ts";

/** @internal Terminal adapter; prompt dependencies stay behind the Deno CLI entrypoint. */
export function createTerminalIO(
  input: Pick<typeof Deno.stdin, "read" | "setRaw" | "isTerminal"> = Deno.stdin,
  output: Pick<typeof Deno.stdout, "writeSync" | "isTerminal"> = Deno.stdout,
): CliIO {
  const reader = {
    isTerminal: () => input.isTerminal(),
    setRaw: (mode: boolean, options?: Deno.SetRawOptions) =>
      input.setRaw(mode, options),
    async read(buffer: Uint8Array): Promise<number> {
      const count = await input.read(buffer);
      // Handle cancellation here so the prompt library never exits an embedding process.
      if (
        count === null ||
        buffer.subarray(0, count).some((byte) => byte === 3 || byte === 4)
      ) {
        throw new BindingError(Code.CANCELLED, "Generation cancelled");
      }
      return count;
    },
  };
  const writer = { writeSync: (data: Uint8Array) => output.writeSync(data) };
  async function ask(action: () => Promise<string>): Promise<string | null> {
    try {
      return await action();
    } catch (cause) {
      if (cause instanceof BindingError && cause.code === Code.CANCELLED) {
        return null;
      }
      if (cause instanceof BindingError) throw cause;
      throw new BindingError(
        Code.INVALID_OPTIONS,
        "Could not read the terminal input",
        cause,
      );
    } finally {
      // Restore cooked mode even if reading throws or the input stream closes.
      if (input.isTerminal()) input.setRaw(false);
    }
  }
  return {
    interactive: input.isTerminal() && output.isTerminal(),
    prompt: (message, defaultValue, validate) =>
      ask(() =>
        Input.prompt({
          message,
          default: defaultValue,
          minLength: 1,
          validate,
          reader,
          writer,
        })
      ),
    select: (message, options, defaultValue) =>
      ask(() =>
        Select.prompt({
          message,
          options: [...options],
          default: defaultValue,
          hideDefault: true,
          hint: "↑ / ↓ to move · Enter to select · Ctrl+C to cancel",
          reader,
          writer,
        })
      ),
    log: (message) => {
      writer.writeSync(new TextEncoder().encode(message + "\n"));
    },
  };
}
