# Authorization requirements

Stellar transaction-envelope authorization and Soroban authorization entries are
different layers. An envelope authorizes submitting operations with a source
account and sequence number. A Soroban entry authorizes a particular invocation
tree, address, nonce, expiration, and network.

## Let a pipeline coordinate the layers

Provide `config.source` and `config.signers` to a write pipeline. The invoke
pipeline discovers auth entries by simulation, asks matching auth-entry signers
to authorize them, assembles the transaction, determines envelope requirements,
and signs the envelope. You do not need to list the same signer twice because it
supports both capabilities.

| Requirement                  | Selection                                            | Result                                      |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| Soroban address credentials  | Auth-entry capability and `signsFor(address)`        | Complete authorized entry                   |
| Account envelope requirement | Envelope/pre-auth capability and `signsFor(account)` | Signature or exact transaction-hash check   |
| `extraSigners` precondition  | Exact `signerKey()`                                  | The specifically requested signer mechanism |

The envelope process does not implement weighted multisignature selection. More
than one distinct signer key claiming one account is ambiguous and rejected. See
[signers](signer/README.md) for the supported capabilities and mechanisms.

## Low-level requirement helpers

`auth.getRequiredOperationThresholdForClassicOperation(operation)` accepts a
decoded SDK operation and returns an address/threshold requirement, or
`undefined` when that operation has no rule in this helper. A missing explicit
source is represented as `"source-account"`; muxed sources are normalized to
their base key.

`envelopeSigningRequirements({ transaction })` combines the transaction source
with operation requirements, deduplicates account addresses, and keeps the
highest threshold. Fee bumps produce a low-threshold requirement for the outer
fee source. These are requirements, not a network lookup of account signer
weights and not proof that a supplied signature will pass network validation.

## Delegated authorization

Assemble `DelegatedSigner` topology before invoking a pipeline. Only the
top-level signer belongs in the pipeline's list; it recursively authorizes its
`nestedDelegates`. Completed operation XDR, not the presence of a signer in a
list, triggers the extra assembly and enforcing simulation. Ordinary entries
pass through those steps without an extra RPC simulation.

Read [delegated signers](signer/delegated-signer.md),
[the invoke sequence](pipelines/invoke-contract.md), and
[auth-entry signing](processes/sign-auth-entries.md).

For smart-account WebAuth, the separate
[SEP-45 handler](../packages/webauth/sep45.md) delegates contract-specific
authorization to the application. Core's transaction capability does not imply
that every credential type is accepted in a SEP-45 server challenge.
