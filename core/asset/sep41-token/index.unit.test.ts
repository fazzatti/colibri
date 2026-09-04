import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStrictEquals,
} from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { SEP41TokenContract } from "@/asset/sep41-token/index.ts";
import * as E from "@/asset/sep41-token/error.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import { NetworkConfig } from "@/network/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import type { ContractId, MuxedAddress } from "@/strkeys/types.ts";
import {
  encodeMuxedAccount,
  encodeMuxedAccountToAddress,
  nativeToScVal,
  scValToNative,
  xdr,
} from "stellar-sdk";

const CONTRACT_ID =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" as ContractId;
const owner = LocalSigner.generateRandom();
const spender = LocalSigner.generateRandom();
const recipient = LocalSigner.generateRandom();
const config: TransactionConfig = {
  fee: "100000",
  source: owner.publicKey(),
  timeout: 30,
  signers: [owner],
};

type ReadRaw = SEP41TokenContract["contract"]["readRaw"];
type InvokeRaw = SEP41TokenContract["contract"]["invokeRaw"];

describe("SEP41TokenContract", () => {
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  const createToken = (
    options?: ConstructorParameters<typeof SEP41TokenContract>[0]["options"],
  ): SEP41TokenContract =>
    new SEP41TokenContract({
      networkConfig: NetworkConfig.TestNet(),
      contractId: CONTRACT_ID,
      options,
    });

  const replaceReadRaw = (
    token: SEP41TokenContract,
    implementation: ReadRaw,
  ): void => {
    const original = token.contract.readRaw.bind(token.contract);
    Object.defineProperty(token.contract, "readRaw", {
      value: implementation,
      configurable: true,
    });
    restore = () => {
      Object.defineProperty(token.contract, "readRaw", {
        value: original,
        configurable: true,
      });
    };
  };

  const replaceInvokeRaw = (
    token: SEP41TokenContract,
    implementation: InvokeRaw,
  ): void => {
    const original = token.contract.invokeRaw.bind(token.contract);
    Object.defineProperty(token.contract, "invokeRaw", {
      value: implementation,
      configurable: true,
    });
    restore = () => {
      Object.defineProperty(token.contract, "invokeRaw", {
        value: original,
        configurable: true,
      });
    };
  };

  it("binds the general Contract client to the supplied contract id", () => {
    const token = createToken();
    assertEquals(token.contractId, CONTRACT_ID);
    assertEquals(token.contract.getContractId(), CONTRACT_ID);
  });

  it("reads allowance and balance with the standardized arguments", async () => {
    const token = createToken();
    const calls: Parameters<ReadRaw>[0][] = [];
    replaceReadRaw(token, (args) => {
      calls.push(args);
      return Promise.resolve(nativeToScVal(42n, { type: "i128" }));
    });

    assertEquals(
      await token.allowance({
        from: owner.publicKey(),
        spender: spender.publicKey(),
      }),
      42n,
    );
    assertEquals(await token.balance({ id: owner.publicKey() }), 42n);
    assertEquals(calls.map(({ method }) => method), ["allowance", "balance"]);
    assertEquals(
      calls.map(({ methodArgs }) => methodArgs?.map(scValToNative)),
      [
        [owner.publicKey(), spender.publicKey()],
        [owner.publicKey()],
      ],
    );
  });

  it("raises a typed error when a required read returns no value", async () => {
    const token = createToken();
    replaceReadRaw(token, () => Promise.resolve(undefined));

    const error = await assertRejects(() =>
      token.balance({ id: owner.publicKey() })
    );
    assertInstanceOf(error, E.MISSING_RETURN_VALUE);
    assertEquals(error.code, E.Code.MISSING_RETURN_VALUE);
    assertEquals(error.meta?.data, { functionName: "balance" });
  });

  it("reads and memoizes the descriptive interface by default", async () => {
    const token = createToken();
    let calls = 0;
    replaceReadRaw(token, ({ method }) => {
      calls++;
      if (method === "decimals") {
        return Promise.resolve(nativeToScVal(7, { type: "u32" }));
      }
      return Promise.resolve(nativeToScVal(method.toUpperCase(), {
        type: "string",
      }));
    });

    assertEquals(await token.decimals(), 7);
    assertEquals(await token.decimals(), 7);
    assertEquals(await token.name(), "NAME");
    assertEquals(await token.name(), "NAME");
    assertEquals(await token.symbol(), "SYMBOL");
    assertEquals(await token.symbol(), "SYMBOL");
    assertEquals(calls, 3);
  });

  it("can disable descriptive-read memoization", async () => {
    const token = createToken({ cache: { enabled: false } });
    let calls = 0;
    replaceReadRaw(token, () => {
      calls++;
      return Promise.resolve(nativeToScVal(7, { type: "u32" }));
    });

    assertEquals(await token.decimals(), 7);
    assertEquals(await token.decimals(), 7);
    assertEquals(calls, 2);
  });

  it("encodes every state-changing SEP-41 method", async () => {
    const token = createToken();
    const calls: Parameters<InvokeRaw>[0][] = [];
    const response = {
      hash: "hash",
      returnValue: xdr.ScVal.scvVoid(),
      ledger: 12,
      createdAt: 34,
      response: {},
    } as Awaited<ReturnType<InvokeRaw>>;
    replaceInvokeRaw(token, (args) => {
      calls.push(args);
      return Promise.resolve(response);
    });
    const auth: xdr.SorobanAuthorizationEntry[] = [];

    const outputs = await Promise.all([
      token.approve({
        from: owner.publicKey(),
        spender: spender.publicKey(),
        amount: 50n,
        liveUntilLedger: 123,
        config,
        auth,
      }),
      token.transfer({
        from: owner.publicKey(),
        to: recipient.publicKey(),
        amount: 10n,
        config,
      }),
      token.transferFrom({
        spender: spender.publicKey(),
        from: owner.publicKey(),
        to: recipient.publicKey(),
        amount: 8n,
        config,
      }),
      token.burn({ from: owner.publicKey(), amount: 3n, config }),
      token.burnFrom({
        spender: spender.publicKey(),
        from: owner.publicKey(),
        amount: 2n,
        config,
      }),
    ]);

    assertEquals(
      calls.map(({ operationArgs }) => operationArgs.function),
      ["approve", "transfer", "transfer_from", "burn", "burn_from"],
    );
    assertEquals(
      calls.map(({ operationArgs }) => operationArgs.args.map(scValToNative)),
      [
        [owner.publicKey(), spender.publicKey(), 50n, 123],
        [owner.publicKey(), recipient.publicKey(), 10n],
        [spender.publicKey(), owner.publicKey(), recipient.publicKey(), 8n],
        [owner.publicKey(), 3n],
        [spender.publicKey(), owner.publicKey(), 2n],
      ],
    );
    assertStrictEquals(calls[0].operationArgs.auth, auth);
    assertEquals(outputs.map(({ returnValue }) => returnValue), [
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("encodes a muxed destination for transfer", async () => {
    const token = createToken();
    let destination: xdr.ScVal | undefined;
    replaceInvokeRaw(token, ({ operationArgs }) => {
      destination = operationArgs.args[1];
      return Promise.resolve({
        hash: "hash",
        returnValue: undefined,
        ledger: 12,
        createdAt: 34,
        response: {},
      } as Awaited<ReturnType<InvokeRaw>>);
    });
    const muxed = encodeMuxedAccountToAddress(
      encodeMuxedAccount(recipient.publicKey(), "42"),
    ) as MuxedAddress;

    await token.transfer({
      from: owner.publicKey(),
      to: muxed,
      amount: 10n,
      config,
    });

    assertEquals(destination?.type, "scvAddress");
    assertEquals(scValToNative(destination!), muxed);
  });

  it("maps every argument encoding occurrence to its unique typed error", async () => {
    const invalidAddress = "invalid-address" as ContractId;
    const overflowingI128 = 1n << 127n;
    const cases: ReadonlyArray<{
      code: E.Code;
      functionName: string;
      argumentName: string;
      stellarType: string;
      value: unknown;
      run(token: SEP41TokenContract): Promise<unknown>;
    }> = [
      {
        code: E.Code.FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_FROM,
        functionName: "allowance",
        argumentName: "from",
        stellarType: "address",
        value: invalidAddress,
        run: (token) =>
          token.allowance({
            from: invalidAddress,
            spender: spender.publicKey(),
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_SPENDER,
        functionName: "allowance",
        argumentName: "spender",
        stellarType: "address",
        value: invalidAddress,
        run: (token) =>
          token.allowance({
            from: owner.publicKey(),
            spender: invalidAddress,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_APPROVE_ARGUMENT_FROM,
        functionName: "approve",
        argumentName: "from",
        stellarType: "address",
        value: invalidAddress,
        run: (token) =>
          token.approve({
            from: invalidAddress,
            spender: spender.publicKey(),
            amount: 1n,
            liveUntilLedger: 1,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_APPROVE_ARGUMENT_SPENDER,
        functionName: "approve",
        argumentName: "spender",
        stellarType: "address",
        value: invalidAddress,
        run: (token) =>
          token.approve({
            from: owner.publicKey(),
            spender: invalidAddress,
            amount: 1n,
            liveUntilLedger: 1,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_APPROVE_ARGUMENT_AMOUNT,
        functionName: "approve",
        argumentName: "amount",
        stellarType: "i128",
        value: overflowingI128,
        run: (token) =>
          token.approve({
            from: owner.publicKey(),
            spender: spender.publicKey(),
            amount: overflowingI128,
            liveUntilLedger: 1,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_APPROVE_ARGUMENT_LIVE_UNTIL_LEDGER,
        functionName: "approve",
        argumentName: "liveUntilLedger",
        stellarType: "u32",
        value: -1,
        run: (token) =>
          token.approve({
            from: owner.publicKey(),
            spender: spender.publicKey(),
            amount: 1n,
            liveUntilLedger: -1,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_BALANCE_ARGUMENT_ID,
        functionName: "balance",
        argumentName: "id",
        stellarType: "address",
        value: invalidAddress,
        run: (token) => token.balance({ id: invalidAddress }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_TRANSFER_ARGUMENT_FROM,
        functionName: "transfer",
        argumentName: "from",
        stellarType: "address",
        value: invalidAddress,
        run: (token) =>
          token.transfer({
            from: invalidAddress,
            to: recipient.publicKey(),
            amount: 1n,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_TRANSFER_ARGUMENT_TO,
        functionName: "transfer",
        argumentName: "to",
        stellarType: "address",
        value: invalidAddress,
        run: (token) =>
          token.transfer({
            from: owner.publicKey(),
            to: invalidAddress,
            amount: 1n,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_TRANSFER_ARGUMENT_AMOUNT,
        functionName: "transfer",
        argumentName: "amount",
        stellarType: "i128",
        value: overflowingI128,
        run: (token) =>
          token.transfer({
            from: owner.publicKey(),
            to: recipient.publicKey(),
            amount: overflowingI128,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_SPENDER,
        functionName: "transfer_from",
        argumentName: "spender",
        stellarType: "address",
        value: invalidAddress,
        run: (token) =>
          token.transferFrom({
            spender: invalidAddress,
            from: owner.publicKey(),
            to: recipient.publicKey(),
            amount: 1n,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_FROM,
        functionName: "transfer_from",
        argumentName: "from",
        stellarType: "address",
        value: invalidAddress,
        run: (token) =>
          token.transferFrom({
            spender: spender.publicKey(),
            from: invalidAddress,
            to: recipient.publicKey(),
            amount: 1n,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_TO,
        functionName: "transfer_from",
        argumentName: "to",
        stellarType: "address",
        value: invalidAddress,
        run: (token) =>
          token.transferFrom({
            spender: spender.publicKey(),
            from: owner.publicKey(),
            to: invalidAddress,
            amount: 1n,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_AMOUNT,
        functionName: "transfer_from",
        argumentName: "amount",
        stellarType: "i128",
        value: overflowingI128,
        run: (token) =>
          token.transferFrom({
            spender: spender.publicKey(),
            from: owner.publicKey(),
            to: recipient.publicKey(),
            amount: overflowingI128,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_BURN_ARGUMENT_FROM,
        functionName: "burn",
        argumentName: "from",
        stellarType: "address",
        value: invalidAddress,
        run: (token) =>
          token.burn({ from: invalidAddress, amount: 1n, config }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_BURN_ARGUMENT_AMOUNT,
        functionName: "burn",
        argumentName: "amount",
        stellarType: "i128",
        value: overflowingI128,
        run: (token) =>
          token.burn({
            from: owner.publicKey(),
            amount: overflowingI128,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_SPENDER,
        functionName: "burn_from",
        argumentName: "spender",
        stellarType: "address",
        value: invalidAddress,
        run: (token) =>
          token.burnFrom({
            spender: invalidAddress,
            from: owner.publicKey(),
            amount: 1n,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_FROM,
        functionName: "burn_from",
        argumentName: "from",
        stellarType: "address",
        value: invalidAddress,
        run: (token) =>
          token.burnFrom({
            spender: spender.publicKey(),
            from: invalidAddress,
            amount: 1n,
            config,
          }),
      },
      {
        code: E.Code.FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_AMOUNT,
        functionName: "burn_from",
        argumentName: "amount",
        stellarType: "i128",
        value: overflowingI128,
        run: (token) =>
          token.burnFrom({
            spender: spender.publicKey(),
            from: owner.publicKey(),
            amount: overflowingI128,
            config,
          }),
      },
    ];

    for (const testCase of cases) {
      const error = await assertRejects(() => testCase.run(createToken()));
      assertInstanceOf(error, E.SEP41TokenError);
      assertEquals(error.code, testCase.code);
      assertStrictEquals(
        error.constructor,
        E.ERRORS_SEP41_TOKEN[testCase.code],
      );
      assertInstanceOf(error.meta?.cause, Error);
      assertEquals(error.meta?.data, {
        functionName: testCase.functionName,
        argumentName: testCase.argumentName,
        stellarType: testCase.stellarType,
        value: testCase.value,
      });
    }
  });
});
