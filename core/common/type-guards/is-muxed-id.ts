import type { MuxedId } from "@/account/native/types.ts";
import { regex } from "@/common/regex/index.ts";

export const isMuxedId = (id: string): id is MuxedId => {
  return typeof id === "string" && regex.uint64String.test(id);
};
