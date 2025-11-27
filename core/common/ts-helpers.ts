export type EmptyObject = Record<string | number | symbol, never>;

export type Prettify<T> = {
  [K in keyof T]: T[K];
  // deno-lint-ignore ban-types
} & {};
