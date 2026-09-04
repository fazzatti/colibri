import { xdr } from "stellar-sdk";
import {
  normalizeContractInterfaceType,
  normalizeContractUserType,
} from "@/contract/interface/normalize-contract-interface.ts";
import type {
  ContractInterfaceDefinition,
  ContractInterfaceFunction,
  ContractInterfaceTypeRequirement,
  ContractInterfaceUserType,
  ContractStandardProvider,
} from "@/contract/interface/types.ts";

type TypeInput = xdr.ScSpecTypeDef | ContractInterfaceTypeRequirement;
type FunctionInput = readonly [name: string, type: TypeInput];
type StructField = readonly [name: string, type: xdr.ScSpecTypeDef];
type UnionCase =
  | readonly [name: string]
  | readonly [name: string, types: readonly xdr.ScSpecTypeDef[]];
type EnumCase = readonly [name: string, value: number];

/** @internal */
export type StandardTypeFactory = {
  readonly val: xdr.ScSpecTypeDef;
  readonly bool: xdr.ScSpecTypeDef;
  readonly void: xdr.ScSpecTypeDef;
  readonly error: xdr.ScSpecTypeDef;
  readonly u32: xdr.ScSpecTypeDef;
  readonly i32: xdr.ScSpecTypeDef;
  readonly u64: xdr.ScSpecTypeDef;
  readonly i64: xdr.ScSpecTypeDef;
  readonly timepoint: xdr.ScSpecTypeDef;
  readonly duration: xdr.ScSpecTypeDef;
  readonly u128: xdr.ScSpecTypeDef;
  readonly i128: xdr.ScSpecTypeDef;
  readonly u256: xdr.ScSpecTypeDef;
  readonly i256: xdr.ScSpecTypeDef;
  readonly bytes: xdr.ScSpecTypeDef;
  readonly string: xdr.ScSpecTypeDef;
  readonly symbol: xdr.ScSpecTypeDef;
  readonly address: xdr.ScSpecTypeDef;
  readonly muxedAddress: xdr.ScSpecTypeDef;
  readonly option: (valueType: xdr.ScSpecTypeDef) => xdr.ScSpecTypeDef;
  readonly result: (
    okType: xdr.ScSpecTypeDef,
    errorType: xdr.ScSpecTypeDef,
  ) => xdr.ScSpecTypeDef;
  readonly vec: (elementType: xdr.ScSpecTypeDef) => xdr.ScSpecTypeDef;
  readonly map: (
    keyType: xdr.ScSpecTypeDef,
    valueType: xdr.ScSpecTypeDef,
  ) => xdr.ScSpecTypeDef;
  readonly tuple: (
    valueTypes: readonly xdr.ScSpecTypeDef[],
  ) => xdr.ScSpecTypeDef;
  readonly bytesN: (n: number) => xdr.ScSpecTypeDef;
  readonly udt: (name: string) => xdr.ScSpecTypeDef;
};

/** @internal */
export const types: StandardTypeFactory = {
  val: xdr.ScSpecTypeDef.scSpecTypeVal(),
  bool: xdr.ScSpecTypeDef.scSpecTypeBool(),
  void: xdr.ScSpecTypeDef.scSpecTypeVoid(),
  error: xdr.ScSpecTypeDef.scSpecTypeError(),
  u32: xdr.ScSpecTypeDef.scSpecTypeU32(),
  i32: xdr.ScSpecTypeDef.scSpecTypeI32(),
  u64: xdr.ScSpecTypeDef.scSpecTypeU64(),
  i64: xdr.ScSpecTypeDef.scSpecTypeI64(),
  timepoint: xdr.ScSpecTypeDef.scSpecTypeTimepoint(),
  duration: xdr.ScSpecTypeDef.scSpecTypeDuration(),
  u128: xdr.ScSpecTypeDef.scSpecTypeU128(),
  i128: xdr.ScSpecTypeDef.scSpecTypeI128(),
  u256: xdr.ScSpecTypeDef.scSpecTypeU256(),
  i256: xdr.ScSpecTypeDef.scSpecTypeI256(),
  bytes: xdr.ScSpecTypeDef.scSpecTypeBytes(),
  string: xdr.ScSpecTypeDef.scSpecTypeString(),
  symbol: xdr.ScSpecTypeDef.scSpecTypeSymbol(),
  address: xdr.ScSpecTypeDef.scSpecTypeAddress(),
  muxedAddress: xdr.ScSpecTypeDef.scSpecTypeMuxedAddress(),
  option: (valueType: xdr.ScSpecTypeDef): xdr.ScSpecTypeDef =>
    xdr.ScSpecTypeDef.scSpecTypeOption(
      new xdr.ScSpecTypeOption({ valueType }),
    ),
  result: (
    okType: xdr.ScSpecTypeDef,
    errorType: xdr.ScSpecTypeDef,
  ): xdr.ScSpecTypeDef =>
    xdr.ScSpecTypeDef.scSpecTypeResult(
      new xdr.ScSpecTypeResult({ okType, errorType }),
    ),
  vec: (elementType: xdr.ScSpecTypeDef): xdr.ScSpecTypeDef =>
    xdr.ScSpecTypeDef.scSpecTypeVec(
      new xdr.ScSpecTypeVec({ elementType }),
    ),
  map: (
    keyType: xdr.ScSpecTypeDef,
    valueType: xdr.ScSpecTypeDef,
  ): xdr.ScSpecTypeDef =>
    xdr.ScSpecTypeDef.scSpecTypeMap(
      new xdr.ScSpecTypeMap({ keyType, valueType }),
    ),
  tuple: (valueTypes: readonly xdr.ScSpecTypeDef[]): xdr.ScSpecTypeDef =>
    xdr.ScSpecTypeDef.scSpecTypeTuple(
      new xdr.ScSpecTypeTuple({ valueTypes: [...valueTypes] }),
    ),
  bytesN: (n: number): xdr.ScSpecTypeDef =>
    xdr.ScSpecTypeDef.scSpecTypeBytesN(new xdr.ScSpecTypeBytesN({ n })),
  udt: (name: string): xdr.ScSpecTypeDef =>
    xdr.ScSpecTypeDef.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name })),
} as const;

