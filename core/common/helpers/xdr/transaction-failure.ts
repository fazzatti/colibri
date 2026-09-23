import {
  FeeBumpTransaction,
  scValToNative,
  type Transaction,
  xdr,
} from "stellar-sdk";

/** @internal Exact native SDK envelope types. */
type NativeFailureTransaction = Transaction | FeeBumpTransaction;
/** @internal Exact native SDK result type. */
type NativeFailureResult = xdr.TransactionResult;
/** @internal Exact native SDK metadata type. */
type NativeFailureMeta = xdr.TransactionMeta;
/** @internal Exact native SDK diagnostic event type. */
type NativeFailureEvent = xdr.DiagnosticEvent;

/** An operation's outer or inner result code, retaining its zero-based index. */
export interface OperationFailure {
  /** Zero-based operation index in the inner transaction for fee bumps. */
  index: number;
  /** Operation type, when an inner operation result is available. */
  type?: string;
  /** Native XDR result discriminant; consumers must handle unfamiliar values. */
  code: string;
}

/** Declared resource limit and optional execution counter, not a retry estimate. */
export interface FailedResourceUsage {
  /** Resource budget declared by the submitted transaction. */
  declared: number;
  /** Available execution counter in decimal units; may stop at the failure. */
  used?: string;
  /** Positive observed overrun, or zero if the available counter is within budget. */
  exceededBy?: string;
}

/** Available declared and charged fees, in decimal stroops. */
export interface TransactionFailureFees {
  /** Total fee declared by the outer envelope, including a fee bump if present. */
  declaredTotalFee?: string;
  /** Resource fee declared by the inner Soroban transaction. */
  declaredResourceFee?: string;
  /** Outer declared fee less the inner resource fee. */
  declaredInclusionFee?: string;
  /** Fee reported in the transaction result; absent for missing results. */
  chargedFee?: string;
  /** Non-refundable charge explicitly reported in Soroban metadata. */
  nonRefundableFeeCharged?: string;
  /** Refundable charge explicitly reported in Soroban metadata. */
  refundableFeeCharged?: string;
  /** Rent charge explicitly reported in Soroban metadata. */
  rentFeeCharged?: string;
}

/** Best-effort readable failure details, supplementing the original evidence. */
export interface TransactionFailureDetails {
  /** Outer transaction result discriminant. */
  transactionCode?: string;
  /** Inner result discriminant when the outer transaction is a fee bump. */
  innerTransactionCode?: string;
  /** Available operation result codes. */
  operations?: OperationFailure[];
  /** Available declared instruction/read/write budgets and trusted Core counters. */
  resources?: Partial<
    Record<"instructions" | "diskReadBytes" | "writeBytes", FailedResourceUsage>
  >;
  /** Fees that can be recovered from the submitted envelope and RPC response. */
  fees?: TransactionFailureFees;
}

/** Evidence accepted by the failure-details extractor. */
export interface TransactionFailureEvidence {
  /** Submitted transaction or fee-bump envelope. */
  transaction: NativeFailureTransaction;
  /** Optional immediate or terminal transaction result. */
  result?: NativeFailureResult;
  /** Optional terminal metadata with charged fee components. */
  resultMeta?: NativeFailureMeta;
  /** Optional Core diagnostics; unknown or malformed events are ignored. */
  diagnosticEvents?: readonly NativeFailureEvent[];
}

function safely<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

function resultDetails(
  result: xdr.TransactionResult,
): TransactionFailureDetails {
  const outer = result.result;
  const inner = "innerResultPair" in outer
    ? outer.innerResultPair.result.result
    : outer;
  const operations = "results" in inner
    ? inner.results.map((operation, index) =>
      operation.type === "opInner"
        ? { index, type: operation.tr.type, code: operation.tr.value.type }
        : { index, code: operation.type }
    )
    : undefined;
  return {
    transactionCode: outer.type,
    ...(inner !== outer ? { innerTransactionCode: inner.type } : {}),
    ...(operations ? { operations } : {}),
  };
}

