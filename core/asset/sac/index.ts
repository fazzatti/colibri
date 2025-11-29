import { Contract } from "@/contract/index.ts";
import * as E from "@/asset/sac/error.ts";
import type { ContractId, Ed25519PublicKey } from "../../strkeys/types.ts";
import { getContractIdFromGetTransactionResponse } from "../../common/helpers/get-transaction-response.ts";
import { getStellarAssetContractIdFromFailedSimulationResponse } from "../../common/helpers/failed-simulation-response.ts";
import { SIMULATION_FAILED } from "@/processes/simulate-transaction/error.ts";
import {
  Asset,
  nativeToScVal,
  Operation,
  scValToNative,
  type OperationOptions,
} from "stellar-sdk";
import type { xdr } from "stellar-sdk";
import { NetworkConfig } from "../../network/index.ts";
import type { TransactionConfig } from "../../common/types/transaction-config/types.ts";
import type { Api } from "stellar-sdk/rpc";

import { StrKey } from "../../strkeys/index.ts";
import { assert } from "../../common/assert/assert.ts";
import {
  Method,
  type ContractOutput,
  type BaseInvocation,
  type ContractInput,
} from "./types.ts";
import { isDefined } from "../../common/verifiers/is-defined.ts";
import { SACEvents } from "@colibri/core";

export class StellarAssetContract {
  readonly code: string;
  readonly issuer: Ed25519PublicKey;
  readonly contract: Contract;
  readonly contractId: ContractId;

  constructor(args: {
    networkConfig: NetworkConfig;
    code: string;
    issuer: Ed25519PublicKey;
  }) {
    const { code, issuer, networkConfig } = args;

    this.contractId = new Asset(code, issuer).contractId(
      networkConfig.networkPassphrase
    ) as ContractId;

    this.contract = new Contract({
      networkConfig,
      contractConfig: {
        contractId: this.contractId,
      },
    });

    this.code = code;
    this.issuer = issuer;
  }

  public async deploy(
    config: TransactionConfig
  ): Promise<StellarAssetContract> {
    const asset = new Asset(this.code, this.issuer);

    try {
      const wrapOperation = Operation.createStellarAssetContract({
        asset: asset,
      } as OperationOptions.CreateStellarAssetContract);

      const result = await this.contract.invokePipe.run({
        config,
        operations: [wrapOperation],
      });

      const deployedContractId = getContractIdFromGetTransactionResponse(
        result.response
      );

      assert(
        StrKey.isContractId(deployedContractId) &&
          deployedContractId === this.contractId,
        new E.UNMATCHED_CONTRACT_ID(this.contractId, deployedContractId)
      );

      return this;
    } catch (error) {
      if (error instanceof SIMULATION_FAILED) {
        try {
          const contractId =
            getStellarAssetContractIdFromFailedSimulationResponse(
              error.meta.data.simulationResponse
            );

          if (contractId) {
            assert(
              StrKey.isContractId(contractId) && contractId === this.contractId,
              new E.UNMATCHED_CONTRACT_ID(this.contractId, contractId)
            );

            return this;
          }
        } catch (_innerError) {
          // Ignore inner errors related to extracting contract ID
        }
      }

      throw new E.FAILED_TO_WRAP_ASSET(asset, error as Error);
    }
  }

  public getContractFootprint(): xdr.LedgerKey {
    return this.contract.getContractFootprint();
  }

  public async getContractInstanceLedgerEntry(): Promise<Api.LedgerEntryResult> {
    return await this.contract.getContractInstanceLedgerEntry();
  }

  // ============================================
  // Descriptive Interface (Read-only)
  // ============================================

  /**
   * Returns the number of decimals used by the token.
   * For SAC, this is always 7 (same as Stellar classic assets).
   */
  public async decimals(): Promise<ContractOutput[Method.Decimals]> {
    const result = await this.contract.readRaw({
      method: Method.Decimals,
    });

    assert(isDefined(result), new E.MISSING_RETURN_VALUE(Method.Decimals));

    return scValToNative(result) as ContractOutput[Method.Decimals];
  }

  /**
   * Returns the name of the token.
   * Format: "code:issuer" (e.g., "USDC:GCNY...")
   */
  public async name(): Promise<ContractOutput[Method.Name]> {
    const result = await this.contract.readRaw({
      method: Method.Name,
    });

    assert(isDefined(result), new E.MISSING_RETURN_VALUE(Method.Name));

    return scValToNative(result) as ContractOutput[Method.Name];
  }

  /**
   * Returns the symbol of the token.
   * This is the asset code (e.g., "USDC").
   */
  public async symbol(): Promise<ContractOutput[Method.Symbol]> {
    const result = await this.contract.readRaw({
      method: Method.Symbol,
    });

    assert(isDefined(result), new E.MISSING_RETURN_VALUE(Method.Symbol));

    return scValToNative(result) as ContractOutput[Method.Symbol];
  }

  // ============================================
  // Token Interface (Read-only)
  // ============================================

