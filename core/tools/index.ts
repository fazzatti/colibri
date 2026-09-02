import * as CoreToolErrors from "@/tools/error.ts";

export * from "@/tools/friendbot/initialize-with-friendbot.ts";
/** Base error constructors used by high-level core tools. */
export const ToolsError: typeof CoreToolErrors = CoreToolErrors;
