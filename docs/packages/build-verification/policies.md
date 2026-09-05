# Policies and isolation

[Contract Build Verification overview](../build-verification.md)

## Security defaults

- Build-container network access is disabled unless `allowBuildNetwork: true` is
  set.
- The default image policy checks the configured official Stellar CLI registry,
  repository, and requested digest before any registry request, then requires
  the resolved single-platform manifest to have that exact digest.
- Source and image-registry retrieval policies are checked again after every
  redirect. Bearer-token endpoints are checked as separate requests, and HTTP
  connections are pinned to the approved DNS results.
- Docker execution uses a read-only root filesystem, drops capabilities, and
  applies CPU, memory, PID, time, output, archive, and artifact limits.
- Docker output is streamed and bounded before it is retained in host memory,
  and daemon log persistence is disabled for build containers.
- Disposable build containers use `colibri-build-verification-<unique-id>`
  names. Configure `docker.containerNamePrefix` in the API, or
  `--container-name-prefix` in the CLI, to replace only the prefix; Colibri
  always appends the unique suffix.
- The runner executes only. Artifact collection and selection are separate
  boundaries.
- Evidence records provenance and SBOM observations without claiming an
  unverified signature is valid.

Use disposable workers or VMs for hosted verification of untrusted source.
Container isolation alone is intended for the local developer workflow.

## Host downloads versus build network

`allowBuildNetwork` defaults to `false`. This controls the build container; the
host still needs network access to resolve remote targets, download source,
resolve image manifests, and pull the approved image. Offline builds need all
required dependencies already available in the source/image. Enabling container
networking permits dependency retrieval but also expands the code's network
access—make that an explicit decision.

The default DNS resolver accepts addresses from either IPv4 or IPv6 when the
other lookup fails or has no records. The returned addresses are still checked
by the retrieval policy before use. If no addresses are available and any lookup
rejected, it raises `SourceDnsResolutionFailedError`; the original failures are
retained in the `AggregateError` at `error.meta.cause`. Permission denials and
resolver failures must not be treated as successful empty answers.
`SourceDnsEmptyError` is reserved for both lookups succeeding without addresses.

## Resource limits

Override individual fields through `limits`; omitted values use
`DEFAULT_BUILD_VERIFICATION_LIMITS`:

| Limit                          | Default          |
| ------------------------------ | ---------------- |
| Archive / extracted bytes      | 50 MiB / 512 MiB |
| Single file / artifact bytes   | 128 MiB / 64 MiB |
| File count / path length       | 20,000 / 512     |
| Captured log bytes / events    | 1 MiB / 256      |
| Redirects / download timeout   | 5 / 30 seconds   |
| Build timeout                  | 10 minutes       |
| Container memory / CPUs / PIDs | 4 GiB / 2 / 512  |

Increasing limits can make larger projects work but increases resource exposure.
ZIP extraction checks the cumulative extracted-byte budget before decoding each
additional entry, as well as enforcing the individual-file limit. It does not
unpack the entire archive before applying the aggregate limit. Bounded logs can
be truncated; absence of a line in retained logs is not proof that the build
never emitted it.

## Custom policy decisions

`policy` accepts image, command, options, and source policies. Image policies
evaluate both the reference before registry I/O and the resolved image facts.
Every policy returns structured acceptance, checks, reasons, and warnings. Keep
trust roots explicit: an image name or a parsed provenance document alone is not
proof that a signature was verified.

`docker.containerNamePrefix` changes only the human-readable name prefix.
Colibri always appends a unique execution ID and never reuses a prior build
container. It is independent of Quickstart's reusable named-ledger lifecycle.
