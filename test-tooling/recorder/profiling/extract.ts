import {
  Address,
  FeeBumpTransaction,
  Operation,
  SorobanDataBuilder,
  Transaction,
  xdr,
} from "stellar-sdk";
import type { Collector } from "@/recorder/runtime/collector.ts";
import type {
  Evidence,
  ExecutionEvidence,
  OperationEvidence,
  ResourceProfile,
} from "@/recorder/types.ts";

import {
  confirmedEvents,
  simulationEvents,
} from "@/recorder/profiling/events.ts";
import {
  confirmedChanges,
  simulationChanges,
} from "@/recorder/profiling/ledger-changes.ts";

/** Inspect only known public fields; never visit RPC or signer internals. */
export function object(value: unknown): Record<string, unknown> {
  return value !== null &&
      (typeof value === "object" || typeof value === "function")
    ? value as Record<string, unknown>
    : {};
}
/** Decode known SDK values before bounded normalization. */
export function result(value: unknown): unknown {
  if (xdr.ScVal.is(value)) return value.toJson();
  const data = object(value);
  return data.returnValue && xdr.ScVal.is(data.returnValue)
    ? {
      hash: data.hash,
      ledger: data.ledger,
      createdAt: data.createdAt,
      returnValue: data.returnValue.toJson(),
    }
    : value;
}
/** Extract operation names and contract method without changing the operation. */
export function operations(
  execution: ExecutionEvidence,
  input: unknown,
  collector: Collector,
): Evidence | undefined {
  const data = object(input);
  if (!Array.isArray(data.operations)) return;
  delete execution.method;
  delete execution.contract;
  execution.operations = [];
  execution.operationDetails = [];
  const decoded = data.operations.map((operation: unknown) => {
    if (!(operation instanceof xdr.Operation)) return "unknown";
    const op = Operation.fromXDRObject(operation);
    execution.operations.push(op.type);
    const detail: OperationEvidence = { type: op.type };
    if (op.type === "invokeHostFunction") detail.hostFunction = op.func.type;
    if (op.type === "extendFootprintTtl") detail.extendTo = op.extendTo;
    execution.operationDetails!.push(detail);
    if (
      op.type === "invokeHostFunction" &&
      op.func.type === "hostFunctionTypeInvokeContract"
    ) {
      const call = op.func.invokeContract;
      execution.contract = Address.fromScAddress(call.contractAddress)
        .toString();
      execution.method = call.functionName.toString();
      detail.contract = execution.contract;
      detail.method = execution.method;
    }
    return operation.toJson();
  });
  return collector.safe(decoded);
}
/** Simulation budgets are recommendations; absence is not zero usage. */
export function simulation(
  value: unknown,
  stage: string,
  collector: Collector,
): ResourceProfile | undefined {
  const data = object(value);
  if (
    !(data.transactionData instanceof SorobanDataBuilder) &&
    !Array.isArray(data.events) && !Array.isArray(data.stateChanges)
  ) return;
  const profile: ResourceProfile = { stage };
  const events = simulationEvents(data.events, collector);
  const changes = simulationChanges(data.stateChanges, collector);
  if (events) profile.events = events;
  if (changes) profile.ledgerChanges = changes;
  if (
    collector.options.profiling?.resources &&
    data.transactionData instanceof SorobanDataBuilder
  ) {
    const resources = data.transactionData.build().resources;
    Object.assign(profile, {
      instructions: resources.instructions,
      diskReadBytes: resources.diskReadBytes,
      writeBytes: resources.writeBytes,
      readOnlyEntries: resources.footprint.readOnly.length,
      readWriteEntries: resources.footprint.readWrite.length,
    });
  }
  if (collector.options.profiling?.fees && data.minResourceFee !== undefined) {
    profile.minResourceFee = String(data.minResourceFee);
  }
  const restore = object(data.restorePreamble);
  if (
    restore.transactionData instanceof SorobanDataBuilder &&
    (collector.options.profiling?.resources ||
      collector.options.profiling?.fees)
  ) {
    profile.restoration = collector.safe({
      minResourceFee: collector.options.profiling?.fees
        ? restore.minResourceFee
        : undefined,
      resources: collector.options.profiling?.resources
        ? restore.transactionData.build().resources.toJson()
        : undefined,
    });
  }
  return profile;
}
/** Authorization trees are opt-in; signatures are omitted unless explicitly enabled. */
export function authorization(
  value: unknown,
  collector: Collector,
): Evidence | undefined {
  const level = collector.options.authorization?.level ?? "none";
  if (level === "none" || !Array.isArray(value)) return;
  const entries = value.filter((v): v is xdr.SorobanAuthorizationEntry =>
    v instanceof xdr.SorobanAuthorizationEntry
  );
  if (level === "summary") {
    return {
      entries: entries.length,
      types: entries.map((entry) => entry.credentials.type),
    };
  }
  return entries.slice(0, collector.options.limits?.entries ?? 100).map(
    (entry) => {
      const credentials = entry.credentials;
      const data: Record<string, Evidence> = {
        type: credentials.type,
        invocation: collector.safe(entry.rootInvocation.toJson()),
      };
      if (credentials.type !== "sorobanCredentialsSourceAccount") {
        const address =
          credentials.type === "sorobanCredentialsAddressWithDelegates"
            ? credentials.value.addressCredentials
            : credentials.value;
        data.address = Address.fromScAddress(address.address).toString();
        data.nonce = address.nonce.toString();
        data.expiresAtLedger = address.signatureExpirationLedger;
      }
      if (collector.options.authorization?.signatures) {
        data.encodedEntry = collector.safe(entry.toXdr("base64"));
      }
      return data;
    },
  );
}
/** Capture hashes before submission, including both fee-bump identities. */
export function submitted(
  value: unknown,
  execution: ExecutionEvidence,
  collector: Collector,
): void {
  const tx = object(value).transaction;
  if (!(tx instanceof Transaction) && !(tx instanceof FeeBumpTransaction)) {
    return;
  }
  execution.chain = "unknown";
  execution.hash = xdr.encodeBytes(tx.hash(), "hex");
  const inner = tx instanceof FeeBumpTransaction ? tx.innerTransaction : tx;
  if (tx instanceof FeeBumpTransaction) {
    execution.innerHash = xdr.encodeBytes(inner.hash(), "hex");
  }
  const envelope = inner.toEnvelope();
  if (envelope.type === "envelopeTypeTx") {
    operations(execution, { operations: envelope.v1.tx.operations }, collector);
  }
  const resourceBudget = envelope.type === "envelopeTypeTx" &&
      envelope.v1.tx.ext.type === "sorobanData"
    ? envelope.v1.tx.ext.sorobanData.resources.toJson()
    : undefined;
  execution.submitted = collector.safe({
    source: tx instanceof FeeBumpTransaction ? tx.feeSource : tx.source,
    maxFee: collector.options.profiling?.fees ? tx.fee : undefined,
    envelopeBytes: tx.toEnvelope().toXdr().length,
    resourceBudget: collector.options.profiling?.resources
      ? resourceBudget
      : undefined,
  });
}
/** Confirmed fee information is distinct from simulated minimum resource fees. */
export function confirmed(
  value: unknown,
  execution: ExecutionEvidence,
  collector: Collector,
): void {
  const data = object(value);
  if (typeof data.hash === "string") execution.hash = data.hash;
  const response = object(data.response);
  if (response.status === "SUCCESS") execution.chain = "confirmed-success";
  if (response.status === "FAILED") execution.chain = "confirmed-failed";
  const txResult = response.resultXdr;
  if (
    collector.options.profiling?.fees &&
    txResult instanceof xdr.TransactionResult
  ) execution.feeCharged = txResult.feeCharged.toString();
  const meta = response.resultMetaXdr;
  if (xdr.TransactionMeta.is(meta)) {
    execution.events = confirmedEvents(meta, collector);
    execution.ledgerChanges = confirmedChanges(meta, collector);
  }
  if (collector.options.profiling?.fees && xdr.TransactionMeta.is(meta)) {
    const v = object(meta.value);
    const ext = object(object(v.sorobanMeta).ext);
    if (ext.type === "v1") {
      execution.resourceFees = collector.safe({
        totalNonRefundableResourceFeeCharged:
          object(ext.value).totalNonRefundableResourceFeeCharged,
        totalRefundableResourceFeeCharged:
          object(ext.value).totalRefundableResourceFeeCharged,
        rentFeeCharged: object(ext.value).rentFeeCharged,
      });
    }
  }
}

/** Recognize Colibri's terminal failure without mistaking timeouts for chain failure. */
export function failed(
  value: unknown,
  execution: ExecutionEvidence,
  collector: Collector,
): void {
  const error = object(value);
  if (
    error.code !== "STX_010" ||
    error.source !== "@colibri/core/processes/send-transaction"
  ) return;
  execution.chain = "confirmed-failed";
  const data = object(object(error.meta).data);
  confirmed(
    {
      response: {
        status: "FAILED",
        resultXdr: typeof data.resultXDR === "string"
          ? xdr.TransactionResult.fromXdr(data.resultXDR, "base64")
          : undefined,
        resultMetaXdr: typeof data.resultMetaXDR === "string"
          ? xdr.TransactionMeta.fromXdr(data.resultMetaXDR, "base64")
          : undefined,
      },
    },
    execution,
    collector,
  );
}
