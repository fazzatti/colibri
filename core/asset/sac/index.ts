import { Contract } from "@/contract/index.ts";
import * as E from "@/asset/sac/error.ts";
import type { ContractId, Ed25519PublicKey } from "@/strkeys/types.ts";
import { getContractIdFromGetTransactionResponse } from "@/common/helpers/get-transaction-response.ts";
import { getStellarAssetContractIdFromFailedSimulationResponse } from "@/common/helpers/failed-simulation-response.ts";
import { SIMULATION_FAILED } from "@/processes/simulate-transaction/error.ts";
import {
  Asset,
  nativeToScVal,
  Operation,
  scValToNative,
  type OperationOptions,
} from "stellar-sdk";
import type { xdr } from "stellar-sdk";
import type { NetworkConfig } from "@/network/index.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { Api } from "stellar-sdk/rpc";

import { StrKey } from "@/strkeys/index.ts";
import { assert } from "@/common/assert/assert.ts";
import {
  Method,
  type ContractOutput,
  type BaseInvocation,
  type ContractInput,
} from "@/asset/sac/types.ts";
import { isDefined } from "@/common/verifiers/is-defined.ts";

/**
 * Client class for interacting with Stellar Asset Contracts (SAC).
 *
 * This class provides a high-level interface for interacting with Stellar Asset Contracts,
 * which are Soroban smart contracts that enable classic Stellar assets to be used within
 * the Soroban ecosystem. SACs implement the SEP-41 token interface and are defined in CAP-0046-06.
 *
 * SACs bridge classic Stellar assets with Soroban smart contracts while maintaining
 * compatibility with the existing Stellar asset system. The contract ID is deterministically
 * derived from the asset code and issuer.
 *
 * @see {@link https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-06.md | CAP-0046-06}
 * @see {@link https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md | SEP-41}
 *
 * @example
 * ```typescript
 * // Create a SAC client instance
 * const sac = new StellarAssetContract({
 *   code: "USDC",
 *   issuer: "GCNY...",
 *   networkConfig: NetworkConfig.TestNet(),
 * });
 *
 * // Deploy the contract on the network
 * await sac.deploy(txConfig);
 *
 * // Read token info
 * const name = await sac.name();
 * const symbol = await sac.symbol();
 * const decimals = await sac.decimals();
 *
 * // Check balance
 * const balance = await sac.balance({ id: userAddress });
 *
 * // Transfer tokens
 * await sac.transfer({
 *   from: senderAddress,
 *   to: recipientAddress,
 *   amount: 1000000000n, // 100 tokens (7 decimals)
 *   config: txConfig,
 * });
 * ```
 */
export class StellarAssetContract {
  /**
   * The asset code (e.g., "USDC", "XLM").
   * For credit assets, this is a 1-12 character alphanumeric string.
   */
  readonly code: string;

  /**
   * The asset issuer, which can be either:
   * - An Ed25519 public key (for credit assets), representing the Stellar account that issued the asset.
   * - The string `"native"` (for the native XLM asset).
   */
  private issuer: Ed25519PublicKey | "native";

  /**
   * The underlying Contract instance used for Soroban interactions.
   * Provides access to low-level contract operations.
   */
  readonly contract: Contract;

  /**
   * The deterministic contract ID derived from the asset code, issuer, and network.
   * This is a C-prefixed Stellar strkey that uniquely identifies the SAC on the network.
   */
  readonly contractId: ContractId;

