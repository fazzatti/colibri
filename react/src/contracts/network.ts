import type { ColibriConfig } from "@/context/config.ts";
import type { ContractIdentity } from "@/contracts/types.ts";
import { ColibriReactError, ReactCode } from "@/errors/index.ts";
/** Validate the execution network without serializing an ABI or computing a cache key. */
export function assertContractNetwork(
  config: ColibriConfig,
  contract: ContractIdentity,
): void {
  if (
    contract.networkConfig.networkPassphrase !==
      config.network.networkPassphrase
  ) {
    throw new ColibriReactError(
      ReactCode.NETWORK_MISMATCH,
      "Contract and provider networks differ",
    );
  }
}
