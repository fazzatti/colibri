import {
  Account,
  Address,
  BASE_FEE,
  Operation,
  StrKey,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import { Buffer } from "buffer";
import { Api } from "stellar-sdk/rpc";
import { Sep45Code, Sep45Error } from "@/error.ts";
import type { Sep45Rpc, Sep45SimulationReceipt } from "@/sep45/types.ts";
import type { Sep45AuthorizedChallenge } from "@/sep45/challenge.ts";
import type { LedgerKey } from "@/stellar-sdk-types.ts";

const DUMMY_SOURCE = StrKey.encodeEd25519PublicKey(Buffer.alloc(32));

function footprintStrings(keys: xdr.LedgerKey[]): string[] {
  return keys.map((key) => key.toXDR("base64"));
}

function validateReadWriteKey(
  key: xdr.LedgerKey,
  allowedNonceAddresses: ReadonlySet<string>,
  webAuthContractId: string,
): void {
  if (key.switch().name !== "contractData") {
    throw new Sep45Error({
      code: Sep45Code.UNSAFE_FOOTPRINT,
      message: "SEP-45 simulation attempted a non-contract-data write",
      data: { ledgerKeyType: key.switch().name },
    });
  }
  const contractData = key.contractData();
  const address = Address.fromScAddress(contractData.contract()).toString();
  const keyType = contractData.key().switch().name;
  if (
    keyType === "scvLedgerKeyNonce" &&
    allowedNonceAddresses.has(address)
  ) {
    return;
  }
  if (
    keyType === "scvLedgerKeyContractInstance" &&
    address === webAuthContractId
  ) {
    return;
  }
  throw new Sep45Error({
    code: keyType === "scvLedgerKeyContractInstance"
      ? Sep45Code.INVALID_RESTORATION
      : Sep45Code.UNSAFE_FOOTPRINT,
    message: "SEP-45 simulation produced an unsafe read-write footprint",
    data: { address, keyType },
  });
}

/** Validates the exact SEP-45 read-write footprint allowlist. */
export function validateSep45Footprint(
  readWrite: LedgerKey[],
  allowedNonceAddresses: ReadonlySet<string>,
  webAuthContractId: string,
): void {
  for (const key of readWrite) {
    validateReadWriteKey(key, allowedNonceAddresses, webAuthContractId);
  }
}

/** Runs enforcing simulation and validates its side-effect footprint. */
export async function simulateSep45Challenge(
  challenge: Sep45AuthorizedChallenge,
  options: {
    rpc: Sep45Rpc;
    networkPassphrase: string;
    webAuthContractId: string;
  },
): Promise<Sep45SimulationReceipt> {
  const verified = challenge.verified;
  let latest: { sequence: number };
  try {
    latest = await options.rpc.getLatestLedger();
  } catch (cause) {
    throw new Sep45Error({
      code: Sep45Code.RPC_FAILED,
      message: "Could not fetch the latest ledger for SEP-45 simulation",
      cause,
    });
  }
  if (latest.sequence >= challenge.validUntilLedgerSeq) {
    throw new Sep45Error({
      code: Sep45Code.AUTHORIZATION_EXPIRED,
      message: "SEP-45 authorization expired before simulation",
      data: {
        latestLedger: latest.sequence,
        validUntilLedgerSeq: challenge.validUntilLedgerSeq,
      },
    });
  }

  const transaction = new TransactionBuilder(new Account(DUMMY_SOURCE, "-1"), {
    fee: BASE_FEE,
    networkPassphrase: options.networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: options.webAuthContractId,
        function: "web_auth_verify",
        args: [xdr.ScVal.fromXDR(verified.invocationArgument.toXDR())],
        auth: challenge.entries,
      }),
    )
    .setTimeout(0)
    .build();

  let response: Awaited<ReturnType<Sep45Rpc["simulateTransaction"]>>;
  try {
    response = await options.rpc.simulateTransaction(
      transaction,
      undefined,
      "enforce",
    );
  } catch (cause) {
    throw new Sep45Error({
      code: Sep45Code.RPC_FAILED,
      message: "SEP-45 enforcing simulation request failed",
      cause,
    });
  }
  if (Api.isSimulationError(response)) {
    throw new Sep45Error({
      code: Sep45Code.SIMULATION_FAILED,
      message: "SEP-45 enforcing simulation rejected the challenge",
      data: { error: response.error },
    });
  }
  if (!Api.isSimulationSuccess(response)) {
    throw new Sep45Error({
      code: Sep45Code.SIMULATION_FAILED,
      message: "SEP-45 enforcing simulation returned an unknown result",
    });
  }

  const allowedAddresses = new Set([
    verified.account,
    verified.serverAccount,
    ...(verified.clientDomainAccount ? [verified.clientDomainAccount] : []),
  ]);
  const readOnly = response.transactionData.getReadOnly();
  const readWrite = response.transactionData.getReadWrite();
  validateSep45Footprint(
    readWrite,
    allowedAddresses,
    options.webAuthContractId,
  );
  if (Api.isSimulationRestore(response)) {
    validateSep45Footprint(
      response.restorePreamble.transactionData.getReadWrite(),
      allowedAddresses,
      options.webAuthContractId,
    );
  }
  return {
    latestLedger: response.latestLedger,
    transactionXdr: transaction.toXDR(),
    readOnlyFootprint: footprintStrings(readOnly),
    readWriteFootprint: footprintStrings(readWrite),
  };
}
