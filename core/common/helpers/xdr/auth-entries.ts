import { Address, nativeToScVal, scValToNative, xdr } from "stellar-sdk";
import type {
  AuthEntryParams,
  FnArg,
  InvocationParams,
} from "@/common/helpers/xdr/types.ts";

const invocationToParams = (
  invocation: xdr.SorobanAuthorizedInvocation
): InvocationParams => {
  const args = invocation.function().contractFn().args();

  return {
    function: {
      contractAddress: Address.fromScAddress(
        invocation.function().contractFn().contractAddress()
      ).toString(),
      functionName: invocation
        .function()
        .contractFn()
        .functionName()
        .toString(),
      args: parseScValArgs(args),
    },
    subInvocations: [
      ...invocation
        .subInvocations()
        .map((subInvocation) => invocationToParams(subInvocation)),
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
  const credentials = entry.credentials();
  const rootInvocation = entry.rootInvocation();

  const entryParams: AuthEntryParams = {
    credentials: {
      address: Address.fromScAddress(
        credentials.address().address()
      ).toString(),
      nonce: credentials.address().nonce().toString(),
      signatureExpirationLedger: credentials
        .address()
        .signatureExpirationLedger(),
      signature: credentials.address().signature().toXDR("base64"),
    },
    rootInvocation: invocationToParams(rootInvocation),
  };

  return entryParams;
};

const isScValArray = (
  args: FnArg[] | xdr.ScVal[]
): args is xdr.ScVal[] => {
  return args.length > 0 && args[0] instanceof xdr.ScVal;
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

  switch (value.switch().name) {
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
        nonce: new xdr.Int64(credParams.nonce),
        signatureExpirationLedger: credParams.signatureExpirationLedger,
        signature: !credParams.signature
          ? xdr.ScVal.scvVoid()
          : xdr.ScVal.fromXDR(credParams.signature, "base64"),
      })
    ),
  });
};

export const paramsToAuthEntries = (
  authEntryParams: AuthEntryParams[]
): xdr.SorobanAuthorizationEntry[] => {
  return authEntryParams.map(paramsToAuthEntry);
};
