import type { ColibriConfig } from "@/context/config.ts";
import type { ContractIdentity } from "@/contracts/types.ts";
import { ColibriReactError, ReactCode } from "@/errors/index.ts";
/** Include the embedded interface so upgraded/reconfigured clients cannot reuse incompatible decoded data. */
export function contractIdentity(
  config: ColibriConfig,
  contract: ContractIdentity,
): object {
  if (
    contract.networkConfig.networkPassphrase !==
      config.network.networkPassphrase
  ) {
    throw new ColibriReactError(
      ReactCode.NETWORK_MISMATCH,
      "Contract and provider networks differ",
    );
  }
  return {
    contractId: contract.getContractId(),
    rpcUrl: contract.networkConfig.rpcUrl,
    spec: contract.getSpec().entries.map((e) => e.toXdr("base64")),
  };
}
