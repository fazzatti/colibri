// deno-lint-ignore-file require-await
import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { assert, assertEquals, assertRejects } from "@std/assert";

import { xdr, Transaction } from "stellar-sdk";
import { Api, type Server } from "stellar-sdk/rpc";
import { SendTransaction } from "./index.ts";
import { SendTransactionStatus } from "./types.ts";
import * as E from "./error.ts";

import { stub, type Stub } from "@std/testing/mock";

const withMockedDateNow = async <T>(
  values: number[],
  fn: () => Promise<T>
): Promise<T> => {
  const originalNow = Date.now;
  let index = 0;
  Date.now = (() =>
    values[Math.min(index++, values.length - 1)]) as typeof Date.now;
  try {
    return await fn();
  } finally {
    Date.now = originalNow;
  }
};

const mockTransaction = {
  timeBounds: { maxTime: 1000 },
} as unknown as Transaction;
Object.setPrototypeOf(mockTransaction, Transaction.prototype);

export const getTransactionTimeout = (_tx: Transaction): number | undefined =>
  undefined;

const transactionHelpers = { getTransactionTimeout };

const buildSuccessResponse = (
  hash: string,
  returnValue: xdr.ScVal | undefined = undefined
): Api.GetSuccessfulTransactionResponse =>
  ({
    status: Api.GetTransactionStatus.SUCCESS,
    envelopeXdr: "AAAA",
    resultXdr: "AAAA",
    resultMetaXdr: "AAAA",
    feeMetaXdr: null,
    hash,
    ledger: 123,
    createdAt: new Date().toISOString(),
    pagingToken: "1",
    returnValue,
  } as unknown as Api.GetSuccessfulTransactionResponse);

