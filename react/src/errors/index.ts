import { ColibriError } from "@colibri/core/errors";
/** Stable React integration error codes. */
export enum ReactCode {
  /** Provider context is absent. */
  MISSING_PROVIDER = "REACT_001",
  /** Provider or feature configuration is invalid. */
  INVALID_CONFIG = "REACT_002",
  /** The wallet did not advertise this signing capability. */
  UNSUPPORTED_CAPABILITY = "REACT_003",
  /** An outstanding operation belongs to an obsolete connection. */
  CONNECTION_CHANGED = "REACT_004",
  /** A cache input cannot be represented canonically. */
  INVALID_QUERY_VALUE = "REACT_005",
  /** A contract method is unavailable. */
  INVALID_METHOD = "REACT_006",
  /** A client or wallet reports another network. */
  NETWORK_MISMATCH = "REACT_007",
  /** The returned token is expired or not bound to the authenticated exchange. */
  INVALID_SESSION = "REACT_008",
}
/** Errors introduced by the React integration; SDK and wallet errors retain identity. */
export class ColibriReactError extends ColibriError<ReactCode> {
  /** @deprecated Construct a concrete React error instead. Retained for source compatibility. */
  constructor(code: ReactCode, message: string) {
    super({ domain: "tools", code, message, source: "@colibri/react" });
  }
}

/** Missing provider. Stable code `REACT_001`. */
export class ReactMissingProviderError extends ColibriReactError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string) {
    super(ReactCode.MISSING_PROVIDER, message);
  }
}
/** Invalid config. Stable code `REACT_002`. */
export class ReactInvalidConfigError extends ColibriReactError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string) {
    super(ReactCode.INVALID_CONFIG, message);
  }
}
/** Unsupported capability. Stable code `REACT_003`. */
export class ReactUnsupportedCapabilityError extends ColibriReactError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string) {
    super(ReactCode.UNSUPPORTED_CAPABILITY, message);
  }
}
/** Connection changed. Stable code `REACT_004`. */
export class ReactConnectionChangedError extends ColibriReactError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string) {
    super(ReactCode.CONNECTION_CHANGED, message);
  }
}
/** Invalid query value. Stable code `REACT_005`. */
export class ReactInvalidQueryValueError extends ColibriReactError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string) {
    super(ReactCode.INVALID_QUERY_VALUE, message);
  }
}
/** Invalid method. Stable code `REACT_006`. */
export class ReactInvalidMethodError extends ColibriReactError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string) {
    super(ReactCode.INVALID_METHOD, message);
  }
}
/** Network mismatch. Stable code `REACT_007`. */
export class ReactNetworkMismatchError extends ColibriReactError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string) {
    super(ReactCode.NETWORK_MISMATCH, message);
  }
}
/** Invalid session. Stable code `REACT_008`. */
export class ReactInvalidSessionError extends ColibriReactError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string) {
    super(ReactCode.INVALID_SESSION, message);
  }
}
/** One concrete constructor for each stable React error code. */
export const ReactErrors: {
  [ReactCode.MISSING_PROVIDER]: typeof ReactMissingProviderError;
  [ReactCode.INVALID_CONFIG]: typeof ReactInvalidConfigError;
  [ReactCode.UNSUPPORTED_CAPABILITY]: typeof ReactUnsupportedCapabilityError;
  [ReactCode.CONNECTION_CHANGED]: typeof ReactConnectionChangedError;
  [ReactCode.INVALID_QUERY_VALUE]: typeof ReactInvalidQueryValueError;
  [ReactCode.INVALID_METHOD]: typeof ReactInvalidMethodError;
  [ReactCode.NETWORK_MISMATCH]: typeof ReactNetworkMismatchError;
  [ReactCode.INVALID_SESSION]: typeof ReactInvalidSessionError;
} = {
  [ReactCode.MISSING_PROVIDER]: ReactMissingProviderError,
  [ReactCode.INVALID_CONFIG]: ReactInvalidConfigError,
  [ReactCode.UNSUPPORTED_CAPABILITY]: ReactUnsupportedCapabilityError,
  [ReactCode.CONNECTION_CHANGED]: ReactConnectionChangedError,
  [ReactCode.INVALID_QUERY_VALUE]: ReactInvalidQueryValueError,
  [ReactCode.INVALID_METHOD]: ReactInvalidMethodError,
  [ReactCode.NETWORK_MISMATCH]: ReactNetworkMismatchError,
  [ReactCode.INVALID_SESSION]: ReactInvalidSessionError,
};
