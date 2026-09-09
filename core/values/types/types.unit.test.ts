import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import * as SorobanType from "@/values/types/index.ts";
import { SorobanValueError } from "@/values/error.ts";
import { Spec } from "@/contract/spec.ts";
import * as xdr from "stellar-sdk/xdr";
import { valueSpec } from "colibri-internal/tests/soroban-values-fixtures.ts";

type RbacStorage = SorobanType.Custom<{
  kind: "enum";
  encoding: "tagged";
  variants: {
    ExistingRoles: SorobanType.Void;
    RoleIndexToAccount: [SorobanType.Symbol, SorobanType.U32];
    RoleAccountToIndex: [SorobanType.Symbol, SorobanType.Address];
    EmptyTuple: [];
  };
}>;
type Config = SorobanType.Custom<{
  kind: "struct";
  fields: {
    count: SorobanType.U32;
    key: RbacStorage;
    role: SorobanType.Symbol;
  };
}>;
type Node = SorobanType.Custom<{
  kind: "struct";
  fields: { next: SorobanType.Option<Node>; value: SorobanType.U32 };
}>;

describe("SorobanType schema declarations", () => {
  it("preserves numeric enum codes and applies ordering only to map keys", () => {
    type Status = SorobanType.Custom<{
      kind: "enum";
      encoding: "u32";
      variants: { Closed: 20; Pending: 1; Active: 10 };
    }>;
    const entry = (cases: Record<string, number>) =>
      xdr.ScSpecEntry.scSpecEntryUdtEnumV0(
        new xdr.ScSpecUdtEnumV0({
          name: "Status",
          lib: "",
          doc: "",
          cases: Object.entries(cases).map(([name, value]) =>
            new xdr.ScSpecUdtEnumCaseV0({ name, value, doc: "" })
          ),
        }),
      );
    const status = SorobanType.Custom.fromSpec<Status>(
      () => new Spec([entry({ Closed: 20, Pending: 1, Active: 10 })]),
      "Status",
    );
    assertEquals([status.Closed, status.Pending, status.Active], [20, 1, 10]);
    const literal: 10 = status.Active;
    assertEquals(status.from(literal).toScVal().value, 10);
    assertEquals(status.fromScVal(xdr.ScVal.scvU32(20)).value, 20);
    const map = SorobanType.Map(status.type, SorobanType.Symbol).from([
      [status.Closed, "closed"],
      [status.Pending, "pending"],
      [status.Active, "active"],
    ]);
    assertEquals(map.value, [[1, "pending"], [10, "active"], [20, "closed"]]);
    assertThrows(
      () => status.fromScVal(xdr.ScVal.scvU32(2)),
      SorobanValueError,
    );
    assertThrows(() => status.from(-1 as Status), SorobanValueError);
    for (
      const cases of [{ A: 1, B: 1 }, { from: 1 }] as Record<string, number>[]
    ) {
      assertThrows(
        () =>
          SorobanType.Custom.fromSpec<Status>(
            () => new Spec([entry(cases)]),
            "Status",
          ),
        SorobanValueError,
      );
    }
    assertThrows(
      () => SorobanType.Custom.fromSpec(valueSpec, "Absent"),
      SorobanValueError,
    );
    function negativeTypes() {
      // @ts-expect-error Undeclared numeric enum codes are not inputs.
      status.from(2);
      // @ts-expect-error Numeric enum members remain readonly.
      status.Active = 3;
    }
    void negativeTypes;
  });
  it("derives raw and wrapped inputs without changing their decoded representation", () => {
    const key = SorobanType.Custom.fromSpec<RbacStorage>(
      valueSpec,
      "RbacStorage",
    );
    const config = SorobanType.Custom.fromSpec<Config>(valueSpec, "Config");
    const wrapped = config.from({
      count: SorobanType.U32.from(7),
      key: key.RoleIndexToAccount(SorobanType.Symbol.from("ADMIN"), 7),
      role: "ADMIN",
    });
    const plain: Config = {
      count: 7,
      role: "ADMIN",
      key: { tag: "RoleIndexToAccount", values: ["ADMIN", 7] },
    };
    assertEquals(wrapped.value, plain);
    assertEquals(config.fromScVal(wrapped.toScVal()).value, plain);
    assertEquals(Object.getOwnPropertySymbols(wrapped.value), []);
    assertEquals(key.ExistingRoles().value, { tag: "ExistingRoles" });
    assertEquals(key.EmptyTuple().value, { tag: "EmptyTuple", values: [] });
    assertThrows(() => config.from({ ...plain, count: -1 }), SorobanValueError);
    function negativeTypes() {
      // @ts-expect-error String and Symbol wrappers retain distinct encodings.
      key.RoleIndexToAccount(SorobanType.String.from("ADMIN"), 7);
      // @ts-expect-error Positional fields retain their exact arity.
      key.RoleIndexToAccount("ADMIN");
      // @ts-expect-error Wrapped outputs do not replace plain decoded fields.
      const invalid: { count: { value: number } } = wrapped.value;
      void invalid;
    }
    void negativeTypes;
  });
  it("supports recursive custom schemas and composed input metadata", () => {
    const node = SorobanType.Custom.fromSpec<Node>(valueSpec, "Node");
    const wrapped = node.from({
      next: { next: null, value: SorobanType.U32.from(2) },
      value: 1,
    });
    assertEquals(wrapped.value, { next: { next: null, value: 2 }, value: 1 });
    const vectors: SorobanType.Input.Value<
      SorobanType.Vec<SorobanType.Symbol>
    > = [SorobanType.Symbol.from("A")];
    const maps: SorobanType.Input.Value<
      SorobanType.Map<SorobanType.Symbol, SorobanType.U32>
    > = new Map([[SorobanType.Symbol.from("A"), 1]]);
    const optional: SorobanType.Input.Value<
      SorobanType.Option<SorobanType.U32>
    > = SorobanType.Option(SorobanType.U32).from(1);
    const optionalSymbol: SorobanType.Input.Value<
      SorobanType.Option<SorobanType.Symbol>
    > = "A";
    assertEquals(SorobanType.Vec(SorobanType.Symbol).from(vectors).value, [
      "A",
    ]);
    assertEquals(
      SorobanType.Map(SorobanType.Symbol, SorobanType.U32).from(maps).value,
      [["A", 1]],
    );
    assertEquals(optional.value, 1);
    assertEquals(optionalSymbol, "A");
    // A dynamically decoded Val must not acquire an object-only constraint.
    const anyOption: SorobanType.Option<SorobanType.Val> = "A";
    const anyOptionInput: SorobanType.Input.Value<
      SorobanType.Option<SorobanType.Val>
    > = 7;
    assertEquals(anyOption, "A");
    assertEquals(anyOptionInput, 7);
    function negativeEmptyTypes() {
      type Empty = SorobanType.Custom<{
        kind: "struct";
        fields: Record<string, never>;
      }>;
      // @ts-expect-error An empty struct accepts no extra fields, including undefined.
      const invalid: SorobanType.Input.Custom<Empty> = { extra: undefined };
      void invalid;
    }
    void negativeEmptyTypes;
    const tuple: SorobanType.Input.Value<
      SorobanType.Tuple<[SorobanType.Symbol, SorobanType.U32]>
    > = [SorobanType.Symbol.from("A"), SorobanType.U32.from(7)];
    assertEquals(
      SorobanType.Tuple([SorobanType.Symbol, SorobanType.U32] as const)
        .from(tuple).value,
      ["A", 7],
    );
    const voidInput: SorobanType.Input.Value<SorobanType.Void> = SorobanType
      .Void.from(null);
    assertEquals(voidInput.value, null);
    const fixed: SorobanType.Input.Value<SorobanType.BytesN<2>> = SorobanType
      .BytesN(2).from(new Uint8Array([1, 2]));
    assertEquals(fixed.value, new Uint8Array([1, 2]));
    const result: SorobanType.Input.Value<
      SorobanType.Result<SorobanType.Symbol, SorobanType.Error>
    > = { ok: SorobanType.Symbol.from("A") };
    assertEquals(
      SorobanType.Result(SorobanType.Symbol, SorobanType.Error).from(result)
        .value,
      { ok: "A" },
    );
  });
});
