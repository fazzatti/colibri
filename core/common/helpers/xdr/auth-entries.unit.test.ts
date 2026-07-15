// ...existing code...
import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "buffer";
import { Address, Keypair, nativeToScVal, xdr } from "stellar-sdk";
import {
  authEntryToParams,
  paramsToAuthEntries,
  paramsToAuthEntry,
  paramsToInvocation,
} from "@/common/helpers/xdr/auth-entries.ts";
import type {
  AuthEntryDelegateParams,
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
        nativeToScVal("hello", { type: "string" }).toXDR("base64"),
      );
      assertEquals(
        contractFn.args()[1].toXDR("base64"),
        nativeToScVal("42", { type: "string" }).toXDR("base64"),
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
        boolArg.toXDR("base64"),
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
              { value: true, type: "bool" },
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
      assertEquals(rootArgs[0], {
        value: true,
        type: "bool",
        xdr: nativeToScVal(true).toXDR("base64"),
      });
      assertEquals(rootArgs[1], {
        value: "token",
        type: "string",
        xdr: nativeToScVal("token", { type: "string" }).toXDR("base64"),
      });

      assertExists(roundTrip.rootInvocation.subInvocations);
      assertEquals(roundTrip.rootInvocation.subInvocations.length, 1);
      assertEquals(
        roundTrip.rootInvocation.subInvocations[0].function.functionName,
        "noop",
      );
    });

    it("round-trips ADDRESS_V2 credentials without changing the XDR arm", () => {
      const account = Address.fromString(Keypair.random().publicKey());
      const contract = Address.contract(Buffer.alloc(32, 4));
      const entry = new xdr.SorobanAuthorizationEntry({
        credentials: xdr.SorobanCredentials.sorobanCredentialsAddressV2(
          new xdr.SorobanAddressCredentials({
            address: account.toScAddress(),
            nonce: new xdr.Int64(77),
            signatureExpirationLedger: 321,
            signature: xdr.ScVal.scvU32(11),
          }),
        ),
        rootInvocation: new xdr.SorobanAuthorizedInvocation({
          function: xdr.SorobanAuthorizedFunction
            .sorobanAuthorizedFunctionTypeContractFn(
              new xdr.InvokeContractArgs({
                contractAddress: contract.toScAddress(),
                functionName: "v2",
                args: [xdr.ScVal.scvString("protocol-27")],
              }),
            ),
          subInvocations: [],
        }),
      });

      const params = authEntryToParams(entry);
      const rebuilt = paramsToAuthEntry(params);

      assertEquals(params.credentials.type, "addressV2");
      assertEquals(rebuilt.toXDR("base64"), entry.toXDR("base64"));
    });

    it("preserves exact XDR for nested and non-native ScVal arguments", () => {
      const account = Address.fromString(Keypair.random().publicKey());
      const contract = Address.contract(Buffer.alloc(32, 12));
      const args = [
        xdr.ScVal.scvVec([
          xdr.ScVal.scvU32(1),
          xdr.ScVal.scvI32(-2),
          xdr.ScVal.scvSymbol("mixed"),
        ]),
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("value"),
            val: xdr.ScVal.scvVec([xdr.ScVal.scvU32(3)]),
          }),
        ]),
        xdr.ScVal.scvError(xdr.ScError.sceContract(7)),
      ];
      const entry = new xdr.SorobanAuthorizationEntry({
        credentials: xdr.SorobanCredentials.sorobanCredentialsAddressV2(
          new xdr.SorobanAddressCredentials({
            address: account.toScAddress(),
            nonce: new xdr.Int64(91),
            signatureExpirationLedger: 777,
            signature: xdr.ScVal.scvVoid(),
          }),
        ),
        rootInvocation: new xdr.SorobanAuthorizedInvocation({
          function: xdr.SorobanAuthorizedFunction
            .sorobanAuthorizedFunctionTypeContractFn(
              new xdr.InvokeContractArgs({
                contractAddress: contract.toScAddress(),
                functionName: "inspect",
                args,
              }),
            ),
          subInvocations: [],
        }),
      });

      const params = authEntryToParams(entry);
      const parsedArgs = params.rootInvocation.function.args as FnArg[];
      const rebuilt = paramsToAuthEntry(params);

      assertEquals(
        parsedArgs.map((arg) => arg.xdr),
        args.map((arg) => arg.toXDR("base64")),
      );
      assertEquals(rebuilt.toXDR("base64"), entry.toXDR("base64"));
    });

    it("round-trips delegated and nested-delegate credentials exactly", () => {
      const account = Address.fromString(Keypair.random().publicKey());
      const delegate = Address.contract(Buffer.alloc(32, 5));
      const nestedDelegate = Address.fromString(Keypair.random().publicKey());
      const contract = Address.contract(Buffer.alloc(32, 6));
      const entry = new xdr.SorobanAuthorizationEntry({
        credentials: xdr.SorobanCredentials
          .sorobanCredentialsAddressWithDelegates(
            new xdr.SorobanAddressCredentialsWithDelegates({
              addressCredentials: new xdr.SorobanAddressCredentials({
                address: account.toScAddress(),
                nonce: new xdr.Int64(88),
                signatureExpirationLedger: 654,
                signature: xdr.ScVal.scvVoid(),
              }),
              delegates: [
                new xdr.SorobanDelegateSignature({
                  address: delegate.toScAddress(),
                  signature: xdr.ScVal.scvBytes(Buffer.from([1, 2, 3])),
                  nestedDelegates: [
                    new xdr.SorobanDelegateSignature({
                      address: nestedDelegate.toScAddress(),
                      signature: xdr.ScVal.scvU32(12),
                      nestedDelegates: [],
                    }),
                  ],
                }),
              ],
            }),
          ),
        rootInvocation: new xdr.SorobanAuthorizedInvocation({
          function: xdr.SorobanAuthorizedFunction
            .sorobanAuthorizedFunctionTypeContractFn(
              new xdr.InvokeContractArgs({
                contractAddress: contract.toScAddress(),
                functionName: "delegated",
                args: [],
              }),
            ),
          subInvocations: [],
        }),
      });

      const params = authEntryToParams(entry);
      const rebuilt = paramsToAuthEntry(params);

      assertEquals(params.credentials.type, "addressWithDelegates");
      if (params.credentials.type !== "addressWithDelegates") return;
      assertEquals(params.credentials.delegates.length, 1);
      assertEquals(params.credentials.delegates[0].nestedDelegates?.length, 1);
      assertEquals(rebuilt.toXDR("base64"), entry.toXDR("base64"));
    });

    it("sorts delegate arrays recursively by address XDR", () => {
      const account = Address.fromString(Keypair.random().publicKey());
      const contract = Address.contract(Buffer.alloc(32, 13));
      const topLow = Address.contract(Buffer.alloc(32, 1));
      const topHigh = Address.contract(Buffer.alloc(32, 3));
      const nestedLow = Address.contract(Buffer.alloc(32, 4));
      const nestedHigh = Address.contract(Buffer.alloc(32, 5));
      const params: AuthEntryParams = {
        credentials: {
          type: "addressWithDelegates",
          address: account.toString(),
          nonce: "1",
          signatureExpirationLedger: 100,
          delegates: [
            {
              address: topHigh.toString(),
              nestedDelegates: [
                { address: nestedHigh.toString() },
                { address: nestedLow.toString() },
              ],
            },
            { address: topLow.toString() },
          ],
        },
        rootInvocation: {
          function: {
            contractAddress: contract.toString(),
            functionName: "delegated",
            args: [],
          },
        },
      };

      const credentials = paramsToAuthEntry(params)
        .credentials().addressWithDelegates();
      const delegates = credentials.delegates();

      assertEquals(
        delegates.map((delegate) =>
          Address.fromScAddress(delegate.address()).toString()
        ),
        [topLow.toString(), topHigh.toString()],
      );
      assertEquals(
        delegates[1].nestedDelegates().map((delegate) =>
          Address.fromScAddress(delegate.address()).toString()
        ),
        [nestedLow.toString(), nestedHigh.toString()],
      );
    });

    it("rejects duplicate delegate addresses at every nesting level", () => {
      const account = Address.fromString(Keypair.random().publicKey());
      const contract = Address.contract(Buffer.alloc(32, 14));
      const delegate = Address.contract(Buffer.alloc(32, 6)).toString();
      const nested = Address.contract(Buffer.alloc(32, 7)).toString();
      const makeParams = (
        delegates: AuthEntryDelegateParams[],
      ): AuthEntryParams => ({
        credentials: {
          type: "addressWithDelegates",
          address: account.toString(),
          nonce: "1",
          signatureExpirationLedger: 100,
          delegates,
        },
        rootInvocation: {
          function: {
            contractAddress: contract.toString(),
            functionName: "delegated",
            args: [],
          },
        },
      });

      assertThrows(
        () =>
          paramsToAuthEntry(makeParams([
            { address: delegate },
            { address: delegate },
          ])),
        Error,
        "duplicate delegate address",
      );
      assertThrows(
        () =>
          paramsToAuthEntry(makeParams([{
            address: delegate,
            nestedDelegates: [
              { address: nested },
              { address: nested },
            ],
          }])),
        Error,
        "duplicate delegate address",
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
          }),
        ),
        rootInvocation: new xdr.SorobanAuthorizedInvocation({
          function: xdr.SorobanAuthorizedFunction
            .sorobanAuthorizedFunctionTypeContractFn(
              new xdr.InvokeContractArgs({
                contractAddress: contractAddr.toScAddress(),
                functionName: "inspect",
                args: [addressArg, i128Arg],
              }),
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
  });
});
