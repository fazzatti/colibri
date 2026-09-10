import type { Spec } from "@/contract/spec.ts";
import {
  createSorobanFactory,
  createSorobanUnion,
} from "@/soroban-types/codecs/factories.ts";
import type {
  SorobanFactory,
  SorobanUnionFactory,
} from "@/soroban-types/codecs/factories.ts";
import type * as Input from "@/soroban-types/types/inputs.ts";
import type { SchemaOf } from "@/soroban-types/types/schema.ts";
import { Code, SorobanValueError } from "@/soroban-types/error.ts";
import type {
  CustomSchema,
  CustomValue,
  Shape,
} from "@/soroban-types/types/schema.ts";

/** A custom declaration expressed with Soroban fields or enum variants. */
export type Custom<S extends CustomSchema> = CustomValue<S> & Shape<S>;

/** A spec-backed factory with typed constructors or explicit numeric enum members. */
export type Factory<T> = [SchemaOf<T>] extends [never]
  ? SorobanFactory<Input.Value<T>, T>
  : SchemaOf<T> extends { kind: "enum"; encoding: "tagged" }
    ? SorobanUnionFactory<Input.Value<T>, T>
  : SchemaOf<T> extends { kind: "enum"; encoding: "u32"; variants: infer V }
    ? SorobanFactory<Input.Value<T>, T> & Readonly<V>
  : SorobanFactory<Input.Value<T>, T>;

/** Runtime custom-type operations use the contract spec; generic schemas are erased. */
export const Custom: {
  /** Binds a generated declaration to its exact ABI name without duplicating its spec. */
  fromSpec<T>(spec: () => Pick<Spec, "entries">, name: string): Factory<T>;
} = /* @__PURE__ */ Object.freeze({ fromSpec });

function fromSpec<T>(
  spec: () => Pick<Spec, "entries">,
  name: string,
): Factory<T> {
  const entry = spec().entries.find((entry) =>
    entry.type.startsWith("scSpecEntryUdt") &&
    entry.value.name.toString() === name
  );
  if (!entry) {
    throw new SorobanValueError(
      Code.INVALID_SCHEMA,
      name,
      "missing custom declaration",
    );
  }
  if (entry.type === "scSpecEntryUdtUnionV0") {
    return createSorobanUnion<Input.Value<T>, T>(spec, name) as Factory<T>;
  }
  const factory = createSorobanFactory<Input.Value<T>, T>(spec, name);
  if (entry.type !== "scSpecEntryUdtEnumV0") return factory as Factory<T>;
  const result = Object.defineProperties(
    Object.create(null),
    Object.getOwnPropertyDescriptors(factory),
  );
  const codes = new Set<number>();
  for (const item of entry.value.cases) {
    const key = item.name.toString();
    if (Object.hasOwn(result, key) || codes.has(item.value)) {
      throw new SorobanValueError(
        Code.INVALID_SCHEMA,
        name,
        "duplicate enum code or conflicting member name",
      );
    }
    codes.add(item.value);
    Object.defineProperty(result, key, { value: item.value, enumerable: true });
  }
  return Object.freeze(result) as Factory<T>;
}
