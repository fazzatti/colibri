import { specFingerprint } from "@/contracts/fingerprint.ts";
import type { ColibriConfig } from "@/context/config.ts";
import type { ContractIdentity } from "@/contracts/types.ts";
import { assertContractNetwork } from "@/contracts/network.ts";
/** Include the embedded interface so upgraded/reconfigured clients cannot reuse incompatible decoded data. */
export function contractIdentity(
  config: ColibriConfig,
  contract: ContractIdentity,
): object {
  assertContractNetwork(config, contract);
  return {
    contractId: contract.getContractId(),
    rpcUrl: contract.networkConfig.rpcUrl,
    spec: specFingerprint(contract.getSpec()),
  };
}
