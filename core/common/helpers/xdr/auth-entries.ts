import { Address, nativeToScVal, scValToNative, xdr } from "stellar-sdk";
import type {
  AuthEntryParams,
  FnArg,
  InvocationParams,
} from "@/common/helpers/xdr/types.ts";
import {
  MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_PARAMS,
  UNSUPPORTED_AUTH_ENTRY_CREDENTIALS_FOR_PARAMS,
  UNSUPPORTED_AUTHORIZED_FUNCTION,
} from "@/common/helpers/xdr/error.ts";

const invocationToParams = (
  invocation: xdr.SorobanAuthorizedInvocation,
): InvocationParams => {
  if (invocation.function.type !== "sorobanAuthorizedFunctionTypeContractFn") {
    throw new UNSUPPORTED_AUTHORIZED_FUNCTION(invocation.function.type);
  }
  const contractFn = invocation.function.contractFn;
  const args = contractFn.args;

  return {
    function: {
      contractAddress: Address.fromScAddress(
        contractFn.contractAddress,
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
  params: InvocationParams,
): xdr.SorobanAuthorizedInvocation => {
  const args = isScValArray(params.function.args)
    ? params.function.args
    : params.function.args.map(fnArgToScVal);

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
  if (entry.credentials.type === "sorobanCredentialsSourceAccount") {
    throw new MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_PARAMS();
  }
  if (entry.credentials.type !== "sorobanCredentialsAddress") {
    throw new UNSUPPORTED_AUTH_ENTRY_CREDENTIALS_FOR_PARAMS(
      entry.credentials.type,
    );
  }
  const credentials = entry.credentials.address;

  const entryParams: AuthEntryParams = {
    credentials: {
      address: Address.fromScAddress(
        credentials.address,
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
  args: FnArg[] | xdr.ScVal[],
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
  if (value.type === "scvVoid" || value.type === "scvBool") {
    return { value: nativeValue };
  }

  const type = SCVAL_FN_ARG_TYPES.get(value.type);
  if (type === undefined) return;

  const parsedValue = STRINGIFIED_FN_ARG_TYPES.has(type)
    ? String(nativeValue)
    : nativeValue;
  return { value: parsedValue, type } as FnArg;
};

const SCVAL_FN_ARG_TYPES = new Map<string, NonNullable<FnArg["type"]>>([
  ["scvU32", "u32"],
  ["scvI32", "i32"],
  ["scvU64", "u64"],
  ["scvI64", "i64"],
  ["scvU128", "u128"],
  ["scvI128", "i128"],
  ["scvU256", "u256"],
  ["scvI256", "i256"],
  ["scvTimepoint", "timepoint"],
  ["scvDuration", "duration"],
  ["scvAddress", "address"],
  ["scvBytes", "bytes"],
  ["scvString", "string"],
  ["scvSymbol", "symbol"],
]);

const STRINGIFIED_FN_ARG_TYPES = new Set<NonNullable<FnArg["type"]>>([
  "u32",
  "i32",
  "u64",
  "i64",
  "u128",
  "i128",
  "u256",
  "i256",
  "timepoint",
  "duration",
  "address",
]);

export const paramsToAuthEntry = (
  param: AuthEntryParams,
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
      }),
    ),
  });
};

export const paramsToAuthEntries = (
  authEntryParams: AuthEntryParams[],
): xdr.SorobanAuthorizationEntry[] => {
  return authEntryParams.map(paramsToAuthEntry);
};
