"use client";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@/native.ts";
import { Asset } from "@colibri/core/ledger";
import type { ContractId, Ed25519PublicKey } from "@colibri/core/strkey";
import { useLedgerEntries } from "@/accounts.ts";
import { useRpc } from "@/rpc.ts";
import { useColibriConfig } from "@/provider.ts";
import { colibriQueryOptions, type QueryControls } from "@/query.ts";
/** Explicit asset identity: XLM, Classic code/issuer, or a deployed SEP-41 contract (including SAC). */
export type AssetId = { kind: "xlm" } | {
  kind: "classic";
  code: string;
  issuer: Ed25519PublicKey;
} | { kind: "sep41"; contractId: ContractId };
/** Exact amount plus decimal precision; raw units are never converted to number. */
export interface Balance {
  /** Explicit asset identity. */
  asset: AssetId;
  /** Account whose balance was read. */
  address: string;
  /** Exact amount in the smallest token units. */
  raw: bigint;
  /** Number of fractional decimal places. */
  decimals: number;
}
/** Read a balance using Classic ledger state or the SEP-41 contract interface. Missing account/trustline remains an error. */
export function useBalance(
  asset: AssetId,
  address: Ed25519PublicKey | ContractId | undefined,
  query: QueryControls<Balance> = {},
): UseQueryResult<Balance, Error> {
  const config = useColibriConfig();
  const reader = useLedgerEntries();
  const rpc = useRpc();
  return useQuery(
    colibriQueryOptions(config, "balance", { asset, address }, async () => {
      if (asset.kind === "sep41") {
        const { SEP41TokenContract } = await import("@colibri/core/assets");
        const token = new SEP41TokenContract({
          networkConfig: config.network,
          rpc,
          contractId: asset.contractId,
        });
        const [raw, decimals] = await Promise.all([
          token.balance({ id: address! }),
          token.decimals(),
        ]);
        return { asset, address: address!, raw, decimals };
      }
      const entry = asset.kind === "xlm"
        ? await reader.account({ accountId: address as Ed25519PublicKey })
        : await reader.trustline({
          accountId: address as Ed25519PublicKey,
          asset: new Asset(asset.code, asset.issuer),
        });
      return { asset, address: address!, raw: entry.balance, decimals: 7 };
    }, { ...query, enabled: !!address && (query.enabled ?? true) }),
  );
}
/** SEP-41 metadata, read through Colibri's standard token client. */
export interface TokenMetadata {
  /** Token display name. */
  name: string;
  /** Token ticker symbol. */
  symbol: string;
  /** Number of fractional decimal places. */
  decimals: number;
}
/** Fetch metadata for a custom token or SAC contract. */
export function useTokenMetadata(
  contractId: ContractId,
  query: QueryControls<TokenMetadata> = {},
): UseQueryResult<TokenMetadata, Error> {
  const config = useColibriConfig();
  const rpc = useRpc();
  return useQuery(
    colibriQueryOptions(config, "token-metadata", contractId, async () => {
      const { SEP41TokenContract } = await import("@colibri/core/assets");
      const token = new SEP41TokenContract({
        networkConfig: config.network,
        rpc,
        contractId,
      });
      const [name, symbol, decimals] = await Promise.all([
        token.name(),
        token.symbol(),
        token.decimals(),
      ]);
      return { name, symbol, decimals };
    }, query),
  );
}
