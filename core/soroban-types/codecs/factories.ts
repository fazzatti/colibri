import type { ScValLike } from "@/common/types/external.ts";
import type { Spec } from "@/contract/spec.ts";
import { Code, SorobanValueError } from "@/soroban-types/error.ts";
import { createSorobanType } from "@/soroban-types/codecs/custom.ts";
import type { SorobanCodec } from "@/soroban-types/codecs/codec.ts";
import type { SorobanValue } from "@/soroban-types/values/value.ts";

/** @internal Native SDK schema accepted without introducing a second constructor. */
type NativeSpec = Spec;

/** Lazy, spec-backed factory used by generated custom types. */
export interface SorobanFactory<Input, Output = Input> {
  /** Reusable codec, initialized from a snapshot on first use. */
  readonly type: SorobanCodec<Input, Output>;
  /** Validates native or nested wrapped input and returns an immutable value. */
  from(value: Input): SorobanValue<Output>;
  /** Validates and wraps a native ScVal. */
  fromScVal(value: ScValLike): SorobanValue<Output>;
  /** Validates and wraps raw bytes or base64/hex XDR. */
  fromXdr(
    value: Uint8Array | string,
    format?: "base64" | "hex",
  ): SorobanValue<Output>;
}

/** Typed variant constructors inferred from the generated union's input shape. */
export type SorobanUnionFactory<Input, Output = Input> =
  & SorobanFactory<Input, Output>
  & {
    [Tag in Extract<Input, { tag: string }>["tag"]]: (
      ...values: Extract<Input, { tag: Tag }> extends
        { values: infer Values extends unknown[] } ? Values
        : []
    ) => SorobanValue<Output>;
  };

/** Creates a lazy factory for a custom struct, tuple struct, or numeric enum. */
export function createSorobanFactory<Input, Output = Input>(
  spec: () => Pick<NativeSpec, "entries">,
  name: string,
): SorobanFactory<Input, Output> {
  let cached: SorobanCodec<Input, Output> | undefined;
  const type = (): SorobanCodec<Input, Output> =>
    cached ??= createSorobanType<Input, Output>(spec(), name);
  return Object.freeze({
    get type() {
      return type();
    },
    from: (value: Input) => type().from(value),
    fromScVal: (value: ScValLike) => type().fromScVal(value),
    fromXdr: (value: Uint8Array | string, format?: "base64" | "hex") =>
      type().fromXdr(value, format),
  });
}

/** Adds one typed constructor per spec union tag, preserving exact ABI tag names. */
export function createSorobanUnion<Input, Output = Input>(
  spec: () => Pick<NativeSpec, "entries">,
  name: string,
): SorobanUnionFactory<Input, Output> {
  const factory = createSorobanFactory<Input, Output>(spec, name);
  // Inspect variant names now; compile the codec only when a value is used.
  const variants = spec().entries.find((entry) =>
    entry.type === "scSpecEntryUdtUnionV0" &&
    entry.value.name.toString() === name
  );
  if (variants?.type !== "scSpecEntryUdtUnionV0") {
    throw new SorobanValueError(
      Code.INVALID_SCHEMA,
      name,
      "expected union declaration",
    );
  }
  const result = Object.defineProperties(
    Object.create(null),
    Object.getOwnPropertyDescriptors(factory),
  );
  for (const item of variants.value.cases) {
    const tag = item.value.name.toString();
    const isVoid = item.type === "scSpecUdtUnionCaseVoidV0";
    if (Object.hasOwn(result, tag)) {
      throw new SorobanValueError(
        Code.INVALID_SCHEMA,
        name,
        `variant conflicts with factory member ${tag}`,
      );
    }
    Object.defineProperty(result, tag, {
      enumerable: true,
      value: (...values: unknown[]) => {
        const input = isVoid ? { tag } : { tag, values };
        if (isVoid && values.length) {
          throw new SorobanValueError(
            Code.INVALID_VALUE,
            name,
            `${tag} takes no values`,
          );
        }
        return factory.from(input as Input);
      },
    });
  }
  return Object.freeze(result) as SorobanUnionFactory<Input, Output>;
}
