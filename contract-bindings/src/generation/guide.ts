import { contractEventBindings } from "@colibri/core";
import type { Spec } from "@colibri/core";
import type { xdr } from "stellar-sdk";
import type { GenerateBindingsOptions } from "@/types.ts";
import { property, quote, typeName } from "@/generation/type-map.ts";
import { methodBindings } from "@/generation/method-clients.ts";

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
function sampleArguments(method: ReturnType<Spec["funcs"]>[number]): string {
  return method.inputs.length
    ? `{ ${
      method.inputs.map((field) =>
        `${property(field.name.toString())}: ${sample(field.type)}`
      ).join(", ")
    } }`
    : "";
}
function clientAccess(member: string): string {
  // Generation validates method identifiers before rendering this guide.
  return `client.${member}`;
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
| [colibri.ts](${prefix}colibri.ts) | Core configuration helpers and signer/transaction types. |
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
  const bindings = methodBindings(spec);
  const member = (name: string) =>
    clientAccess(bindings.find((binding) => binding.name === name)!.property);
  const methods = spec.funcs().filter((method) =>
    !method.name.toString().startsWith("__")
  );
  const example = methods.find((method) => method.inputs.length === 0) ??
    methods.find((method) =>
      method.inputs.every((field) => sample(field.type) !== undefined)
    );
  const method = example?.name.toString();
  const setup = setupInstructions(packaged, npm);
  const call = method && example
    ? fence(
      "ts",
      `const value = await ${member(method)}.read(${
        sampleArguments(example)
      });\nconsole.log(value);`,
    )
    : "Consult the function table for callable methods and their typed arguments.";
  const invoke = methods.find((method) =>
    method.inputs.length &&
    method.inputs.every((field) => sample(field.type) !== undefined)
  ) ?? example;
  const invokeExample = invoke
    ? fence(
      "ts",
      `const result = await ${member(invoke.name.toString())}.invoke({${
        invoke.inputs.length
          ? `\n  methodArgs: ${sampleArguments(invoke)},`
          : ""
      }
  config: transactionConfig,
});

console.log(result.hash);
console.log(result.value);`,
    )
    : "For callable functions, pass the method, its arguments, and transaction configuration to `client.invoke()`.";
  const error = spec.entries.find((entry) =>
    entry.type === "scSpecEntryUdtErrorEnumV0"
  );
  const errorCode = error?.type === "scSpecEntryUdtErrorEnumV0"
    ? error.value.cases[0]?.value
    : undefined;
  const eventSection = eventGuide(spec);
  return `# ${name} contract client

Typed [Colibri](https://jsr.io/@colibri/core) bindings generated from this
contract's specification. The client extends \`Contract\` and gives each callable
function a property with typed \`.read()\` and \`.invoke()\` calls.

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
      `import { ${name} } from ${quote(entry)};
import { NetworkConfig } from ${
        quote(packaged ? "./generated/colibri.ts" : "./colibri.ts")
      };

const client = new ${name}({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: { contractId: "C..." },
});`,
    )
  }

## Colibri conveniences

The generated \`colibri.ts\` module re-exports \`NetworkConfig\`, \`LocalSigner\`,
\`SorobanType\`, \`ColibriError\`, and common signer, contract and transaction types.
The client entrypoint also re-exports them unless an ABI declaration has the
same name. In that case, import the convenience directly from \`colibri.ts\`
(or the published package's \`/colibri\` entrypoint). ABI names take precedence.
These are the original Core exports, so constructor identity is preserved.
Core remains a runtime dependency. Existing package manifests are preserved
on regeneration; add the \`/colibri\` export manually when upgrading an older scaffold.

Use \`LocalSigner.fromKeypair(keypair)\` to adapt an existing native Stellar SDK
signing keypair, then pass that signer in \`config.signers\`. It targets only its
own G-address by default; other accounts or custom contract authorization need
explicit targets and the appropriate authority/encoding. Public-only keypairs
are rejected. The factory borrows the keypair without extracting its secret;
destroying the adapter leaves the original keypair unchanged. Transaction
configuration and signing pipelines continue to accept Colibri signers.

## Read a result

\`read()\` simulates the selected function and returns its decoded value.
It does not submit a transaction. Adjust the sample arguments for your deployment.

${call}

## Submit a transaction

Provide your application's \`TransactionConfig\`, including the source account,
fee, timeout, and signers. The example below assumes that configuration is
available as \`transactionConfig\`.

${invokeExample}

The spec does not classify functions as reads or writes. Every callable function
is available through both calls; choose simulation or submission deliberately.
\`invoke()\` preserves Colibri's transaction metadata and raw \`returnValue\`, and
adds the decoded \`value\`. That value is \`undefined\` if no return value is present.

Pass the function's argument object directly to \`.read(args)\`. Invocations take
one object: \`.invoke({ methodArgs, config, auth })\`, matching the generic call
with only \`method\` supplied by the helper. Argument-free functions use \`.read()\`
and can omit \`methodArgs\` from \`.invoke({ config, auth })\`.
The helpers remain bound to this client
when destructured. Existing generic \`client.read({ method, methodArgs })\`
and \`client.invoke({ method, methodArgs, config, auth })\` calls remain available.

## Soroban types and validated inputs

Generated declarations use \`SorobanType.U32\`, \`SorobanType.Symbol\`, and other
Soroban names. Method inputs use \`SorobanType.Input\` and accept ordinary values
or validated wrappers; decoded outputs remain ordinary JavaScript values.

Import \`SorobanType\` from the generated \`colibri.ts\` module. For example,
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

Each custom declaration has a \`NameArgs\` alias for the raw or validated values
accepted by its factory. Method arguments keep \`MethodInput\` names and reuse
these aliases for custom fields. If \`NameArgs\` collides with a contract type,
the factory alias uses \`NameValueArgs\`; the contract type keeps its spec name.

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

| ABI method | Client property | Input type | Output type |
| --- | --- | --- | --- |
${
    bindings.map((binding) =>
      `| \`${binding.name}\` | \`${clientAccess(binding.property)}\` | \`${
        typeName(binding.name)
      }Input\` | \`${typeName(binding.name)}Output\` |`
    ).join("\n")
  }

Use \`ContractMethods\` for PascalCase method constants and \`${name}MethodMap\` for correlated
inputs and outputs. ABI type names use PascalCase. Field names and union tags
retain their on-chain spelling so they remain compatible with the SDK codec.

Client properties use camelCase: \`grant_role\` becomes \`client.grantRole\`.
Names that collide after casing or with existing client members or JavaScript
hooks receive a \`Method\` suffix, repeated if necessary to avoid another name.
The table shows the exact
property. Normalized collisions are resolved in spec order. The ABI name passed
to Colibri, generic method keys, argument fields and union tags never change.
${
    spec.funcs().some((method) => method.name.toString() === "__constructor")
      ? "\nSoroban calls `__constructor` during deployment. It is excluded from client\nproperties, `ContractMethods`, and the callable method maps. The full embedded\nspec and `ConstructorInput` deployment arguments are retained. This input type\nis separate from the client class configuration type.\n"
      : ""
  }

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