  /**
   * Creates a new StellarAssetContract instance.
   *
   * The contract ID is automatically calculated from the asset code, issuer,
   * and network passphrase using the deterministic SAC address derivation.
   *
   * @param args - Constructor arguments
   * @param args.networkConfig - Network configuration (TestNet, MainNet, or custom)
   * @param args.code - The asset code (1-12 alphanumeric characters)
   * @param args.issuer - The Ed25519 public key of the asset issuer
   *
   * @example
   * ```typescript
   * const sac = new StellarAssetContract({
   *   code: "USDC",
   *   issuer: "GCNY5OXYSY4FKHOPT2SPOQZAOEIGXB5LBYW3HVU3OWSTQITS65M5RCNY",
   *   networkConfig: NetworkConfig.TestNet(),
   * });
   * ```
   */
  constructor(args: {
    networkConfig: NetworkConfig;
    code: string;
    issuer: Ed25519PublicKey | "native";
  }) {
    const { code, issuer, networkConfig } = args;

    this.contractId =
      issuer === "native"
        ? (Asset.native().contractId(
            networkConfig.networkPassphrase
          ) as ContractId)
        : (new Asset(code, issuer).contractId(
            networkConfig.networkPassphrase
          ) as ContractId);

    this.contract = new Contract({
      networkConfig,
      contractConfig: {
        contractId: this.contractId,
      },
    });

    this.code = code;
    this.issuer = issuer;
  }

  /**
   * Creates a StellarAssetContract instance for the native XLM asset.
   * This is a convenience method for working with the native asset SAC.
   *
   * @param networkConfig - Network configuration (TestNet, MainNet, or custom)
   * @returns A StellarAssetContract instance for the native XLM asset
   */
  static NativeXLM(networkConfig: NetworkConfig): StellarAssetContract {
    return new StellarAssetContract({
      code: "XLM",
      issuer: "native",
      networkConfig,
    });
  }

  /**
   * Checks if the SAC represents the native XLM asset.
   *
   * @returns `true` if the SAC is for native XLM, `false` otherwise
   */
  public isNativeXLM(): boolean {
    return this.issuer === "native";
  }

  /**
   * Deploys the Stellar Asset Contract on the network.
   *
   * This operation creates the Stellar Asset Contract for the classic asset,
   * enabling it to be used within Soroban smart contracts. If the contract
   * has already been deployed, this method will detect the existing contract
   * and return successfully.
   *
   * @param config - Transaction configuration including fee, timeout, source, and signers
   * @returns The StellarAssetContract instance (for chaining)
   *
   * @throws {FAILED_TO_WRAP_ASSET} If the deployment fails for any reason other than
   *         the contract already existing
   * @throws {UNMATCHED_CONTRACT_ID} If the deployed contract ID doesn't match the expected ID
   *
   * @example
   * ```typescript
   * const sac = new StellarAssetContract({ code, issuer, networkConfig });
   *
   * // Deploy the contract
   * await sac.deploy({
   *   fee: "10000000",
   *   timeout: 30,
   *   source: issuerPublicKey,
   *   signers: [issuerSigner],
   * });
   * ```
   */
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

  /**
   * Gets the contract's ledger key footprint.
   *
   * This is useful for transaction footprint calculations and
   * understanding what ledger entries the contract accesses.
   *
   * @returns The XDR LedgerKey representing the contract's footprint
   *
   * @example
   * ```typescript
   * const footprint = sac.getContractFootprint();
   * // Use in transaction building for footprint hints
   * ```
   */
  public getContractFootprint(): xdr.LedgerKey {
    return this.contract.getContractFootprint();
  }

  /**
   * Retrieves the contract instance ledger entry from the network.
   *
   * This provides detailed information about the contract's current state
   * on the ledger, including its code and data.
   *
   * @returns The ledger entry result from the RPC server
   *
   * @example
   * ```typescript
   * const entry = await sac.getContractInstanceLedgerEntry();
   * console.log("Contract key:", entry.key);
   * ```
   */
  public async getContractInstanceLedgerEntry(): Promise<Api.LedgerEntryResult> {
    return await this.contract.getContractInstanceLedgerEntry();
  }

  // ============================================
  // Descriptive Interface (Read-only)
  // ============================================

