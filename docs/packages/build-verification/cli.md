# Command-line verification

[Contract Build Verification overview](../build-verification.md)

## Evidence, logs, and CLI

`writeVerificationEvidence(...)` writes stable completed evidence or a
structured failure report. `writeVerificationLogs(...)` writes bounded JSONL or
text logs. Structured evidence omits raw source/Wasm bytes and sensitive
retrieval credentials. Build stdout/stderr can still contain anything printed by
the build itself; review [reporting boundaries](reporting.md) before sharing.

Run the package directly from JSR:

```bash
deno run -A jsr:@colibri/build-verification@0.4.2/cli \
  --contract-id C... \
  --network mainnet \
  --evidence verification.json \
  --logs verification.jsonl
```

The CLI prints one concise summary by default and sends an animated stage status
only to interactive standard error, for example:

```text
VERIFIED ba789fe6627de52ebfbd5353f5eb6b7efef23d7e8633ab59051c1a22b2f00a88
```

Use `--json` to print the complete result or typed error instead, and `--quiet`
to suppress the interactive spinner. The animation is also disabled when
standard error is not a terminal. An empty invocation, `-h`, or `--help` prints
the full command reference. `--github-token-env` reads a token from the selected
environment variable without exposing it in process arguments.

The `--evidence` and `--logs` files retain partial diagnostics when verification
fails. Exit code `0` means `verified`, `1` means verification or reporting did
not complete, `2` means `mismatch`, and `3` means `notApplicable`. This prevents
a contract without strict SEP-58 metadata from silently passing a CI gate.

## Flag reference

Flags use separate values (`--wasm file.wasm`), not `--wasm=file.wasm`. Repeated
flags, unknown flags, and positional arguments are rejected.

| Selection                            | Flags                                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| One target                           | `--contract-id ID`, `--wasm-hash HEX`, or `--wasm PATH`                                                           |
| External-reference target            | `--external-ref-owner ID` and exactly one of `--external-ref-tag TEXT` / `--external-ref-tag-base64 BASE64`       |
| Preset network                       | `--network mainnet`, `testnet`, or `futurenet`                                                                    |
| Explicit network instead of a preset | `--rpc-url URL --network-passphrase TEXT`, optional `--allow-http`                                                |
| Local source                         | `--source PATH`                                                                                                   |
| URL source                           | `--source-url URL`                                                                                                |
| GitHub archive                       | `--github-owner OWNER --github-repository REPO --github-revision REF`, optional `--github-format tar.gz` or `zip` |
| GitHub release asset                 | Owner/repository plus `--github-release-tag TAG --github-release-asset NAME`                                      |
| GitHub credentials                   | `--github-token-env VARIABLE_NAME`                                                                                |
| Out-of-band recipe                   | `--recipe PATH` (JSON file)                                                                                       |
| Build network                        | `--allow-build-network`                                                                                           |
| Container name prefix                | `--container-name-prefix PREFIX`                                                                                  |
| Complete stdout result               | `--json`                                                                                                          |
| File reports                         | `--evidence PATH`, `--logs PATH`, optional `--log-format jsonl` or `text`                                         |
| Progress                             | `--quiet` disables the interactive stderr spinner, not the result                                                 |
| Help                                 | No arguments, `-h`, or `--help`; do not combine help with execution flags                                         |

Choose at most one source form. Strict mode can discover the source from target
metadata. A recipe selects out-of-band mode and needs a source. Local Wasm needs
no RPC network selection. `--allow-http` concerns the RPC endpoint; it is not
permission to bypass source-retrieval policy.

## Machine-readable use

Use `--json` for stdout consumed by another program. `--evidence` and `--logs`
remain independent file outputs; no flag makes `mismatch` or `notApplicable`
exit successfully. Inspect the exit code even if the command printed output.

`deno run -A` grants broad host permissions to this local tool. Use it only in
an environment where those permissions and Docker access are appropriate.
Container networking is still off by default. A custom runner is an API
extension, not a CLI flag. See [policies](policies.md) and
[API reporting](reporting.md).
