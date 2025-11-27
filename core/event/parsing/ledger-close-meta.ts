import { Address, xdr, Contract } from "stellar-sdk";
import { createEventIdFromParts } from "@/event/event-id/index.ts";
import { Event } from "@/event/event.ts";
import type { EventType } from "@/event/types.ts";
import type { ContractId } from "@/strkeys/types.ts";
import type { EventFilter } from "@/event/event-filter/index.ts";
import type { EventHandler } from "@/event/types.ts";
import * as E from "@/event/parsing/error.ts";
import { assert } from "@/common/assert/assert.ts";
import { isDefined } from "@/common/verifiers/is-defined.ts";

export const isLedgerCloseMetaV1 = (
  metadataXdr: xdr.LedgerCloseMeta
): boolean => {
  return metadataXdr.switch() === 1;
};

export const isLedgerCloseMetaV2 = (
  metadataXdr: xdr.LedgerCloseMeta
): boolean => {
  return metadataXdr.switch() === 2;
};

export const parseEventsFromLedgerCloseMeta = async (
  metadataXdr: xdr.LedgerCloseMeta,
  onEvent: EventHandler,
  filters?: EventFilter[]
): Promise<void> => {
  assert(
    xdr.LedgerCloseMeta.isValid(metadataXdr),
    new E.INVALID_LEDGER_CLOSE_META_XDR()
  );

  let ledgerCloseMeta:
    | xdr.LedgerCloseMetaV1
    | xdr.LedgerCloseMetaV2
    | undefined;

  if (isLedgerCloseMetaV1(metadataXdr)) {
    ledgerCloseMeta = metadataXdr.v1();
  }

  if (isLedgerCloseMetaV2(metadataXdr)) {
    ledgerCloseMeta = metadataXdr.v2();
  }

  assert(
    isDefined(ledgerCloseMeta),
    new E.UNSUPPORTED_LEDGER_CLOSE_META_VERSION(metadataXdr.switch())
  );

  const ledgerSequence = ledgerCloseMeta.ledgerHeader().header().ledgerSeq();
  const ledgerClosedAt = ledgerCloseMeta
    .ledgerHeader()
    .header()
    .scpValue()
    .closeTime()
    .toString();
  let transactionIndex = 0;

  for (const txProcessing of ledgerCloseMeta.txProcessing()) {
    transactionIndex++;

    const operations = txProcessing.txApplyProcessing().v4().operations();
    const txHash = txProcessing.result().transactionHash().toString("hex");
    const inSuccessfulContractCall =
      txProcessing.result().result().result().switch().name ===
      xdr.TransactionResultCode.txSuccess().name;
    let operationIndex = 0;

    for (const op of operations) {
      operationIndex++;
      let eventIndex = 0;

      for (const event of op.events()) {
        eventIndex++;

        const topic = event.body().v0().topics();
        const value = event.body().v0().data();
        const type = event.type().name;

        const contractIdXdr = event.contractId();

        const contract =
          contractIdXdr !== null
            ? new Contract(
                Address.fromScAddress(
                  xdr.ScAddress.scAddressTypeContract(contractIdXdr)
                ).toString()
              )
            : undefined;

        const eventMatchesFilters = isIncludedInFilters({
          filters: filters || [],
          contractId: contract?.address().toString() as ContractId,
          type: type as EventType,
          topics: topic,
        });

        if (eventMatchesFilters) {
          const id = createEventIdFromParts(
            ledgerSequence,
            transactionIndex,
            operationIndex,
            eventIndex
          );

          await onEvent(
            new Event({
              id: id,
              ledger: ledgerSequence,
              ledgerClosedAt: ledgerClosedAt,
              contractId: contract,
              type: type as EventType,
              txHash: txHash,
              transactionIndex: transactionIndex,
              operationIndex: operationIndex,
              topic: topic,
              value: value,
              inSuccessfulContractCall: inSuccessfulContractCall,
            })
          );
        }
      }
    }
  }
};

export const isIncludedInFilters = ({
  filters,
  contractId,
  type,
  topics,
}: {
  filters: EventFilter[];
  contractId?: ContractId;
  type?: EventType;
  topics?: xdr.ScVal[];
}): boolean => {
  if (filters === undefined || filters.length === 0) return true;

  for (const filter of filters) {
    if (type !== undefined && !filter.matchesType(type)) continue;
    if (contractId !== undefined && !filter.matchesContractId(contractId))
      continue;
    if (topics !== undefined && !filter.matchesTopics(topics)) continue;

    // If we reach here, the event matches this filter
    return true;
  }

  return false;
};
