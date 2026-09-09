/** Soroban declarations, validation codecs and custom schema builders. @module */
export * from "@/values/types/scalars.ts";
export * from "@/values/types/collections.ts";
export * from "@/values/types/system.ts";
export * from "@/values/types/custom.ts";
/** Accepted primitive and composed inputs, including validated wrappers. */
export * as Input from "@/values/types/input.ts";
export { optional, shape } from "@/values/types/shape.ts";
export type {
  CustomSchema,
  CustomValue,
  Optional,
  OptionalOf,
  SchemaOf,
  Shape,
} from "@/values/types/shape.ts";
export { SorobanValue as Value } from "@/values/value.ts";

/** Declared error codes selected from the existing categorized contract error map. */
export type ErrorCode<Errors, Category extends string> = {
  [Code in keyof Errors]: Errors[Code] extends { category: Category }
    ? Code extends number ? Code
    : Code extends `${infer N extends number}` ? N
    : never
    : never;
}[keyof Errors];
