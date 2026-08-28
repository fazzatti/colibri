/**
 * Deterministic contract build-verification parsing, policy, comparison,
 * evidence, and domain APIs.
 *
 * This entrypoint does not construct RPC, HTTP, filesystem, Docker, verifier,
 * or CLI adapters.
 *
 * @module
 */

export * from "@/core/index.ts";
export * from "@/error/base.ts";
export * from "@/error/core.ts";
export * from "@/core/policy/error.ts";