const requirement = (type: TypeInput): ContractInterfaceTypeRequirement =>
  "kind" in type
    ? type
    : { kind: "exact", type: normalizeContractInterfaceType(type) };

/** @internal */
export const typeVariable = (
  name: string,
  allowedTypes: readonly xdr.ScSpecTypeDef[],
): ContractInterfaceTypeRequirement => ({
  kind: "variable",
  name,
  allowedTypes: allowedTypes.map(normalizeContractInterfaceType),
});

/** @internal */
export const functionDefinition = (
  name: string,
  inputs: readonly FunctionInput[] = [],
  outputs: readonly TypeInput[] = [],
): ContractInterfaceFunction => ({
  name,
  inputs: inputs.map(([inputName, type]) => ({
    name: inputName,
    type: requirement(type),
  })),
  outputs: outputs.map(requirement),
});

const normalizedUserType = (
  entry: xdr.ScSpecEntry,
): ContractInterfaceUserType =>
  normalizeContractUserType(entry) as ContractInterfaceUserType;

/** @internal */
export const structDefinition = (
  name: string,
  fields: readonly StructField[],
): ContractInterfaceUserType =>
  normalizedUserType(
    xdr.ScSpecEntry.scSpecEntryUdtStructV0(
      new xdr.ScSpecUdtStructV0({
        doc: "",
        lib: "",
        name,
        fields: fields.map(([fieldName, type]) =>
          new xdr.ScSpecUdtStructFieldV0({
            doc: "",
            name: fieldName,
            type,
          })
        ),
      }),
    ),
  );

/** @internal */
export const unionDefinition = (
  name: string,
  cases: readonly UnionCase[],
): ContractInterfaceUserType =>
  normalizedUserType(
    xdr.ScSpecEntry.scSpecEntryUdtUnionV0(
      new xdr.ScSpecUdtUnionV0({
        doc: "",
        lib: "",
        name,
        cases: cases.map(([caseName, caseTypes]) =>
          caseTypes
            ? xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseTupleV0(
              new xdr.ScSpecUdtUnionCaseTupleV0({
                doc: "",
                name: caseName,
                type: [...caseTypes],
              }),
            )
            : xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseVoidV0(
              new xdr.ScSpecUdtUnionCaseVoidV0({
                doc: "",
                name: caseName,
              }),
            )
        ),
      }),
    ),
  );

/** @internal */
export const enumDefinition = (
  name: string,
  cases: readonly EnumCase[],
): ContractInterfaceUserType =>
  normalizedUserType(
    xdr.ScSpecEntry.scSpecEntryUdtEnumV0(
      new xdr.ScSpecUdtEnumV0({
        doc: "",
        lib: "",
        name,
        cases: cases.map(([caseName, value]) =>
          new xdr.ScSpecUdtEnumCaseV0({
            doc: "",
            name: caseName,
            value,
          })
        ),
      }),
    ),
  );

/** @internal */
export const interfaceDefinition = (
  id: string,
  name: string,
  functions: readonly ContractInterfaceFunction[],
  userTypes: readonly ContractInterfaceUserType[] = [],
): ContractInterfaceDefinition => ({
  id,
  name,
  functions,
  types: userTypes,
});

/** @internal */
export const standardProvider = (
  sep: number,
  version: string,
  contractInterface: ContractInterfaceDefinition,
): ContractStandardProvider => ({
  sep,
  version,
  interface: contractInterface,
});
