import { contractEventBindings } from "@colibri/core";
import type { Spec } from "@colibri/core";
import type { xdr } from "stellar-sdk";
import type { GenerateBindingsOptions } from "@/types.ts";
import { property, quote, typeName } from "@/generation/type-map.ts";

const fence = (language: string, source: string): string =>
  `\`\`\`${language}\n${source}\n\`\`\``;
const SAMPLES: Readonly<Record<string, string>> = {
  scSpecTypeBool: "true",
  scSpecTypeU32: "1",
  scSpecTypeI32: "1",
  scSpecTypeU64: "1n",
  scSpecTypeI64: "1n",
  scSpecTypeU128: "1n",
  scSpecTypeI128: "1n",
  scSpecTypeString: '"example"',
  scSpecTypeSymbol: '"example"',
  scSpecTypeOption: "null",
  scSpecTypeVec: "[]",
  scSpecTypeMap: "[]",
};
function sample(type: xdr.ScSpecTypeDef): string | undefined {
  return SAMPLES[type.type];
}
function setupInstructions(packaged: boolean, npm: boolean): string {
  if (npm) {
    return packaged ? fence("sh", "npm install\nnpm run build") : fence(
      "sh",
      "npm config set @jsr:registry https://npm.jsr.io --location project\nnpm install '@colibri/core@npm:@jsr/colibri__core@^1.1.0'",
    );
  }
  return packaged ? fence("sh", "deno task check") : fence(
    "sh",
    "deno add jsr:@colibri/core@^1.1.0",
  );
}
function eventGuide(spec: Spec): string {
  const event = spec.events()[0];
  const binding = contractEventBindings(spec)[0];
  const access = binding
    ? `client.events[${quote(binding.key)}]`
    : "client.events";
  return event
    ? `The contract declares ${spec.events().length} ${
      spec.events().length === 1 ? "event" : "events"
    }. Each definition supports typed
decoding and filters for its indexed fields.

${
      fence(
        "ts",
        `const definition = ${access};
const filter = definition.toEventFilter();

// Decode an Event returned by Colibri's event APIs.
const decoded = definition.fromEvent(event);
console.log(decoded.fields);`,
      )
    }

${
      spec.events().map((event) =>
        `- **${event.name}**: ${
          event.doc.toString().trim() || "Contract event."
        }`
      ).join("\n")
    }

Use the named property on \`client.events\` for field-specific autocomplete.
For example, \`${access}\` exposes the event's
payload and indexed topic types from \`types.ts\`.
`
    : "This spec contains no event declarations. The contract may still emit events,\nbut this client cannot infer their field types.\n";
}
function fileGuide(options: GenerateBindingsOptions): string {
  const packaged = options.output === "package";
  const prefix = packaged ? "generated/" : "";
  return `## Files

| File | Contents |
| --- | --- |
| [constants.ts](${prefix}constants.ts) | Method names, embedded spec, and error messages${
    options.provenance ? "; also source identity" : ""
  }. |
| [types.ts](${prefix}types.ts) | Sections for methods and their inputs/outputs/maps, contract types, events, and client configuration. |
| [index.ts](${prefix}index.ts) | Client class and exports for the generated API. |
${
    packaged
      ? "\n`mod.ts` is the package entrypoint. Keep application setup and custom exports\nthere or in separate files; regeneration preserves the scaffold.\n"
      : ""
  }
`;
}
/** @internal A contract-specific guide with setup, concrete calls and readable reference tables. */
export function renderGuide(
  options: GenerateBindingsOptions,
  name: string,
  spec: Spec,
): string {
  const packaged = options.output === "package";
  const npm = options.target === "npm";
  const entry = packaged ? "./mod.ts" : "./index.ts";
  const methods = spec.funcs().filter((method) =>
    !method.name.toString().startsWith("__")
  );
  const example = methods.find((method) => method.inputs.length === 0) ??
    methods.find((method) =>
      method.inputs.every((field) => sample(field.type) !== undefined)
    );
  const method = example?.name.toString();
  const args = example?.inputs.length
    ? `\n  methodArgs: { ${
      example.inputs.map((field) =>
        `${property(field.name.toString())}: ${sample(field.type)}`
      ).join(", ")
    } },`
    : "";
  const setup = setupInstructions(packaged, npm);
  const call = method
    ? fence(
      "ts",
      `const value = await client.read({\n  method: ContractMethods.${
        typeName(method)
      },${args}\n});\nconsole.log(value);`,
    )
    : "Select a method from the function table and provide its typed arguments.";
  const invoke = methods.find((method) =>
    method.inputs.length &&
    method.inputs.every((field) => sample(field.type) !== undefined)
  ) ?? example;
  const invokeExample = invoke
    ? fence(
      "ts",
      `const result = await client.invoke({
  method: ContractMethods.${typeName(invoke.name.toString())},${
        invoke.inputs.length
          ? `\n  methodArgs: { ${
            invoke.inputs.map((field) =>
              `${property(field.name.toString())}: ${sample(field.type)}`
            ).join(", ")
          } },`
          : ""
      }
  config: transactionConfig,
});

console.log(result.hash);
console.log(result.value);`,
    )
    : "Pass a method, its arguments, and your transaction configuration to `client.invoke()`.";
  const error = spec.entries.find((entry) =>
    entry.type === "scSpecEntryUdtErrorEnumV0"
  );
  const errorCode = error?.type === "scSpecEntryUdtErrorEnumV0"
    ? error.value.cases[0]?.value
    : undefined;
  const eventSection = eventGuide(spec);
  return `# ${name} contract client

Typed [Colibri](https://jsr.io/@colibri/core) bindings generated from this
contract's specification. The client extends \`Contract\` and provides typed
\`read()\` and \`invoke()\` calls for the functions listed below.

${fileGuide(options)}## Setup

${setup}

${
    npm
      ? "The npm preset uses Colibri through JSR's npm registry.\nKeep the project `.npmrc` when installing dependencies in CI. Node 22.12 or\nnewer is required. Package builds emit JavaScript and declarations into `dist/`."
      : "The JSR preset uses Colibri Core 1.1; Core supplies the Stellar SDK dependency. The generated source\nimports only `@colibri/core` from your Deno import map."
  }

## Create a client

Replace the deployment ID with your contract's address, and select its network.
For npm builds, import the generated client from your package's built entrypoint.

${
    fence(
      "ts",
      `import { NetworkConfig } from "@colibri/core";
import { ${name}, ContractMethods } from ${quote(entry)};

const client = new ${name}({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: { contractId: "C..." },
});`,
    )
  }

## Read a result

\`read()\` simulates the selected function and returns its decoded value.
It does not submit a transaction. Adjust the sample arguments for your deployment.

${call}

## Submit a transaction

Provide your application's \`TransactionConfig\`, including the source account,
fee, timeout, and signers. The example below assumes that configuration is
available as \`transactionConfig\`.

${invokeExample}

The spec does not classify functions as reads or writes. Every function is
available through both calls; choose simulation or submission deliberately.
\`invoke()\` preserves Colibri's transaction metadata and raw \`returnValue\`, and
adds the decoded \`value\`. That value is \`undefined\` if no return value is present.

## Soroban types and validated inputs

Generated declarations use \`SorobanType.U32\`, \`SorobanType.Symbol\`, and other
Soroban names. Method inputs use \`SorobanType.Input\` and accept ordinary values
or validated wrappers; decoded outputs remain ordinary JavaScript values.

Import \`SorobanType\` from \`@colibri/core\`. For example,
\`SorobanType.U32.from(7)\` checks the integer range and
\`SorobanType.Symbol.from("ADMIN")\` checks the symbol alphabet and length.
Wrappers expose \`.value\`, \`.toScVal()\` and \`.toXdr("base64")\`.

Custom declarations use \`SorobanType.Custom\` schemas: named struct fields,
positional tuple fields, or enum variants with tagged or u32 encoding. Colibri
derives their accepted inputs without repeating the fields or tag/value objects.
The runtime factories reuse this contract's embedded spec.

Use \`SomeStruct.from(fields)\` or \`SomeEnum.Variant(...values)\`, substituting
names from \`types.ts\`. Numeric enums expose their exact codes on the same
factory, such as \`Status.Active\`, and validate with \`Status.from(code)\`.
Factories also provide \`.fromScVal()\`, \`.fromXdr()\` and a reusable \`.type\`
codec. Numeric codes are never renumbered; map keys are ordered according to
Soroban's comparison rules. Referenced error codes reuse the existing error map.

If a custom input name collides with a method input, it uses \`NameValueInput\`;
its spec-derived output name stays unchanged.

## Read contract data

The inherited \`getLedgerEntry()\` uses this client's contract ID and RPC. Given
an \`encodedKey\` ScVal or generated custom value in your contract's storage-key encoding:

${
    fence(
      "ts",
      `const entry = await client.getLedgerEntry({
  key: encodedKey,
  durability: "persistent",
});
console.log(entry.value, entry.liveUntilLedgerSeq);`,
    )
  }

Durability defaults to \`"persistent"\`; \`"temporary"\` is also supported.
This reads ledger data directly, without simulation or signing. It returns the
existing Colibri contract-data entry, including parsed values, raw XDR and ledger
metadata. Missing entries raise the existing ledger not-found error. No storage
schema is inferred.

## Functions

| Method | Input type | Output type |
| --- | --- | --- |
${
    methods.map((method) =>
      `| \`${method.name}\` | \`${
        typeName(method.name.toString())
      }Input\` | \`${typeName(method.name.toString())}Output\` |`
    ).join("\n")
  }

