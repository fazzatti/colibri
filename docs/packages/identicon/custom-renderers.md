# Custom renderers

Use the generator directly when you want to draw the cells with your own
rendering library. It runs locally and needs no network or ledger setup.

<!-- deno-check -->

```ts
import { generateIdenticon } from "@colibri/identicon";

const { matrix, color, hue } = generateIdenticon(
  "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO",
);
```

`matrix[row][column]` is a boolean; `true` means a filled foreground cell.
`color` holds integer `r`, `g`, and `b` channels. `hue` is between 0 and 1. The
result is deeply frozen. The class also exposes readonly `matrix` and `color`
getters.

The result and class retain their existing `publicKey` property for API
compatibility. It returns the supplied G-address or C-address; the name does not
mean that a contract ID is an Ed25519 public key.

[Package overview](../identicon.md)
