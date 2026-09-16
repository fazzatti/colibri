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
  /** Construct a stable integration error. */
  constructor(code: ReactCode, message: string) {
    super({ domain: "tools", code, message, source: "@colibri/react" });
  }
}
