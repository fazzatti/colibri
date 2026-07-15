// ...existing code...
import { assert, assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Address, Keypair, nativeToScVal, xdr } from "stellar-sdk";
import {
  paramsToInvocation,
  authEntryToParams,
  paramsToAuthEntry,
  paramsToAuthEntries,
} from "@/common/helpers/xdr/auth-entries.ts";
import type {
  AuthEntryParams,
  FnArg,
  InvocationParams,
} from "@/common/helpers/xdr/types.ts";

describe("Auth entry helpers", () => {
  describe("paramsToInvocation", () => {
    it("converts FnArg definitions into SorobanAuthorizedInvocation", () => {
      const kp = Keypair.random();
      const params: InvocationParams = {
        function: {
          contractAddress: Address.fromString(kp.publicKey()).toString(),
          functionName: "echo",
          args: [
            { value: "hello", type: "string" },
            { value: "42", type: "string" },
          ],
        },
      };

      const invocation = paramsToInvocation(params);

      const contractFn = invocation.function().contractFn();
      assertEquals(contractFn.functionName(), "echo");
      assertEquals(
        contractFn.args()[0].toXDR("base64"),
        nativeToScVal("hello", { type: "string" }).toXDR("base64")
      );
      assertEquals(
        contractFn.args()[1].toXDR("base64"),
        nativeToScVal("42", { type: "string" }).toXDR("base64")
      );
    });

    it("honors pre-built ScVal arguments", () => {
      const kp = Keypair.random();
      const boolArg = xdr.ScVal.scvBool(true);

      const params: InvocationParams = {
        function: {
          contractAddress: Address.fromString(kp.publicKey()).toString(),
          functionName: "flag",
          args: [boolArg],
        },
        subInvocations: [],
      };

      const invocation = paramsToInvocation(params);
      const contractFn = invocation.function().contractFn();

      assertEquals(contractFn.args().length, 1);
      assertEquals(
        contractFn.args()[0].toXDR("base64"),
        boolArg.toXDR("base64")
      );
      assertEquals(invocation.subInvocations().length, 0);
    });
  });

  describe("Auth entry param conversion", () => {
    it("round-trips AuthEntryParams through paramsToAuthEntry and back", () => {
      const kp = Keypair.random();
      const contractAddress = Address.fromString(kp.publicKey()).toString();
      const signature = xdr.ScVal.scvU32(7).toXDR("base64");

      const params: AuthEntryParams = {
        credentials: {
          address: contractAddress,
          nonce: "9",
          signatureExpirationLedger: 123,
          signature,
        },
        rootInvocation: {
          function: {
            contractAddress,
            functionName: "toggle",
            args: [
              { value: true },
              { value: "token", type: "string" },
            ],
          },
          subInvocations: [
            {
              function: {
                contractAddress,
                functionName: "noop",
                args: [],
              },
            },
          ],
        },
      };

      const entry = paramsToAuthEntry(params);
      const roundTrip = authEntryToParams(entry);

      assertEquals(roundTrip.credentials.address, contractAddress);
      assertEquals(roundTrip.credentials.nonce, "9");
      assertEquals(roundTrip.credentials.signatureExpirationLedger, 123);
      assertEquals(roundTrip.credentials.signature, signature);

      const rootArgs = roundTrip.rootInvocation.function.args;
      assert(Array.isArray(rootArgs));
      assertEquals(rootArgs.length, 2);
      assertEquals(rootArgs[0], { value: true });
      assertEquals(rootArgs[1], { value: "token", type: "string" });

      const rebuiltEntry = paramsToAuthEntry(roundTrip);
      assertEquals(
        rebuiltEntry.toXDR("base64"),
        entry.toXDR("base64")
      );

      assertExists(roundTrip.rootInvocation.subInvocations);
      assertEquals(roundTrip.rootInvocation.subInvocations.length, 1);
      assertEquals(
        roundTrip.rootInvocation.subInvocations[0].function.functionName,
        "noop"
      );
    });

    it("maps multiple params with paramsToAuthEntries", () => {
      const kp = Keypair.random();
      const address = Address.fromString(kp.publicKey()).toString();

      const paramsList: AuthEntryParams[] = [
        {
          credentials: {
            address,
            nonce: "1",
            signatureExpirationLedger: 10,
            signature: undefined,
          },
          rootInvocation: {
            function: {
              contractAddress: address,
              functionName: "a",
              args: [],
            },
          },
        },
        {
          credentials: {
            address,
            nonce: "2",
            signatureExpirationLedger: 20,
            signature: undefined,
          },
          rootInvocation: {
            function: {
              contractAddress: address,
              functionName: "b",
              args: [],
            },
          },
        },
      ];

      const entries = paramsToAuthEntries(paramsList);

      assertEquals(entries.length, 2);
      const roundTrip = entries.map(authEntryToParams);
      assertEquals(roundTrip[0].credentials.nonce, "1");
      assertEquals(roundTrip[1].credentials.nonce, "2");
    });

    it("parses scvAddress and scvI128 argument types", () => {
      const kp = Keypair.random();
      const addr = Address.fromString(kp.publicKey());
      const contractAddr = Address.fromString(Keypair.random().publicKey());

      const addressArg = xdr.ScVal.scvAddress(addr.toScAddress());
      const i128Arg = nativeToScVal("1", { type: "i128" });

      const authEntry = new xdr.SorobanAuthorizationEntry({
        credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
          new xdr.SorobanAddressCredentials({
            address: addr.toScAddress(),
            nonce: new xdr.Int64(0),
            signatureExpirationLedger: 0,
            signature: xdr.ScVal.scvVoid(),
          })
        ),
        rootInvocation: new xdr.SorobanAuthorizedInvocation({
          function:
            xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
              new xdr.InvokeContractArgs({
                contractAddress: contractAddr.toScAddress(),
                functionName: "inspect",
                args: [addressArg, i128Arg],
              })
            ),
          subInvocations: [],
        }),
      });

      const params = authEntryToParams(authEntry);
      const args = params.rootInvocation.function.args as FnArg[];

      assertEquals(args.length, 2);
      assertEquals(args[0].type, "address");
      assertEquals(args[1].type, "i128");
    });

    it("round-trips every supported scalar argument type", () => {
      const signer = Address.fromString(Keypair.random().publicKey());
      const contract = Address.fromString(Keypair.random().publicKey());
      const scalarArgs = [
        xdr.ScVal.scvVoid(),
        nativeToScVal(false),
        nativeToScVal("1", { type: "u32" }),
        nativeToScVal("-1", { type: "i32" }),
        nativeToScVal("2", { type: "u64" }),
        nativeToScVal("-2", { type: "i64" }),
        nativeToScVal("3", { type: "u128" }),
        nativeToScVal(signer.toString(), { type: "address" }),
        nativeToScVal("-3", { type: "i128" }),
        nativeToScVal("4", { type: "u256" }),
        nativeToScVal("-4", { type: "i256" }),
        nativeToScVal("5", { type: "timepoint" }),
        nativeToScVal("6", { type: "duration" }),
        nativeToScVal(new Uint8Array([1, 2]), { type: "bytes" }),
        nativeToScVal("text", { type: "string" }),
        nativeToScVal("symbol", { type: "symbol" }),
      ];

      const authEntry = new xdr.SorobanAuthorizationEntry({
        credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
          new xdr.SorobanAddressCredentials({
            address: signer.toScAddress(),
            nonce: new xdr.Int64(0),
            signatureExpirationLedger: 0,
            signature: xdr.ScVal.scvVoid(),
          }),
        ),
        rootInvocation: new xdr.SorobanAuthorizedInvocation({
          function:
            xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
              new xdr.InvokeContractArgs({
                contractAddress: contract.toScAddress(),
                functionName: "inspect",
                args: scalarArgs,
              }),
            ),
          subInvocations: [],
        }),
      });

      const params = authEntryToParams(authEntry);
      const args = params.rootInvocation.function.args as FnArg[];

      assertEquals(
        args.map((arg) => arg.type),
        [
          undefined,
          undefined,
          "u32",
          "i32",
          "u64",
          "i64",
          "u128",
          "address",
          "i128",
          "u256",
          "i256",
          "timepoint",
          "duration",
          "bytes",
          "string",
          "symbol",
        ],
      );
      assertEquals(
        paramsToAuthEntry(params).toXDR("base64"),
        authEntry.toXDR("base64"),
      );
    });

    it("preserves complex arguments as pre-built ScVals", () => {
      const signer = Address.fromString(Keypair.random().publicKey());
      const contract = Address.fromString(Keypair.random().publicKey());
      const vectorArg = nativeToScVal(
        ["token", "1"],
        { type: ["string", "i128"] }
      );

      const authEntry = new xdr.SorobanAuthorizationEntry({
        credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
          new xdr.SorobanAddressCredentials({
            address: signer.toScAddress(),
            nonce: new xdr.Int64(0),
            signatureExpirationLedger: 0,
            signature: xdr.ScVal.scvVoid(),
          })
        ),
        rootInvocation: new xdr.SorobanAuthorizedInvocation({
          function:
            xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
              new xdr.InvokeContractArgs({
                contractAddress: contract.toScAddress(),
                functionName: "inspect",
                args: [vectorArg],
              })
            ),
          subInvocations: [],
        }),
      });

      const params = authEntryToParams(authEntry);
      const args = params.rootInvocation.function.args;

      assert(args[0] instanceof xdr.ScVal);
      assertEquals(
        paramsToAuthEntry(params).toXDR("base64"),
        authEntry.toXDR("base64")
      );
    });
  });
});
