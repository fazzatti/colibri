import { Address, xdr } from "stellar-sdk";
import type { Collector } from "@/recorder/runtime/collector.ts";
import type { EventEvidence } from "@/recorder/types.ts";

interface EventItem {
  event: xdr.ContractEvent;
  source: "operation" | "transaction" | "simulation" | "diagnostic";
  operationIndex?: number;
  stage?: string;
  successful?: boolean;
}
function decode(item: EventItem): unknown {
  const { event, ...context } = item;
  return {
    ...context,
    type: event.type.name,
    contract: event.contractId
      ? Address.contract(event.contractId.toXdrObject()).toString()
      : undefined,
    topics: event.body.v0.topics.map((topic) => topic.toJson()),
    data: event.body.v0.data.toJson(),
  };
}
function collect(
  items: EventItem[],
  collector: Collector,
): EventEvidence | undefined {
  if (collector.options.events === "none") return;
  let contractCount = 0, systemCount = 0, diagnosticCount = 0;
  for (const { event, successful, source } of items) {
    if (
      source === "diagnostic" || successful === false ||
      event.type.name === "diagnostic"
    ) diagnosticCount++;
    else if (event.type.name === "contract") contractCount++;
    else systemCount++;
  }
  const captured = collector.options.events === "full"
    ? items.slice(0, collector.options.limits?.entries ?? 100)
    : [];
  return {
    count: contractCount + systemCount,
    contractCount,
    systemCount,
    diagnosticCount,
    items: collector.options.events === "full"
      ? collector.safe(captured.map(decode))
      : undefined,
    omitted: items.length - captured.length,
  };
}
/** Simulation emits diagnostic wrappers; these are never treated as confirmed events. */
export function simulationEvents(
  value: unknown,
  collector: Collector,
): EventEvidence | undefined {
  if (!Array.isArray(value)) return;
  return collect(
    value.filter((v): v is xdr.DiagnosticEvent =>
      v instanceof xdr.DiagnosticEvent
    )
      .map((v) => ({
        event: v.event,
        source: "simulation",
        successful: v.inSuccessfulContractCall,
      })),
    collector,
  );
}
/** Read one authoritative metadata representation, avoiding RPC/diagnostic duplicates. */
export function confirmedEvents(
  meta: xdr.TransactionMeta,
  collector: Collector,
): EventEvidence | undefined {
  const items: EventItem[] = [];
  let diagnostics: xdr.DiagnosticEvent[];
  if (meta.type === "v3") {
    if (!meta.v3.sorobanMeta) return;
    items.push(
      ...meta.v3.sorobanMeta.events.map((event): EventItem => ({
        event,
        source: "operation",
      })),
    );
    diagnostics = meta.v3.sorobanMeta.diagnosticEvents;
  } else if (meta.type === "v4") {
    meta.v4.operations.forEach((op, operationIndex) => {
      items.push(
        ...op.events.map((event): EventItem => ({
          event,
          operationIndex,
          source: "operation",
        })),
      );
    });
    items.push(
      ...meta.v4.events.map((v): EventItem => ({
        event: v.event,
        stage: v.stage.name,
        source: "transaction",
      })),
    );
    diagnostics = meta.v4.diagnosticEvents;
  } else return;
  // Successful contract/system events in diagnostic wrappers duplicate canonical events.
  for (const v of diagnostics) {
    if (v.event.type.name === "diagnostic" || !v.inSuccessfulContractCall) {
      items.push({
        event: v.event,
        source: "diagnostic",
        successful: v.inSuccessfulContractCall,
      });
    }
  }
  return collect(items, collector);
}
