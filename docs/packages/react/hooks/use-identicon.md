# useIdenticon

Generate a deterministic SVG data URL for a Stellar address locally.

Import from `@colibri/react/identicon`. Call inside a React component. This hook
does not require a Colibri or Query provider.

## Parameters and result

- `address`: a checksummed G- or C-address; `undefined` returns no image.
- `options?`: size, padding, background, saturation and brightness (`value`).

**Returns:** An SVG data URL, or `undefined` when no address is supplied.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useIdenticon } from "@colibri/react/identicon";

export function Avatar({ address }: { address?: string }) {
  const src = useIdenticon(address, { size: 40 });
  return src
    ? <img src={src} width={40} height={40} alt="Account identicon" />
    : <span>No account</span>;
}
```

## Behavior

No RPC request or PNG encoder is needed. Invalid addresses/options throw the
renderer’s validation errors. G-address rendering follows Colibri’s
[SEP-33](../../identicon.md) compatibility policy; C-address rendering is a
Colibri extension. Icons can collide and do not prove identity.
`AccountIdenticon` is the optional unstyled component alternative; see
[Identicons](../../identicon.md).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/identicon/~/useIdenticon)
