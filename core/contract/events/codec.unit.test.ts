import { assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Spec } from "stellar-sdk/contract";
import { xdr } from "stellar-sdk";
import { validateEventValue } from "@/contract/events/codec.ts";
import { INVALID_SPEC } from "@/contract/events/error.ts";

const u32 = xdr.ScSpecTypeDef.scSpecTypeU32();
const field = (name: string) =>
  new xdr.ScSpecUdtStructFieldV0({ name, doc: "", type: u32 });
const spec = new Spec([
  xdr.ScSpecEntry.scSpecEntryUdtStructV0(
    new xdr.ScSpecUdtStructV0({
      name: "Named",
      doc: "",
      lib: "",
      fields: [field("x")],
    }),
  ),
  xdr.ScSpecEntry.scSpecEntryUdtStructV0(
    new xdr.ScSpecUdtStructV0({
      name: "Tuple",
      doc: "",
      lib: "",
      fields: [field("0")],
    }),
  ),
  xdr.ScSpecEntry.scSpecEntryUdtUnionV0(
    new xdr.ScSpecUdtUnionV0({
      name: "Union",
      doc: "",
      lib: "",
      cases: [
        xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseVoidV0(
          new xdr.ScSpecUdtUnionCaseVoidV0({ name: "Empty", doc: "" }),
        ),
        xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseTupleV0(
          new xdr.ScSpecUdtUnionCaseTupleV0({
            name: "Value",
            doc: "",
            type: [u32],
          }),
        ),
      ],
    }),
  ),
  xdr.ScSpecEntry.scSpecEntryUdtEnumV0(
    new xdr.ScSpecUdtEnumV0({
      name: "Enum",
      doc: "",
      lib: "",
      cases: [
        new xdr.ScSpecUdtEnumCaseV0({ name: "First", doc: "", value: 1 }),
      ],
    }),
  ),
  xdr.ScSpecEntry.scSpecEntryUdtErrorEnumV0(
    new xdr.ScSpecUdtErrorEnumV0({
      name: "Error",
      doc: "",
      lib: "",
      cases: [
        new xdr.ScSpecUdtErrorEnumCaseV0({
          name: "Failure",
          doc: "",
          value: 1,
        }),
      ],
    }),
  ),
]);
const udt = (name: string) =>
  xdr.ScSpecTypeDef.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name }));
const vec = (...values: xdr.ScVal[]) => xdr.ScVal.scvVec(values);
const sym = (name: string) => xdr.ScVal.scvSymbol(name);
const map = (key: string, value: xdr.ScVal) =>
  xdr.ScVal.scvMap([new xdr.ScMapEntry({ key: sym(key), val: value })]);

describe("event user-type validation", () => {
  it("accepts exact named/tuple structs, tagged unions and declared enums", () => {
    for (
      const [name, value] of [
        ["Named", map("x", xdr.ScVal.scvU32(1))],
        ["Tuple", vec(xdr.ScVal.scvU32(1))],
        ["Union", vec(sym("Empty"))],
        ["Union", vec(sym("Value"), xdr.ScVal.scvU32(1))],
        ["Enum", xdr.ScVal.scvU32(1)],
      ] as const
    ) validateEventValue(spec, value, udt(name));
  });
  it("rejects missing/wrong struct keys and unknown or malformed union/enum values", () => {
    for (
      const [name, value] of [
        ["Named", xdr.ScVal.scvMap([])],
        ["Named", map("wrong", xdr.ScVal.scvU32(1))],
        ["Named", xdr.ScVal.scvU32(1)],
        ["Tuple", vec()],
        ["Union", vec()],
        ["Union", vec(xdr.ScVal.scvU32(1))],
        ["Union", vec(sym("Unknown"))],
        ["Union", vec(sym("Value"))],
        ["Union", vec(sym("Empty"), xdr.ScVal.scvU32(1))],
        ["Enum", sym("First")],
        ["Enum", xdr.ScVal.scvU32(2)],
        ["Error", xdr.ScVal.scvU32(1)],
      ] as const
    ) {
      assertThrows(
        () => validateEventValue(spec, value, udt(name)),
        INVALID_SPEC,
      );
    }
  });
  it("checks present Options and fixed byte arrays and validates nested Result success shapes", () => {
    validateEventValue(
      spec,
      xdr.ScVal.scvU32(1),
      xdr.ScSpecTypeDef.scSpecTypeOption(
        new xdr.ScSpecTypeOption({ valueType: u32 }),
      ),
    );
    validateEventValue(
      spec,
      xdr.ScVal.scvBytes(new Uint8Array(3)),
      xdr.ScSpecTypeDef.scSpecTypeBytesN(new xdr.ScSpecTypeBytesN({ n: 3 })),
    );
    const result = xdr.ScSpecTypeDef.scSpecTypeResult(
      new xdr.ScSpecTypeResult({
        okType: u32,
        errorType: xdr.ScSpecTypeDef.scSpecTypeError(),
      }),
    );
    validateEventValue(spec, xdr.ScVal.scvU32(1), result);
    validateEventValue(
      spec,
      xdr.ScVal.scvError(xdr.ScError.sceContract(1)),
      result,
    );
  });
});