Use \`ContractMethods\` for PascalCase method constants and \`${name}MethodMap\` for correlated
inputs and outputs. ABI type names use PascalCase. Field names and union tags
retain their on-chain spelling so they remain compatible with the SDK codec.

## Contract errors

\`${name}Errors\` satisfies Colibri's \`ContractErrorMap\` type. The client installs
it once during construction. Each entry retains the spec case name as \`name\`
and its declaring error enum as \`category\`, alongside \`message\` and optional
\`details\`. Error-only enums are not duplicated in \`types.ts\`. Customize messages
before creating a client, preserving the original metadata:

${
    fence(
      "ts",
      `import { ${name}Errors } from ${quote(entry)};

const errors = {
  ...${name}Errors,${
        errorCode !== undefined
          ? `\n  ${errorCode}: {
    ...${name}Errors[${errorCode}],
    message: "A message tailored to your application.",
  },`
          : "\n  // Add application-specific error descriptions here."
      }
};

const customized = new ${name}({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: { contractId: "C..." },
  errors,
});`,
    )
  }

Automatic matching uses the configured contract ID. Without an ID, it matches
errors from the root invocation. Pass \`errors: false\` if you provide your own
matcher through \`contractConfig.plugins\`; other configured plugins are preserved.
Matched errors expose \`name\` and \`category\` in \`error.meta.data.match\`.

If decoding fails after a transaction succeeds, Core error \`CONTR_021\` retains the successful
transaction in \`error.meta.data.result\`. Inspect it before retrying; do not
resubmit the transaction automatically.

## Events

${eventSection}
## Native values

| Contract value | JavaScript representation |
| --- | --- |
| 32-bit integers | \`number\` |
| Integers of 64 bits and above | \`bigint\` |
| Bytes | \`Uint8Array\` |
| Option | Value or \`null\`; inputs also accept \`undefined\`. |
| Map | Array of \`[key, value]\` pairs; inputs also accept \`Map\`. |
| Void return | \`null\` |
| Top-level Result | Stellar SDK \`Result\` wrapper. |

A contract type has an additional \`Input\` variant only when its accepted input
shape differs from its decoded output. Fixed byte lengths and integer ranges
are validated by the SDK codec.

## Regeneration

Run the generator again with the same source and output directory. Add
\`--force\` to replace generated \`constants.ts\`, \`types.ts\`, and \`index.ts\`.
Existing README, package configuration, and handwritten files are preserved.
To refresh this guide, remove it explicitly before regenerating.

The embedded spec is a snapshot. Regenerate after an ABI change; loading a
different spec into this typed client invalidates its type guarantees.
${
    options.provenance
      ? `\`${name}Provenance\` records the source available at generation time.\n`
      : ""
  }Generation itself never submits transactions.
`;
}
