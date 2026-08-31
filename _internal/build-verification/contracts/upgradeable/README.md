# Build-verification upgrade fixture

This unpublished contract exists only for Colibri integration tests. The same
source builds two deterministic Wasms: the default feature set reports version
`1`, while the `v2` feature reports version `2`. Both expose an intentionally
unprotected `upgrade` function so an ephemeral Quickstart or Testnet instance
can demonstrate that a contract ID resolves to its current Wasm while an old
Wasm hash continues to identify the original code.

Do not copy the fixture's authorization design into a production contract.
