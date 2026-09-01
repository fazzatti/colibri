import { Address, nativeToScVal, scValToNative, xdr } from "stellar-sdk";
import type {
  AuthEntryParams,
  FnArg,
  InvocationParams,
} from "@/common/helpers/xdr/types.ts";
import { getAddressCredentialsFromAuthEntry } from "@/common/helpers/xdr/get-address-credentials-from-auth-entry.ts";
import {
  MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_PARAMS,
  UNSUPPORTED_AUTHORIZED_FUNCTION,
} from "@/common/helpers/xdr/error.ts";

const invocationToParams = (
  invocation: xdr.SorobanAuthorizedInvocation
): InvocationParams => {
  if (invocation.function.type !== "sorobanAuthorizedFunctionTypeContractFn") {
    throw new UNSUPPORTED_AUTHORIZED_FUNCTION(invocation.function.type);
  }
  const contractFn = invocation.function.contractFn;
  const args = contractFn.args;

  return {
    function: {
      contractAddress: Address.fromScAddress(
        contractFn.contractAddress
      ).toString(),
      functionName: contractFn.functionName.toString(),
      args: parseScValArgs(args),
    },
    subInvocations: [
      ...invocation.subInvocations.map(invocationToParams),
    ],
  };
};

export const paramsToInvocation = (
  params: InvocationParams
): xdr.SorobanAuthorizedInvocation => {
  const args = isScValArray(params.function.args)
    ? params.function.args
    : params.function.args.map(fnArgToScVal);

  return new xdr.SorobanAuthorizedInvocation({
    function:
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(
            params.function.contractAddress
          ).toScAddress(),
          functionName: params.function.functionName,
          args: args,
        })
      ),
    subInvocations: params.subInvocations?.map(paramsToInvocation) || [],
  });
};

export const authEntryToParams = (
  entry: xdr.SorobanAuthorizationEntry
): AuthEntryParams => {
  const credentials = getAddressCredentialsFromAuthEntry(entry);
  if (!credentials) {
    throw new MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_PARAMS();
  }

  const entryParams: AuthEntryParams = {
    credentials: {
      address: Address.fromScAddress(
        credentials.address
      ).toString(),
      nonce: credentials.nonce.toString(),
      signatureExpirationLedger: credentials.signatureExpirationLedger,
      signature: credentials.signature.toXdr("base64"),
    },
    rootInvocation: invocationToParams(entry.rootInvocation),
  };

  return entryParams;
};

const isScValArray = (
  args: FnArg[] | xdr.ScVal[]
): args is xdr.ScVal[] => {
  return args.length > 0 && xdr.ScVal.is(args[0]);
};

const fnArgToScVal = (arg: FnArg): xdr.ScVal => {
  if (arg.type === undefined) return nativeToScVal(arg.value);

  return nativeToScVal(arg.value, { type: arg.type });
};

const parseScValArgs = (args: xdr.ScVal[]): FnArg[] | xdr.ScVal[] => {
  const parsedArgs = args.map(parseScValArg);

  if (parsedArgs.every(isFnArg)) return parsedArgs;

  return args;
};

const isFnArg = (arg: FnArg | undefined): arg is FnArg => {
  return arg !== undefined;
};

const parseScValArg = (value: xdr.ScVal): FnArg | undefined => {
  const nativeValue = scValToNative(value);

  switch (value.type) {
    case "scvVoid":
    case "scvBool":
      return { value: nativeValue };
    case "scvU32":
      return { value: String(nativeValue), type: "u32" };
    case "scvI32":
      return { value: String(nativeValue), type: "i32" };
    case "scvU64":
      return { value: String(nativeValue), type: "u64" };
    case "scvI64":
      return { value: String(nativeValue), type: "i64" };
    case "scvU128":
      return { value: String(nativeValue), type: "u128" };
    case "scvAddress":
      return { value: String(nativeValue), type: "address" };
    case "scvI128":
      return { value: String(nativeValue), type: "i128" };
    case "scvU256":
      return { value: String(nativeValue), type: "u256" };
    case "scvI256":
      return { value: String(nativeValue), type: "i256" };
    case "scvTimepoint":
      return { value: String(nativeValue), type: "timepoint" };
    case "scvDuration":
      return { value: String(nativeValue), type: "duration" };
    case "scvBytes":
      return { value: nativeValue, type: "bytes" };
    case "scvString":
      return { value: nativeValue, type: "string" };
    case "scvSymbol":
      return { value: nativeValue, type: "symbol" };
    default:
      return undefined;
  }
};

export const paramsToAuthEntry = (
  param: AuthEntryParams
): xdr.SorobanAuthorizationEntry => {
  const credParams = param.credentials;

  return new xdr.SorobanAuthorizationEntry({
    rootInvocation: paramsToInvocation(param.rootInvocation),
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: Address.fromString(credParams.address).toScAddress(),
        nonce: xdr.Int64(credParams.nonce),
        signatureExpirationLedger: credParams.signatureExpirationLedger,
        signature: !credParams.signature
          ? xdr.ScVal.scvVoid()
          : xdr.ScVal.fromXdr(credParams.signature, "base64"),
      })
    ),
  });
};

export const paramsToAuthEntries = (
  authEntryParams: AuthEntryParams[]
): xdr.SorobanAuthorizationEntry[] => {
  return authEntryParams.map(paramsToAuthEntry);
};
