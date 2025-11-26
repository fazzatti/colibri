import * as authEntries from "@/common/helpers/xdr/auth-entries.ts";
import * as general from "@/common/helpers/xdr/general.ts";

export const xdr = { ...authEntries, ...general };

export type * from "@/common/helpers/xdr/types.ts";