  /**
   * Returns the allowance for `spender` to transfer from `from`.
   * @param from - The address that granted the allowance
   * @param spender - The address allowed to spend
   * @returns The remaining allowance amount as i128
   */
  public async allowance({
    from,
    spender,
  }: ContractInput[Method.Allowance]): Promise<
    ContractOutput[Method.Allowance]
  > {
    const result = await this.contract.readRaw({
      method: Method.Allowance,
      methodArgs: [
        nativeToScVal(from, { type: "address" }),
        nativeToScVal(spender, { type: "address" }),
      ],
    });

    assert(isDefined(result), new E.MISSING_RETURN_VALUE(Method.Allowance));

    return scValToNative(result) as ContractOutput[Method.Allowance];
  }

  /**
   * Returns the balance of the specified address.
   * @param id - The address to query
   * @returns The balance as i128
   */
  public async balance({
    id,
  }: ContractInput[Method.Balance]): Promise<ContractOutput[Method.Balance]> {
    const result = await this.contract.readRaw({
      method: Method.Balance,
      methodArgs: [nativeToScVal(id, { type: "address" })],
    });

    assert(isDefined(result), new E.MISSING_RETURN_VALUE(Method.Balance));

    return scValToNative(result) as ContractOutput[Method.Balance];
  }

  /**
   * Returns whether the specified address is authorized to hold the token.
   * @param id - The address to check
   * @returns true if authorized, false otherwise
   */
  public async authorized({
    id,
  }: ContractInput[Method.Authorized]): Promise<
    ContractOutput[Method.Authorized]
  > {
    const result = await this.contract.readRaw({
      method: Method.Authorized,
      methodArgs: [nativeToScVal(id, { type: "address" })],
    });

    assert(isDefined(result), new E.MISSING_RETURN_VALUE(Method.Authorized));

    return scValToNative(result) as ContractOutput[Method.Authorized];
  }

  /**
   * Returns the current admin address.
   * @returns The admin address
   */
  public async admin(): Promise<ContractOutput[Method.Admin]> {
    const result = await this.contract.readRaw({
      method: Method.Admin,
    });

    assert(isDefined(result), new E.MISSING_RETURN_VALUE(Method.Admin));

    return scValToNative(result) as ContractOutput[Method.Admin];
  }

  // ============================================
  // Token Interface (Invoke)
  // ============================================

  /**
   * Set the allowance for `spender` to transfer/burn from `from`.
   * @param from - The address granting the allowance (must authorize)
   * @param spender - The address being allowed to spend
   * @param amount - The amount to allow (i128)
   * @param expirationLedger - The ledger sequence number when the allowance expires
   */
  public async approve({
    from,
    spender,
    amount,
    expirationLedger,
    config,
    auth,
  }: ContractInput[Method.Approve] & BaseInvocation): Promise<
    ContractOutput[Method.Approve]
  > {
    const result = await this.contract.invokeRaw({
      operationArgs: {
        function: Method.Approve,
        args: [
          nativeToScVal(from, { type: "address" }),
          nativeToScVal(spender, { type: "address" }),
          nativeToScVal(amount, { type: "i128" }),
          nativeToScVal(expirationLedger, { type: "u32" }),
        ],
        auth,
      },
      config,
    });

    return {
      ...result,
      returnValue: undefined,
    } as ContractOutput[Method.Approve];
  }

  /**
   * Transfer `amount` from `from` to `to`.
   * @param from - The source address (must authorize)
   * @param to - The destination address
   * @param amount - The amount to transfer (i128)
   */
  public async transfer({
    from,
    to,
    amount,
    config,
    auth,
  }: ContractInput[Method.Transfer] & BaseInvocation): Promise<
    ContractOutput[Method.Transfer]
  > {
    const result = await this.contract.invokeRaw({
      operationArgs: {
        function: Method.Transfer,
        args: [
          nativeToScVal(from, { type: "address" }),
          nativeToScVal(to, { type: "address" }),
          nativeToScVal(amount, { type: "i128" }),
        ],
        auth,
      },
      config,
    });

    return {
      ...result,
      returnValue: undefined,
    } as ContractOutput[Method.Transfer];
  }

  /**
   * Transfer `amount` from `from` to `to`, on behalf of `spender`.
   * Requires prior approval from `from` for `spender`.
   * @param spender - The address performing the transfer (must authorize)
   * @param from - The source address
   * @param to - The destination address
   * @param amount - The amount to transfer (i128)
   */
  public async transferFrom({
    spender,
    from,
    to,
    amount,
    config,
    auth,
  }: ContractInput[Method.TransferFrom] & BaseInvocation): Promise<
    ContractOutput[Method.TransferFrom]
  > {
    const result = await this.contract.invokeRaw({
      operationArgs: {
        function: Method.TransferFrom,
        args: [
          nativeToScVal(spender, { type: "address" }),
          nativeToScVal(from, { type: "address" }),
          nativeToScVal(to, { type: "address" }),
          nativeToScVal(amount, { type: "i128" }),
        ],
        auth,
      },
      config,
    });

    return {
      ...result,
      returnValue: undefined,
    } as ContractOutput[Method.TransferFrom];
  }