describe("SendTransaction", () => {
  let getTransactionTimeoutStub: Stub<typeof transactionHelpers>;

  beforeEach(() => {
    getTransactionTimeoutStub = stub(
      transactionHelpers,
      "getTransactionTimeout",
      () => undefined
    );
    // getTransactionTimeoutStub.restore();
  });

  afterEach(() => {
    getTransactionTimeoutStub?.restore();
  });

  describe("Construction", () => {
    it("creates process with proper name", () => {
      assertEquals(SendTransaction.name, "SendTransaction");
    });
  });

  describe("Success", () => {
    it("returns successful response when transaction completes", async () => {
      const tx = mockTransaction;
      const hash = "hash-success";
      const returnValue = xdr.ScVal.scvBool(true);
      let sendCalls = 0;
      let getCalls = 0;

      const successResponse = buildSuccessResponse(hash, returnValue);

      const rpc = {
        async sendTransaction(sentTx: Transaction) {
          sendCalls++;
          assertEquals(sentTx, tx);
          return {
            status: SendTransactionStatus.PENDING,
            hash,
          } as Api.SendTransactionResponse;
        },
        async getTransaction(requestedHash: string) {
          getCalls++;
          assertEquals(requestedHash, hash);
          return successResponse;
        },
      } as unknown as Server;

      const result = await SendTransaction.run({ tx, rpc });

      assertEquals(result.hash, hash);
      assertEquals(result.returnValue, returnValue);
      assertEquals(result.response, successResponse);
      assertEquals(sendCalls, 1);
      assertEquals(getCalls, 1);
    });

    it("polls using provided timeout when transaction timeout is disabled", async () => {
      const tx = {} as unknown as Transaction;
      Object.setPrototypeOf(tx, Transaction.prototype);

      const hash = "hash-provided-timeout";
      const returnValue = xdr.ScVal.scvU32(42);
      let getCalls = 0;
      const responses: Api.GetTransactionResponse[] = [
        {
          status: Api.GetTransactionStatus.NOT_FOUND,
        } as Api.GetTransactionResponse,
        {
          status: Api.GetTransactionStatus.NOT_FOUND,
        } as Api.GetTransactionResponse,
        buildSuccessResponse(hash, returnValue) as Api.GetTransactionResponse,
      ];

      const rpc = {
        async sendTransaction(sentTx: Transaction) {
          assertEquals(sentTx, tx);
          return {
            status: SendTransactionStatus.PENDING,
            hash,
          } as Api.SendTransactionResponse;
        },
        async getTransaction(requestedHash: string) {
          assertEquals(requestedHash, hash);
          const response = responses[Math.min(getCalls, responses.length - 1)];
          getCalls++;
          return response;
        },
      } as unknown as Server;

      const result = await withMockedDateNow(
        [0, 400, 800, 1200, 1600],
        async () =>
          await SendTransaction.run({
            tx,
            rpc,
            options: {
              timeoutInSeconds: 1,
              waitIntervalInMs: 400,
              useTransactionTimeoutIfAvailable: true,
            },
          })
      );

      assertEquals(result.hash, hash);
      assertEquals(result.returnValue, returnValue);
      assertEquals(getCalls, 3);
    });

    describe("Errors", () => {
      it("throws MISSING_ARG when tx is missing", async () => {
        const err = await assertRejects(
          async () =>
            await SendTransaction.run({
              tx: undefined as unknown as Transaction,
              rpc: {} as Server,
            }),
          E.MISSING_ARG
        );
        assert(err instanceof E.MISSING_ARG);
      });

      it("throws TIMEOUT_TOO_LOW when timeout is below minimum", async () => {
        const err = await assertRejects(
          async () =>
            await SendTransaction.run({
              tx: mockTransaction,
              rpc: {} as Server,
              options: { timeoutInSeconds: 0 },
            }),
          E.TIMEOUT_TOO_LOW
        );
        assert(err instanceof E.TIMEOUT_TOO_LOW);
      });

      it("throws WAIT_INTERVAL_TOO_LOW when wait interval is below minimum", async () => {
        const err = await assertRejects(
          async () =>
            await SendTransaction.run({
              tx: mockTransaction,
              rpc: {} as Server,
              options: { waitIntervalInMs: 50 },
            }),
          E.WAIT_INTERVAL_TOO_LOW
        );
        assert(err instanceof E.WAIT_INTERVAL_TOO_LOW);
      });

      it("throws FAIL_TO_SEND_TRANSACTION when RPC send fails", async () => {
        const rpc = {
          async sendTransaction() {
            throw new Error("boom");
          },
          async getTransaction() {
            throw new Error("should not be called");
          },
        } as unknown as Server;

        const err = await assertRejects(
          async () =>
            await SendTransaction.run({
              tx: mockTransaction,
              rpc,
            }),
          E.FAIL_TO_SEND_TRANSACTION
        );
        assert(err instanceof E.FAIL_TO_SEND_TRANSACTION);
      });

      it("throws DUPLICATE_TRANSACTION when RPC reports duplicate", async () => {
        let getCalls = 0;
        const hash = "duplicate-hash";
        const rpc = {
          async sendTransaction() {
            return {
              status: SendTransactionStatus.DUPLICATE,
              hash,
            } as Api.SendTransactionResponse;
          },
          async getTransaction() {
            getCalls++;
            throw new Error("should not be called");
          },
        } as unknown as Server;

        const err = await assertRejects(
          async () =>
            await SendTransaction.run({
              tx: mockTransaction,
              rpc,
            }),
          E.DUPLICATE_TRANSACTION
        );
        assert(err instanceof E.DUPLICATE_TRANSACTION);
        assertEquals(getCalls, 0);
      });

      it("throws TRY_AGAIN_LATER when RPC requests retry", async () => {
        const hash = "retry-hash";
        const rpc = {
          async sendTransaction() {
            return {
              status: SendTransactionStatus.TRY_AGAIN_LATER,
              hash,
            } as Api.SendTransactionResponse;
          },
          async getTransaction() {
            throw new Error("should not be called");
          },
        } as unknown as Server;

        const err = await assertRejects(
          async () =>
            await SendTransaction.run({
              tx: mockTransaction,
              rpc,
            }),
          E.TRY_AGAIN_LATER
        );
        assert(err instanceof E.TRY_AGAIN_LATER);
      });

      it("throws ERROR_STATUS when RPC returns error status", async () => {
        const hash = "error-hash";
        const rpc = {
          async sendTransaction() {
            return {
              status: SendTransactionStatus.ERROR,
              hash,
              errorResult: undefined,
              diagnosticEvents: undefined,
            } as unknown as Api.SendTransactionResponse;
          },
          async getTransaction() {
            throw new Error("should not be called");
          },
        } as unknown as Server;

        const err = await assertRejects(
          async () =>
            await SendTransaction.run({
              tx: mockTransaction,
              rpc,
            }),
          E.ERROR_STATUS
        );
        assert(err instanceof E.ERROR_STATUS);
      });

      it("throws UNEXPECTED_STATUS when RPC returns unknown status", async () => {
        const hash = "unexpected-hash";
        const rpc = {
          async sendTransaction() {
            return {
              status: "UNKNOWN_STATUS",
              hash,
            } as unknown as Api.SendTransactionResponse;
          },
          async getTransaction() {
            throw new Error("should not be called");
          },
        } as unknown as Server;

        const err = await assertRejects(
          async () =>
            await SendTransaction.run({
              tx: mockTransaction,
              rpc,
            }),
          E.UNEXPECTED_STATUS
        );
        assert(err instanceof E.UNEXPECTED_STATUS);
      });

      it("throws UNEXPECTED_STATUS when getTransaction returns unknown status", async () => {
        const hash = "unexpected-get-status";
        const rpc = {
          async sendTransaction() {
            return {
              status: SendTransactionStatus.PENDING,
              hash,
            } as Api.SendTransactionResponse;
          },
          async getTransaction() {
            return {
              status: "MYSTERY_STATUS",
            } as unknown as Api.GetTransactionResponse;
          },
        } as unknown as Server;

        const err = await assertRejects(
          async () =>
            await SendTransaction.run({
              tx: mockTransaction,
              rpc,
            }),
          E.UNEXPECTED_STATUS
        );
        assert(err instanceof E.UNEXPECTED_STATUS);
      });
      it("throws FAILED_TO_GET_TRANSACTION_STATUS when RPC get fails", async () => {
        const hash = "get-fail-hash";
        const rpc = {
          async sendTransaction() {
            return {
              status: SendTransactionStatus.PENDING,
              hash,
            } as Api.SendTransactionResponse;
          },
          async getTransaction() {
            throw new Error("rpc unavailable");
          },
        } as unknown as Server;

        const err = await assertRejects(
          async () =>
            await SendTransaction.run({
              tx: mockTransaction,
              rpc,
            }),
          E.FAILED_TO_GET_TRANSACTION_STATUS
        );
        assert(err instanceof E.FAILED_TO_GET_TRANSACTION_STATUS);
      });

      it("throws TRANSACTION_FAILED when RPC reports failed execution", async () => {
        const hash = "failed-hash";
        const failedResponse = {
          status: Api.GetTransactionStatus.FAILED,
          envelopeXdr: "envelope-xdr",
          resultXdr: "result-xdr",
          resultMetaXdr: "result-meta-xdr",
          diagnosticEvents: [],
        } as unknown as Api.GetFailedTransactionResponse;

        const rpc = {
          async sendTransaction() {
            return {
              status: SendTransactionStatus.PENDING,
              hash,
            } as Api.SendTransactionResponse;
          },
          async getTransaction(requestedHash: string) {
            assertEquals(requestedHash, hash);
            return failedResponse;
          },
        } as unknown as Server;

        const err = await assertRejects(
          async () =>
            await SendTransaction.run({
              tx: mockTransaction,
              rpc,
            }),
          E.TRANSACTION_FAILED
        );
        assert(err instanceof E.TRANSACTION_FAILED);
      });

      it("throws TRANSACTION_NOT_FOUND when transaction never appears before timeout", async () => {
        const hash = "not-found-hash";
        const rpc = {
          async sendTransaction() {
            return {
              status: SendTransactionStatus.PENDING,
              hash,
            } as Api.SendTransactionResponse;
          },
          async getTransaction(requestedHash: string) {
            assertEquals(requestedHash, hash);
            return {
              status: Api.GetTransactionStatus.NOT_FOUND,
            } as Api.GetTransactionResponse;
          },
        } as unknown as Server;

        const err = await withMockedDateNow(
          [0, 500, 1000, 1000, 1000],
          async () =>
            await assertRejects(
              async () =>
                await SendTransaction.run({
                  tx: mockTransaction,
                  rpc,
                  options: {
                    timeoutInSeconds: 1,
                    waitIntervalInMs: 100,
                    useTransactionTimeoutIfAvailable: false,
                  },
                }),
              E.TRANSACTION_NOT_FOUND
            )
        );
        assert(err instanceof E.TRANSACTION_NOT_FOUND);
      });
    });

    it("retries while getTransaction keeps returning NOT_FOUND until timeout elapses", async () => {
      const hash = "still-missing";
      let getCalls = 0;
      const rpc = {
        async sendTransaction() {
          return {
            status: SendTransactionStatus.PENDING,
            hash,
          } as Api.SendTransactionResponse;
        },
        async getTransaction(requestedHash: string) {
          assertEquals(requestedHash, hash);
          getCalls++;
          return {
            status: Api.GetTransactionStatus.NOT_FOUND,
          } as Api.GetTransactionResponse;
        },
      } as unknown as Server;

      const err = await withMockedDateNow(
        [0, 300, 600, 900, 1200],
        async () =>
          await assertRejects(
            async () =>
              await SendTransaction.run({
                tx: mockTransaction,
                rpc,
                options: {
                  timeoutInSeconds: 1,
                  waitIntervalInMs: 300,
                  useTransactionTimeoutIfAvailable: false,
                },
              }),
            E.TRANSACTION_NOT_FOUND
          )
      );

      assert(err instanceof E.TRANSACTION_NOT_FOUND);
      assert(getCalls >= 4);
    });

    it("wraps unknown failures into UNEXPECTED_ERROR", async () => {
      // mocked RPC without hash parameter to force unexpected error
      const rpc = {
        async sendTransaction() {
          return {
            status: SendTransactionStatus.PENDING,
          } as Api.SendTransactionResponse;
        },
      } as unknown as Server;

      const err = await assertRejects(
        async () =>
          await SendTransaction.run({
            tx: {} as Transaction,
            rpc: rpc,
          }),
        E.UNEXPECTED_ERROR
      );
      assert(err instanceof E.UNEXPECTED_ERROR);
    });
  });
});
