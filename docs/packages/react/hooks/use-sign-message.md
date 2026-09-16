# useSignMessage

Request a SEP-53 signature from the connection’s optional message signer.

Import from `@colibri/react/signers`. Use under both `ColibriProvider` and
`QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `options?`: mutation callbacks and controls.
- Call the mutation with a string or `Uint8Array` message.

**Returns:** A mutation result containing the signature as `Uint8Array`.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useSignMessage } from "@colibri/react/signers";

export function SignMessage({ message }: { message: string }) {
  const signature = useSignMessage();
  return (
    <section>
      <button
        disabled={signature.isPending}
        onClick={() => signature.mutate(message)}
      >
        Sign message
      </button>
      {signature.isError && <p role="alert">{signature.error.message}</p>}
      {signature.isSuccess && <p>Message signed.</p>}
    </section>
  );
}
```

## Behavior

The connector must explicitly provide `messageSigner`; envelope-signing support
alone is insufficient. The current connection is checked before and after the
prompt. No automatic retry occurs. Use the signature with a matching SEP-53
verifier; message signing is separate from [WebAuth](use-web-auth.md).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/signers/~/useSignMessage)