function declaredDetails(
  transaction: Transaction | FeeBumpTransaction,
): TransactionFailureDetails {
  const inner = transaction instanceof FeeBumpTransaction
    ? transaction.innerTransaction
    : transaction;
  const data = inner.tx.ext.type === "sorobanData"
    ? inner.tx.ext.sorobanData
    : undefined;
  const total = BigInt(transaction.fee);
  const fee = data?.resourceFee ?? 0n;
  return {
    fees: {
      declaredTotalFee: total.toString(),
      declaredResourceFee: fee.toString(),
      declaredInclusionFee: (total - fee).toString(),
    },
    ...(data
      ? {
        resources: {
          instructions: { declared: data.resources.instructions },
          diskReadBytes: { declared: data.resources.diskReadBytes },
          writeBytes: { declared: data.resources.writeBytes },
        },
      }
      : {}),
  };
}

function chargedComponents(meta: xdr.TransactionMeta): TransactionFailureFees {
  const soroban = meta.type === "v3"
    ? meta.v3.sorobanMeta
    : meta.type === "v4"
    ? meta.v4.sorobanMeta
    : null;
  if (soroban?.ext.type !== "v1") return {};
  return {
    nonRefundableFeeCharged: soroban.ext.v1.totalNonRefundableResourceFeeCharged
      .toString(),
    refundableFeeCharged: soroban.ext.v1.totalRefundableResourceFeeCharged
      .toString(),
    rentFeeCharged: soroban.ext.v1.rentFeeCharged.toString(),
  };
}

const METRICS = {
  cpu_insn: "instructions",
  ledger_read_byte: "diskReadBytes",
  ledger_write_byte: "writeBytes",
} as const;

function attachMetric(
  details: TransactionFailureDetails,
  diagnostic: xdr.DiagnosticEvent,
): void {
  const event = diagnostic.event;
  if (
    event.type !== xdr.ContractEventType.diagnostic ||
    event.contractId !== null || event.body.type !== "v0"
  ) return;
  const topics = event.body.v0.topics.map((topic) => scValToNative(topic));
  if (
    topics.length !== 2 || topics[0] !== "core_metrics" ||
    typeof topics[1] !== "string"
  ) return;
  const field = METRICS[topics[1] as keyof typeof METRICS];
  const resource = details.resources?.[field];
  if (!resource) return;
  const used: unknown = scValToNative(event.body.v0.data);
  if (typeof used !== "bigint" || used < 0n) return;
  resource.used = used.toString();
  resource.exceededBy =
    (used > BigInt(resource.declared) ? used - BigInt(resource.declared) : 0n)
      .toString();
}

/**
 * Extracts readable codes, resource counters and fees without masking failures.
 *
 * Missing or malformed evidence is ignored independently. Counters may stop at
 * failure and cannot establish the resources/fees needed for a successful retry.
 * No exact refundable deficit is inferred from an insufficient-fee code.
 *
 * @param evidence - Submitted envelope and available RPC evidence.
 * @returns Best-effort details; keep the original response/XDR alongside them.
 */
export function parseTransactionFailure(
  evidence: TransactionFailureEvidence,
): TransactionFailureDetails {
  const details: TransactionFailureDetails = {
    ...safely(() => declaredDetails(evidence.transaction)),
    ...(evidence.result ? safely(() => resultDetails(evidence.result!)) : {}),
  };
  const chargedFee = safely(() => evidence.result?.feeCharged.toString());
  const components = evidence.resultMeta
    ? safely(() => chargedComponents(evidence.resultMeta!))
    : undefined;
  if (chargedFee !== undefined || components !== undefined) {
    details.fees = {
      ...details.fees,
      ...components,
      ...(chargedFee !== undefined ? { chargedFee } : {}),
    };
  }
  const events = Array.isArray(evidence.diagnosticEvents)
    ? evidence.diagnosticEvents
    : [];
  for (const event of events) {
    safely(() => attachMetric(details, event));
  }
  return details;
}