  /**
   * Burn `amount` from `from`.
   * @param from - The address to burn from (must authorize)
   * @param amount - The amount to burn (i128)
   */
  public async burn({
    from,
    amount,
    config,
    auth,
  }: ContractInput[Method.Burn] & BaseInvocation): Promise<
    ContractOutput[Method.Burn]
  > {
    const result = await this.contract.invokeRaw({
      operationArgs: {
        function: Method.Burn,
        args: [
          nativeToScVal(from, { type: "address" }),
          nativeToScVal(amount, { type: "i128" }),
        ],
        auth,
      },
      config,
    });

    return {
      ...result,
      returnValue: undefined,
    } as ContractOutput[Method.Burn];
  }

  /**
   * Burn `amount` from `from` on behalf of `spender`.
   * Requires prior approval from `from` for `spender`.
   * @param spender - The address performing the burn (must authorize)
   * @param from - The address to burn from
   * @param amount - The amount to burn (i128)
   */
  public async burnFrom({
    spender,
    from,
    amount,
    config,
    auth,
  }: ContractInput[Method.BurnFrom] & BaseInvocation): Promise<
    ContractOutput[Method.BurnFrom]
  > {
    const result = await this.contract.invokeRaw({
      operationArgs: {
        function: Method.BurnFrom,
        args: [
          nativeToScVal(spender, { type: "address" }),
          nativeToScVal(from, { type: "address" }),
          nativeToScVal(amount, { type: "i128" }),
        ],
        auth,
      },
      config,
    });

    return {
      ...result,
      returnValue: undefined,
    } as ContractOutput[Method.BurnFrom];
  }

  // ============================================
  // Admin Interface (Invoke)
  // ============================================

  /**
   * Set a new admin for the token.
   * Can only be called by the current admin (asset issuer initially).
   * @param newAdmin - The address of the new admin
   */
  public async setAdmin({
    newAdmin,
    config,
    auth,
  }: ContractInput[Method.SetAdmin] & BaseInvocation): Promise<
    ContractOutput[Method.SetAdmin]
  > {
    const result = await this.contract.invokeRaw({
      operationArgs: {
        function: Method.SetAdmin,
        args: [nativeToScVal(newAdmin, { type: "address" })],
        auth,
      },
      config,
    });

    return {
      ...result,
      returnValue: undefined,
    } as ContractOutput[Method.SetAdmin];
  }

  /**
   * Set/revoke authorization for an address to hold the token.
   * Can only be called by the admin.
   * @param id - The address to authorize/deauthorize
   * @param authorize - true to authorize, false to deauthorize
   */
  public async setAuthorized({
    id,
    authorize,
    config,
    auth,
  }: ContractInput[Method.SetAuthorized] & BaseInvocation): Promise<
    ContractOutput[Method.SetAuthorized]
  > {
    const result = await this.contract.invokeRaw({
      operationArgs: {
        function: Method.SetAuthorized,
        args: [
          nativeToScVal(id, { type: "address" }),
          nativeToScVal(authorize, { type: "bool" }),
        ],
        auth,
      },
      config,
    });

    return {
      ...result,
      returnValue: undefined,
    } as ContractOutput[Method.SetAuthorized];
  }

  /**
   * Mint `amount` tokens to `to`.
   * Can only be called by the admin.
   * @param to - The address to mint to
   * @param amount - The amount to mint (i128)
   */
  public async mint({
    to,
    amount,
    config,
    auth,
  }: ContractInput[Method.Mint] & BaseInvocation): Promise<
    ContractOutput[Method.Mint]
  > {
    const result = await this.contract.invokeRaw({
      operationArgs: {
        function: Method.Mint,
        args: [
          nativeToScVal(to, { type: "address" }),
          nativeToScVal(amount, { type: "i128" }),
        ],
        auth,
      },
      config,
    });

    return {
      ...result,
      returnValue: undefined,
    } as ContractOutput[Method.Mint];
  }

  /**
   * Clawback `amount` tokens from `from`.
   * Can only be called by the admin.
   * Requires the asset to have the clawback flag enabled.
   * @param from - The address to clawback from
   * @param amount - The amount to clawback (i128)
   */
  public async clawback({
    from,
    amount,
    config,
    auth,
  }: ContractInput[Method.Clawback] & BaseInvocation): Promise<
    ContractOutput[Method.Clawback]
  > {
    const result = await this.contract.invokeRaw({
      operationArgs: {
        function: Method.Clawback,
        args: [
          nativeToScVal(from, { type: "address" }),
          nativeToScVal(amount, { type: "i128" }),
        ],
        auth,
      },
      config,
    });

    return {
      ...result,
      returnValue: undefined,
    } as ContractOutput[Method.Clawback];
  }
}