  /**
   * Returns the number of decimals used by the token.
   *
   * For Stellar Asset Contracts, this is always 7 (same as classic Stellar assets).
   * This means 1 token = 10,000,000 stroops (the smallest unit).
   *
   * @returns The number of decimals (always 7 for SAC)
   *
   * @example
   * ```typescript
   * const decimals = await sac.decimals();
   * console.log(decimals); // 7
   *
   * // Convert human-readable amount to contract amount
   * const humanAmount = 100;
   * const contractAmount = BigInt(humanAmount * 10 ** decimals);
   * ```
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
   *
   * For Stellar Asset Contracts, this returns the canonical asset string
   * in the format "code:issuer" (e.g., "USDC:GCNY5OXYSY4FKHOPT2SPOQZAOEIGXB5LBYW3HVU3OWSTQITS65M5RCNY").
   *
   * @returns The token name in "code:issuer" format
   *
   * @example
   * ```typescript
   * const name = await sac.name();
   * console.log(name); // "USDC:GCNY5OXYSY4FKHOPT2SPOQZAOEIGXB5LBYW3HVU3OWSTQITS65M5RCNY"
   * ```
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
   *
   * For Stellar Asset Contracts, this is the asset code (e.g., "USDC", "XLM").
   *
   * @returns The token symbol (asset code)
   *
   * @example
   * ```typescript
   * const symbol = await sac.symbol();
   * console.log(symbol); // "USDC"
   * ```
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
   *
   * Allowances enable delegated transfers where one address can spend
   * tokens on behalf of another. The allowance decreases as tokens are
   * spent via `transferFrom` or `burnFrom`.
   *
   * @param args - The allowance query parameters
   * @param args.from - The address that granted the allowance
   * @param args.spender - The address allowed to spend
   * @returns The remaining allowance amount as bigint (i128)
   *
   * @example
   * ```typescript
   * const allowance = await sac.allowance({
   *   from: ownerAddress,
   *   spender: spenderAddress,
   * });
   * console.log(`Spender can spend ${allowance} tokens`);
   * ```
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
   * Returns the token balance of the specified address.
   *
   * @param args - The balance query parameters
   * @param args.id - The address to query (can be a Stellar account or contract)
   * @returns The balance as bigint (i128), with 7 decimal places
   *
   * @example
   * ```typescript
   * const balance = await sac.balance({ id: userAddress });
   * const humanReadable = Number(balance) / 10_000_000;
   * console.log(`Balance: ${humanReadable} tokens`);
   * ```
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
   *
   * For assets with the `AUTH_REQUIRED` flag, addresses must be authorized
   * before they can hold the token. This is used for compliance and regulatory purposes.
   *
   * @param args - The authorization query parameters
   * @param args.id - The address to check
   * @returns `true` if authorized, `false` otherwise
   *
   * @example
   * ```typescript
   * const isAuthorized = await sac.authorized({ id: userAddress });
   * if (!isAuthorized) {
   *   console.log("User needs authorization before receiving tokens");
   * }
   * ```
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
   * Returns the current admin address of the token.
   *
   * The admin is initially the asset issuer and has special privileges including:
   * - Minting new tokens
   * - Clawing back tokens (if enabled)
   * - Setting authorization status
   * - Transferring admin rights
   *
   * @returns The admin address
   *
   * @example
   * ```typescript
   * const admin = await sac.admin();
   * console.log(`Current admin: ${admin}`);
   * ```
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
   * Sets an allowance for `spender` to transfer or burn tokens from `from`.
   *
   * The allowance enables delegated operations where a spender can use
   * `transferFrom` or `burnFrom` up to the approved amount until expiration.
   *
   * @param args - The approval parameters
   * @param args.from - The address granting the allowance (must authorize the transaction)
   * @param args.spender - The address being allowed to spend
   * @param args.amount - The maximum amount allowed to spend (i128)
   * @param args.expirationLedger - The ledger sequence number when the allowance expires
   * @param args.config - Transaction configuration (fee, timeout, source, signers)
   * @param args.auth - Optional pre-signed authorization entries
   * @returns The invoke result with transaction details
   *
   * @example
   * ```typescript
   * // Approve spender to spend 1000 tokens, expiring in ~1000 ledgers (~83 minutes)
   * const currentLedger = (await rpc.getLatestLedger()).sequence;
   * await sac.approve({
   *   from: ownerAddress,
   *   spender: spenderAddress,
   *   amount: 1000_0000000n, // 1000 tokens with 7 decimals
   *   expirationLedger: currentLedger + 1000,
   *   config: txConfig,
   * });
   * ```
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
   * Transfers tokens from one address to another.
   *
   * The `from` address must authorize the transaction (either by signing
   * or through pre-signed auth entries).
   *
   * @param args - The transfer parameters
   * @param args.from - The source address (must authorize the transaction)
   * @param args.to - The destination address
   * @param args.amount - The amount to transfer (i128)
   * @param args.config - Transaction configuration (fee, timeout, source, signers)
   * @param args.auth - Optional pre-signed authorization entries
   * @returns The invoke result with transaction details
   *
   * @example
   * ```typescript
   * await sac.transfer({
   *   from: senderAddress,
   *   to: recipientAddress,
   *   amount: 100_0000000n, // 100 tokens with 7 decimals
   *   config: {
   *     fee: "10000000",
   *     timeout: 30,
   *     source: senderAddress,
   *     signers: [senderSigner],
   *   },
   * });
   * ```
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
   * Transfers tokens from one address to another on behalf of a spender.
   *
   * This requires prior approval from `from` for `spender` via the `approve` method.
   * The allowance is reduced by the transfer amount.
   *
   * @param args - The delegated transfer parameters
   * @param args.spender - The address performing the transfer (must authorize)
   * @param args.from - The source address (whose tokens are being spent)
   * @param args.to - The destination address
   * @param args.amount - The amount to transfer (i128)
   * @param args.config - Transaction configuration (fee, timeout, source, signers)
   * @param args.auth - Optional pre-signed authorization entries
   * @returns The invoke result with transaction details
   *
   * @example
   * ```typescript
   * // Spender transfers tokens from owner to recipient using allowance
   * await sac.transferFrom({
   *   spender: spenderAddress,
   *   from: ownerAddress,
   *   to: recipientAddress,
   *   amount: 50_0000000n, // 50 tokens
   *   config: {
   *     fee: "10000000",
   *     timeout: 30,
   *     source: spenderAddress,
   *     signers: [spenderSigner],
   *   },
   * });
   * ```
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
   * Burns (destroys) tokens from an address.
   *
   * The `from` address must authorize the burn operation. Burned tokens
   * are permanently removed from circulation.
   *
   * @param args - The burn parameters
   * @param args.from - The address to burn from (must authorize)
   * @param args.amount - The amount to burn (i128)
   * @param args.config - Transaction configuration (fee, timeout, source, signers)
   * @param args.auth - Optional pre-signed authorization entries
   * @returns The invoke result with transaction details
   *
   * @example
   * ```typescript
   * await sac.burn({
   *   from: holderAddress,
   *   amount: 100_0000000n, // 100 tokens
   *   config: {
   *     fee: "10000000",
   *     timeout: 30,
   *     source: holderAddress,
   *     signers: [holderSigner],
   *   },
   * });
   * ```
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
   * Burns tokens from an address on behalf of a spender.
   *
   * This requires prior approval from `from` for `spender` via the `approve` method.
   * The allowance is reduced by the burn amount. Burned tokens are permanently
   * removed from circulation.
   *
   * @param args - The delegated burn parameters
   * @param args.spender - The address performing the burn (must authorize)
   * @param args.from - The address to burn from
   * @param args.amount - The amount to burn (i128)
   * @param args.config - Transaction configuration (fee, timeout, source, signers)
   * @param args.auth - Optional pre-signed authorization entries
   * @returns The invoke result with transaction details
   *
   * @example
   * ```typescript
   * await sac.burnFrom({
   *   spender: spenderAddress,
   *   from: ownerAddress,
   *   amount: 25_0000000n, // 25 tokens
   *   config: {
   *     fee: "10000000",
   *     timeout: 30,
   *     source: spenderAddress,
   *     signers: [spenderSigner],
   *   },
   * });
   * ```
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
   * Sets a new admin for the token contract.
   *
   * Can only be called by the current admin (initially the asset issuer).
   * The new admin will have all administrative privileges including minting,
   * clawback, and authorization management.
   *
   * @param args - The set admin parameters
   * @param args.newAdmin - The address of the new admin
   * @param args.config - Transaction configuration (fee, timeout, source, signers)
   * @param args.auth - Optional pre-signed authorization entries
   * @returns The invoke result with transaction details
   *
   * @example
   * ```typescript
   * // Transfer admin rights to a new address
   * await sac.setAdmin({
   *   newAdmin: newAdminAddress,
   *   config: {
   *     fee: "10000000",
   *     timeout: 30,
   *     source: currentAdminAddress,
   *     signers: [currentAdminSigner],
   *   },
   * });
   * ```
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
   * Sets or revokes authorization for an address to hold the token.
   *
   * Can only be called by the admin. This is used for compliance purposes
   * with assets that have the `AUTH_REQUIRED` or `AUTH_REVOCABLE` flags set.
   *
   * @param args - The set authorized parameters
   * @param args.id - The address to authorize/deauthorize
   * @param args.authorize - `true` to authorize, `false` to deauthorize
   * @param args.config - Transaction configuration (fee, timeout, source, signers)
   * @param args.auth - Optional pre-signed authorization entries
   * @returns The invoke result with transaction details
   *
   * @example
   * ```typescript
   * // Authorize a user to hold the token
   * await sac.setAuthorized({
   *   id: userAddress,
   *   authorize: true,
   *   config: adminTxConfig,
   * });
   *
   * // Revoke authorization (freeze the user's holdings)
   * await sac.setAuthorized({
   *   id: userAddress,
   *   authorize: false,
   *   config: adminTxConfig,
   * });
   * ```
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
   * Mints (creates) new tokens and sends them to an address.
   *
   * Can only be called by the admin. This increases the total supply
   * of the token. For classic Stellar assets, this mirrors the payment
   * operation from the issuer.
   *
   * @param args - The mint parameters
   * @param args.to - The address to mint tokens to
   * @param args.amount - The amount to mint (i128)
   * @param args.config - Transaction configuration (fee, timeout, source, signers)
   * @param args.auth - Optional pre-signed authorization entries
   * @returns The invoke result with transaction details
   *
   * @example
   * ```typescript
   * // Mint 1 million tokens to a user
   * await sac.mint({
   *   to: recipientAddress,
   *   amount: 1_000_000_0000000n, // 1M tokens with 7 decimals
   *   config: adminTxConfig,
   * });
   * ```
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
   * Claws back (forcibly reclaims) tokens from an address.
   *
   * Can only be called by the admin. Requires the classic asset to have
   * the `AUTH_CLAWBACK_ENABLED` flag set. This is used for regulatory
   * compliance to recover tokens in cases of fraud or legal requirements.
   *
   * @param args - The clawback parameters
   * @param args.from - The address to clawback tokens from
   * @param args.amount - The amount to clawback (i128)
   * @param args.config - Transaction configuration (fee, timeout, source, signers)
   * @param args.auth - Optional pre-signed authorization entries
   * @returns The invoke result with transaction details
   *
   * @example
   * ```typescript
   * // Clawback 500 tokens from a user
   * await sac.clawback({
   *   from: targetAddress,
   *   amount: 500_0000000n, // 500 tokens
   *   config: adminTxConfig,
   * });
   * ```
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
