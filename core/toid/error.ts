import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type TOIDErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;

  cause?: Error;
  data: unknown;
};

export abstract class TOIDError extends ColibriError<Code, Meta> {
  override readonly source = "@colibri/core/toid";
  override readonly meta: Meta;

  constructor(args: TOIDErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "toid" as const,
      source: "@colibri/core/toid",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic || undefined,
      meta,
    });

    this.meta = meta;
  }
}

export enum Code {
  LEDGER_OUT_OF_RANGE = "TOID_001",
  TX_ORDER_OUT_OF_RANGE = "TOID_002",
  OP_INDEX_OUT_OF_RANGE = "TOID_003",
  INVALID_TOID = "TOID_004",
}
export class LEDGER_OUT_OF_RANGE extends TOIDError {
  constructor(ledgerSequence: number) {
    super({
      code: Code.LEDGER_OUT_OF_RANGE,
      message: `Ledger sequence out of range: ${ledgerSequence} (max 2,147,483,647)`,
      details:
        "The provided ledger sequence exceeds the maximum allowed value for TOID generation.",
      data: { ledgerSequence },
    });
  }
}

export class TX_ORDER_OUT_OF_RANGE extends TOIDError {
  constructor(transactionOrder: number) {
    super({
      code: Code.TX_ORDER_OUT_OF_RANGE,
      message: `Transaction order out of range: ${transactionOrder} (1-1,048,575)`,
      details:
        "The provided transaction application order exceeds the maximum allowed value for TOID generation.",
      data: { transactionOrder },
    });
  }
}

export class OP_INDEX_OUT_OF_RANGE extends TOIDError {
  constructor(operationIndex: number) {
    super({
      code: Code.OP_INDEX_OUT_OF_RANGE,
      message: `Operation index out of range: ${operationIndex} (1-4,095)`,
      details:
        "The provided operation index exceeds the maximum allowed value for TOID generation.",
      data: { operationIndex },
    });
  }
}

export class INVALID_TOID extends TOIDError {
  constructor(toid: string) {
    super({
      code: Code.INVALID_TOID,
      message: `Invalid TOID: ${toid}`,
      details:
        "The provided TOID string is not valid according to the SEP-0035 specification.",
      data: { toid },
    });
  }
}

export const ERROR_TOID = {
  [Code.LEDGER_OUT_OF_RANGE]: LEDGER_OUT_OF_RANGE,
  [Code.TX_ORDER_OUT_OF_RANGE]: TX_ORDER_OUT_OF_RANGE,
  [Code.OP_INDEX_OUT_OF_RANGE]: OP_INDEX_OUT_OF_RANGE,
  [Code.INVALID_TOID]: INVALID_TOID,
};
