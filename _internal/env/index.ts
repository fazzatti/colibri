// deno-coverage-ignore-file

import { loadOptionalEnv } from "colibri-internal/env/loadEnv.ts";

export const QUASAR_API_KEY = loadOptionalEnv("QUASAR_API_KEY");
