import type * as Freighter from "@stellar/freighter-api";
/** The supported upstream Freighter methods, derived from its published SDK. */
export type FreighterApi = Pick<
  typeof Freighter,
  "requestAccess" | "getAddress" | "getNetworkDetails" | "signTransaction"
>;
