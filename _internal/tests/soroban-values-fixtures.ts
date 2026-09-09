import { xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import { errorEntry } from "./binding-fixtures.ts";

export const udt = (name: string): xdr.ScSpecTypeDef =>
  xdr.ScSpecTypeDef.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name }));
export const option = (valueType: xdr.ScSpecTypeDef): xdr.ScSpecTypeDef =>
  xdr.ScSpecTypeDef.scSpecTypeOption(new xdr.ScSpecTypeOption({ valueType }));
export function struct(
  name: string,
  fields: Record<string, xdr.ScSpecTypeDef>,
): xdr.ScSpecEntry {
  return xdr.ScSpecEntry.scSpecEntryUdtStructV0(
    new xdr.ScSpecUdtStructV0({
      name,
      doc: "",
      lib: "",
      fields: Object.entries(fields).sort(([a], [b]) => a < b ? -1 : 1).map((
        [name, type],
      ) => new xdr.ScSpecUdtStructFieldV0({ name, type, doc: "" })),
    }),
  );
}
export function func(
  name: string,
  inputs: Record<string, xdr.ScSpecTypeDef>,
  outputs: xdr.ScSpecTypeDef[] = [],
): xdr.ScSpecEntry {
  return xdr.ScSpecEntry.scSpecEntryFunctionV0(
    new xdr.ScSpecFunctionV0({
      name,
      doc: "",
      inputs: Object.entries(inputs).map(([name, type]) =>
        new xdr.ScSpecFunctionInputV0({ name, type, doc: "" })
      ),
      outputs,
    }),
  );
}
export function union(
  name: string,
  cases: Record<string, xdr.ScSpecTypeDef[] | null>,
): xdr.ScSpecEntry {
  return xdr.ScSpecEntry.scSpecEntryUdtUnionV0(
    new xdr.ScSpecUdtUnionV0({
      name,
      lib: "",
      doc: "",
      cases: Object.entries(cases).map(([name, type]) =>
        type === null
          ? xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseVoidV0(
            new xdr.ScSpecUdtUnionCaseVoidV0({ name, doc: "" }),
          )
          : xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseTupleV0(
            new xdr.ScSpecUdtUnionCaseTupleV0({ name, doc: "", type }),
          )
      ),
    }),
  );
}
export function valueSpec(): Spec {
  const strings = xdr.ScSpecTypeDef.scSpecTypeVec(
    new xdr.ScSpecTypeVec({
      elementType: xdr.ScSpecTypeDef.scSpecTypeString(),
    }),
  );
  return new Spec([
    func("texts", { values: strings }, [strings]),
    union("RbacStorage", {
      ExistingRoles: null,
      RoleIndexToAccount: [
        xdr.ScSpecTypeDef.scSpecTypeSymbol(),
        xdr.ScSpecTypeDef.scSpecTypeU32(),
      ],
      RoleAccountToIndex: [
        xdr.ScSpecTypeDef.scSpecTypeSymbol(),
        xdr.ScSpecTypeDef.scSpecTypeAddress(),
      ],
      EmptyTuple: [],
    }),
    struct("Config", {
      role: xdr.ScSpecTypeDef.scSpecTypeSymbol(),
      count: xdr.ScSpecTypeDef.scSpecTypeU32(),
      key: udt("RbacStorage"),
    }),
    struct("Pair", {
      "0": xdr.ScSpecTypeDef.scSpecTypeSymbol(),
      "1": xdr.ScSpecTypeDef.scSpecTypeU32(),
    }),
    struct("Node", {
      next: option(udt("Node")),
      value: xdr.ScSpecTypeDef.scSpecTypeU32(),
    }),
    errorEntry("AccessError"),
    func("echo", { config: udt("Config") }, [udt("Config")]),
    func("__constructor", { config: udt("Config") }),
  ]);
}
