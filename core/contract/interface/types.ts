import type { Spec } from "stellar-sdk/contract";
import type { BinaryData } from "@/common/types/index.ts";
import type { SepClaim } from "@/contract/metadata/types.ts";

/** Contract specification accepted by interface-analysis helpers. */
export type ContractSpec = Spec;

/** JSON-compatible value used in structural interface diagnostics. */
export type ContractInterfaceValue =
  | boolean
  | number
  | string
  | null
  | readonly ContractInterfaceValue[]
  | { readonly [key: string]: ContractInterfaceValue };

/** Canonical SEP-48 type shape produced by Stellar SDK specification XDR. */
export type ContractInterfaceType =
  | string
  | { readonly option: { readonly value_type: ContractInterfaceType } }
  | {
    readonly result: {
      readonly ok_type: ContractInterfaceType;
      readonly error_type: ContractInterfaceType;
    };
  }
  | { readonly vec: { readonly element_type: ContractInterfaceType } }
  | {
    readonly map: {
      readonly key_type: ContractInterfaceType;
      readonly value_type: ContractInterfaceType;
    };
  }
  | {
    readonly tuple: { readonly value_types: readonly ContractInterfaceType[] };
  }
  | { readonly bytes_n: { readonly n: number } }
  | { readonly udt: { readonly name: string } };

/** Exact or constrained type required at one interface position. */
export type ContractInterfaceTypeRequirement =
  | {
    /** Requires one exact SEP-48 type shape. */
    readonly kind: "exact";
    /** Required type shape. */
    readonly type: ContractInterfaceType;
  }
  | {
    /** Captures a type and requires the same type at every matching variable. */
    readonly kind: "variable";
    /** Provider-local variable name. */
    readonly name: string;
    /** Type shapes accepted when the variable is first encountered. */
    readonly allowedTypes: readonly ContractInterfaceType[];
  };

/** One required function parameter. */
export type ContractInterfaceParameter = {
  /** ABI parameter name. */
  readonly name: string;
  /** ABI parameter type requirement. */
  readonly type: ContractInterfaceTypeRequirement;
};

/** One required contract function. */
export type ContractInterfaceFunction = {
  /** Exported contract function name. */
  readonly name: string;
  /** Ordered ABI inputs. */
  readonly inputs: readonly ContractInterfaceParameter[];
  /** Ordered ABI outputs. */
  readonly outputs: readonly ContractInterfaceTypeRequirement[];
};

/** Supported user-defined specification entry kinds. */
export type ContractInterfaceUserTypeKind =
  | "struct"
  | "union"
  | "enum"
  | "error-enum";

/** One structurally required user-defined contract type. */
export type ContractInterfaceUserType = {
  /** User-defined type kind. */
  readonly kind: ContractInterfaceUserTypeKind;
  /** User-defined type name. */
  readonly name: string;
  /** Normalized SEP-48 structure with documentation and library labels removed. */
  readonly definition: ContractInterfaceValue;
};

/** One contract interface definition associated with a standard provider. */
export type ContractInterfaceDefinition = {
  /** Stable interface identifier within its SEP. */
  readonly id: string;
  /** Human-readable interface name. */
  readonly name: string;
  /** Required callable functions. */
  readonly functions: readonly ContractInterfaceFunction[];
  /** Required user-defined types referenced by the callable interface. */
  readonly types: readonly ContractInterfaceUserType[];
};

/** Versioned provider for one contract interface defined by a SEP. */
export type ContractStandardProvider = {
  /** SEP number defining the interface. */
  readonly sep: number;
  /** SEP document version represented by this provider. */
  readonly version: string;
  /** Interface definition evaluated by Colibri. */
  readonly interface: ContractInterfaceDefinition;
};

/** Version-indexed providers plus the newest provider bundled by Colibri. */
export type ContractStandardCatalog<Version extends string> = {
  /** Providers indexed by an explicit SEP document version. */
  readonly versions: Readonly<Record<Version, ContractStandardProvider>>;
  /** Newest provider bundled with the installed Colibri release. */
  readonly latest: ContractStandardProvider;
};

/** One expected/actual structural difference. */
export type ContractInterfaceDifference = {
  /** Dot/bracket path within the normalized definition. */
  readonly path: string;
  /** Expected value, omitted when the path exists only in the contract. */
  readonly expected?: ContractInterfaceValue;
  /** Actual value, omitted when the path exists only in the provider. */
  readonly actual?: ContractInterfaceValue;
};

/** Diagnostic for one present function with an incompatible signature. */
export type ContractInterfaceFunctionMismatch = {
  /** Function name. */
  readonly name: string;
  /** Structural differences in parameters or outputs. */
  readonly differences: readonly ContractInterfaceDifference[];
};

/** Diagnostic for one present user-defined type with an incompatible shape. */
export type ContractInterfaceTypeMismatch = {
  /** Expected type kind. */
  readonly kind: ContractInterfaceUserTypeKind;
  /** User-defined type name. */
  readonly name: string;
  /** Structural differences in the type definition. */
  readonly differences: readonly ContractInterfaceDifference[];
};

/** Detailed structural comparison between a contract spec and one provider. */
export type ContractInterfaceAnalysis = {
  /** True when every required function and user-defined type matches. */
  readonly matches: boolean;
  /** Required functions absent from the contract specification. */
  readonly missingFunctions: readonly string[];
  /** Present functions whose ABI differs from the provider. */
  readonly incompatibleFunctions: readonly ContractInterfaceFunctionMismatch[];
  /** Contract functions not required by the provider. */
  readonly additionalFunctions: readonly string[];
  /** Required user-defined types absent from the contract specification. */
  readonly missingTypes: readonly {
    readonly kind: ContractInterfaceUserTypeKind;
    readonly name: string;
  }[];
  /** Present user-defined types whose structure differs from the provider. */
  readonly incompatibleTypes: readonly ContractInterfaceTypeMismatch[];
  /** Contract user-defined types not required by the provider. */
  readonly additionalTypes: readonly {
    readonly kind: ContractInterfaceUserTypeKind;
    readonly name: string;
  }[];
};

/** SEP-47 claim result attached to one interface inspection. */
export type ContractStandardClaimInspection = {
  /** Whether at least one metadata occurrence claims the provider's SEP. */
  readonly declared: boolean;
  /** Every matching declaration, including duplicates. */
  readonly declarations: readonly SepClaim[];
};

/** Identity of the standard provider represented in an inspection result. */
export type ContractStandardIdentity = {
  /** SEP number. */
  readonly sep: number;
  /** SEP version. */
  readonly version: string;
  /** Provider interface identifier. */
  readonly interfaceId: string;
  /** Human-readable interface name. */
  readonly interfaceName: string;
};

/** One independent SEP-47 claim and Colibri interface-analysis result. */
export type ContractStandardInspection = {
  /** Standard and interface provider evaluated. */
  readonly standard: ContractStandardIdentity;
  /** Informational SEP-47 claim result. */
  readonly claim: ContractStandardClaimInspection;
  /** Independent Colibri structural interface analysis. */
  readonly interface: ContractInterfaceAnalysis;
};

/** Inputs for inspecting multiple standard providers from one Wasm module. */
export type InspectContractStandardsArgs = {
  /** Contract Wasm containing SEP-46 metadata and a SEP-48 specification. */
  readonly wasm: BinaryData;
  /** Providers to evaluate in caller-supplied order. */
  readonly standards: readonly ContractStandardProvider[];
};
