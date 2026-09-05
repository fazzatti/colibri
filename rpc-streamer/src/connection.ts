import { Server } from "stellar-sdk/rpc";
import type { StreamerArchiveConfig, StreamerRpcConfig } from "@/types.ts";
import { RPCStreamerError, RPCStreamerErrorCode as Code } from "@/errors.ts";

/** Resolve exactly one live connection; never replace a caller-owned client. @internal */
export function resolveLiveRpc(config: StreamerRpcConfig): Server {
  const count =
    [config.rpcUrl, config.rpc, config.networkConfig].filter((value) =>
      value !== undefined
    ).length;
  if (
    count !== 1 ||
    (config.allowHttp !== undefined && config.rpcUrl === undefined)
  ) {
    throw new RPCStreamerError(
      Code.INVALID_LIVE_CONNECTION,
      "Provide exactly one of rpcUrl, networkConfig, or rpc; allowHttp belongs to rpcUrl.",
    );
  }
  if (config.rpc) return config.rpc;
  const url = config.rpcUrl ?? config.networkConfig?.rpcUrl;
  if (!url) {
    throw new RPCStreamerError(
      Code.MISSING_LIVE_RPC_URL,
      "The selected network must contain an RPC URL.",
    );
  }
  try {
    return new Server(url, {
      allowHttp: config.allowHttp ?? config.networkConfig?.allowHttp ?? false,
    });
  } catch (cause) {
    throw new RPCStreamerError(
      Code.LIVE_CONNECTION_FAILED,
      "Failed to create the live RPC client",
      undefined,
      cause as Error,
    );
  }
}

/** Resolve an optional archive URL or reuse its supplied native client. @internal */
export function resolveArchiveRpc(
  config: StreamerRpcConfig & StreamerArchiveConfig,
): Server | undefined {
  if (
    config.archiveRpc !== undefined &&
    (config.archiveRpcUrl !== undefined ||
      config.archiveAllowHttp !== undefined)
  ) {
    throw new RPCStreamerError(
      Code.INVALID_ARCHIVE_CONNECTION,
      "archiveRpc cannot be combined with archiveRpcUrl or archiveAllowHttp.",
    );
  }
  if (config.archiveRpc) return config.archiveRpc;
  if (!config.archiveRpcUrl) return undefined;
  try {
    return new Server(config.archiveRpcUrl, {
      allowHttp: config.archiveAllowHttp ?? config.allowHttp ??
        config.networkConfig?.allowHttp ?? false,
    });
  } catch (cause) {
    throw new RPCStreamerError(
      Code.ARCHIVE_CONNECTION_FAILED,
      "Failed to create the archive RPC client",
      undefined,
      cause as Error,
    );
  }
}
