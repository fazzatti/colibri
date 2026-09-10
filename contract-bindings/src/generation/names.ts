/**
 * Names used by the generated templates. CLI validation and ABI declarations
 * share this inventory so collisions are reported before source loading.
 * @module
 */

/** @internal Imported and global types reserved by the generated declarations. */
export const TEMPLATE_TYPE_NAMES: ReadonlySet<string> = new Set([
  "SorobanType",
  "Array",
  "Map",
  "Record",
  "Uint8Array",
  "Promise",
  "Pick",
  "Parameters",
  "ReturnType",
  "Awaited",
  "Partial",
  "Contract",
  "ContractConstructorArgs",
  "ContractErrorMap",
  "ContractEventDefinition",
  "ContractEventRegistry",
  "StellarResult",
]);

/** @internal Class declarations must also preserve imports and globals in index.ts. */
export const TEMPLATE_CLASS_NAMES: ReadonlySet<string> = new Set([
  ...TEMPLATE_TYPE_NAMES,
  "ContractId",
  "Object",
  "ColibriError",
  "Spec",
  "ContractMethods",
  "createContractErrorMatcherPlugin",
]);
