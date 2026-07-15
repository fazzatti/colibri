import { Address, nativeToScVal, scValToNative, xdr } from "stellar-sdk";
import type { NativeToScValOpts } from "stellar-sdk";
import { Buffer } from "buffer";
import type {
  AuthEntryCredentialsParams,
  AuthEntryDelegateParams,
  AuthEntryParams,
  FnArg,
  InvocationParams,
} from "@/common/helpers/xdr/types.ts";
import { getAddressCredentialsFromAuthEntry } from "@/common/helpers/xdr/get-address-credentials-from-auth-entry.ts";
import { getScValTypeName } from "@/common/helpers/xdr/scval.ts";

const invocationToParams = (
  invocation: xdr.SorobanAuthorizedInvocation,
): InvocationParams => {
  return {
    function: {
      contractAddress: Address.fromScAddress(
        invocation.function().contractFn().contractAddress(),
      ).toString(),
      functionName: invocation
        .function()
        .contractFn()
        .functionName()
        .toString(),
      args: invocation.function().contractFn().args().map(parseScVal),
    },
    subInvocations: [
      ...invocation
        .subInvocations()
        .map((subInvocation) => invocationToParams(subInvocation)),
    ],
  };
};

export const paramsToInvocation = (
  params: InvocationParams,
): xdr.SorobanAuthorizedInvocation => {
  let args;

  if (params.function.args.length > 0 && "type" in params.function.args[0]) {
    args = (params.function.args as FnArg[]).map(fnArgToScVal);
  } else {
    args = params.function.args as xdr.ScVal[];
  }

  return new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction
      .sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(
            params.function.contractAddress,
          ).toScAddress(),
          functionName: params.function.functionName,
          args: args,
        }),
      ),
    subInvocations: params.subInvocations?.map(paramsToInvocation) || [],
  });
};

export const authEntryToParams = (
  entry: xdr.SorobanAuthorizationEntry,
): AuthEntryParams => {
  const resolvedCredentials = getAddressCredentialsFromAuthEntry(entry);
  const credentials = resolvedCredentials.addressCredentials;
  const rootInvocation = entry.rootInvocation();

  const baseCredentials = {
    address: Address.fromScAddress(credentials.address()).toString(),
    nonce: credentials.nonce().toString(),
    signatureExpirationLedger: credentials.signatureExpirationLedger(),
    signature: credentials.signature().toXDR("base64"),
  };

  let credentialParams: AuthEntryCredentialsParams;
  switch (resolvedCredentials.type) {
    case "address":
      credentialParams = { ...baseCredentials, type: "address" };
      break;
    case "addressV2":
      credentialParams = { ...baseCredentials, type: "addressV2" };
      break;
    case "addressWithDelegates":
      credentialParams = {
        ...baseCredentials,
        type: "addressWithDelegates",
        delegates: resolvedCredentials.delegates.map(delegateToParams),
      };
      break;
  }

  const entryParams: AuthEntryParams = {
    credentials: credentialParams,
    rootInvocation: invocationToParams(rootInvocation),
  };

  return entryParams;
};

const parseScVal = (value: xdr.ScVal): FnArg => {
  const type = getScValTypeName(value);
  const nativeValue = scValToNative(value);
  return {
    value: type === "bool" || type === "bytes" || type === "vec" ||
        type === "map"
      ? nativeValue
      : String(nativeValue),
    type,
    xdr: value.toXDR("base64"),
  };
};

const fnArgToScVal = (arg: FnArg): xdr.ScVal => {
  if (arg.xdr) return xdr.ScVal.fromXDR(arg.xdr, "base64");

  if (arg.type === "void") return xdr.ScVal.scvVoid();

  if (
    arg.type === "bool" || arg.type === "vec" || arg.type === "map" ||
    arg.type === "error" || arg.type === "contractInstance" ||
    arg.type === "ledgerKeyContractInstance" || arg.type === "ledgerKeyNonce"
  ) {
    return nativeToScVal(arg.value);
  }

  return nativeToScVal(arg.value, {
    type: arg.type as NativeToScValOpts["type"],
  });
};

const delegateToParams = (
  delegate: xdr.SorobanDelegateSignature,
): AuthEntryDelegateParams => ({
  address: Address.fromScAddress(delegate.address()).toString(),
  signature: delegate.signature().toXDR("base64"),
  nestedDelegates: delegate.nestedDelegates().map(delegateToParams),
});

const paramsToDelegate = (
  delegate: AuthEntryDelegateParams,
): xdr.SorobanDelegateSignature =>
  new xdr.SorobanDelegateSignature({
    address: Address.fromString(delegate.address).toScAddress(),
    signature: delegate.signature
      ? xdr.ScVal.fromXDR(delegate.signature, "base64")
      : xdr.ScVal.scvVoid(),
    nestedDelegates: paramsToDelegates(delegate.nestedDelegates ?? []),
  });

const paramsToDelegates = (
  delegates: AuthEntryDelegateParams[],
): xdr.SorobanDelegateSignature[] => {
  const encoded = delegates.map(paramsToDelegate);

  encoded.sort((a, b) =>
    Buffer.compare(a.address().toXDR(), b.address().toXDR())
  );

  for (let i = 1; i < encoded.length; i++) {
    if (
      Buffer.compare(
        encoded[i - 1].address().toXDR(),
        encoded[i].address().toXDR(),
      ) === 0
    ) {
      throw new Error(
        `duplicate delegate address ${
          Address.fromScAddress(encoded[i].address()).toString()
        }`,
      );
    }
  }

  return encoded;
};

export const paramsToAuthEntry = (
  param: AuthEntryParams,
): xdr.SorobanAuthorizationEntry => {
  const credParams = param.credentials;

  const addressCredentials = new xdr.SorobanAddressCredentials({
    address: Address.fromString(credParams.address).toScAddress(),
    nonce: new xdr.Int64(credParams.nonce),
    signatureExpirationLedger: credParams.signatureExpirationLedger,
    signature: !credParams.signature
      ? xdr.ScVal.scvVoid()
      : xdr.ScVal.fromXDR(credParams.signature, "base64"),
  });

  let credentials: xdr.SorobanCredentials;
  if (credParams.type === "addressV2") {
    credentials = xdr.SorobanCredentials.sorobanCredentialsAddressV2(
      addressCredentials,
    );
  } else if (credParams.type === "addressWithDelegates") {
    credentials = xdr.SorobanCredentials.sorobanCredentialsAddressWithDelegates(
      new xdr.SorobanAddressCredentialsWithDelegates({
        addressCredentials,
        delegates: paramsToDelegates(credParams.delegates),
      }),
    );
  } else {
    credentials = xdr.SorobanCredentials.sorobanCredentialsAddress(
      addressCredentials,
    );
  }

  return new xdr.SorobanAuthorizationEntry({
    rootInvocation: paramsToInvocation(param.rootInvocation),
    credentials,
  });
};

export const paramsToAuthEntries = (
  authEntryParams: AuthEntryParams[],
): xdr.SorobanAuthorizationEntry[] => {
  return authEntryParams.map(paramsToAuthEntry);
};
