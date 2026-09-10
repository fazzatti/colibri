/** Type-only schema metadata; ordinary JavaScript values need no extra fields. */
export const shape: unique symbol = Symbol("SorobanType.shape");
/** Separate optional metadata preserves recursive and nested optional declarations. */
export const optional: unique symbol = Symbol("SorobanType.optional");

/** Erased description of an optional value's inner type. */
export type Optional<T> = unknown extends T ? T
  : (T & { readonly [optional]?: { value: T } }) | null;

/** Optional metadata is separate from the inner type's own declaration. */
export type OptionalOf<T> = typeof optional extends keyof NonNullable<T>
  ? Exclude<NonNullable<T>[typeof optional], undefined>
  : never;

/** Optional metadata preserves ABI distinctions when composing TypeScript types. */
export type Shape<Schema> = { readonly [shape]?: Schema };

/** Extracts a declaration's type metadata, including nullable compositions. */
export type SchemaOf<T> = typeof shape extends keyof NonNullable<T>
  ? Exclude<NonNullable<T>[typeof shape], undefined>
  : never;

/** Named struct, positional struct, tagged enum or explicit numeric enum. */
export type CustomSchema =
  | { kind: "struct"; fields: Record<string, unknown> }
  | { kind: "tuple"; fields: readonly unknown[] }
  | {
    kind: "enum";
    encoding: "tagged";
    variants: Record<string, readonly unknown[] | null>;
  }
  | {
    kind: "enum";
    encoding: "u32";
    variants: Record<string, number>;
  };

/** Derives the SDK-compatible shape of a custom declaration. */
export type CustomValue<S extends CustomSchema> = S extends
  { kind: "struct"; fields: infer Fields }
  ? { -readonly [Key in keyof Fields]: Fields[Key] }
  : S extends { kind: "tuple"; fields: infer Fields extends readonly unknown[] }
    ? { -readonly [Key in keyof Fields]: Fields[Key] }
  : S extends { kind: "enum"; encoding: "u32"; variants: infer Variants }
    ? Variants[keyof Variants]
  : S extends { kind: "enum"; encoding: "tagged"; variants: infer Variants } ? {
      [Tag in keyof Variants]: Variants[Tag] extends null ? { tag: Tag }
        : {
          tag: Tag;
          values: { -readonly [K in keyof Variants[Tag]]: Variants[Tag][K] };
        };
    }[keyof Variants]
  : never;
