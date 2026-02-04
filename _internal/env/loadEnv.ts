// deno-coverage-ignore-file

import { load } from "@std/dotenv";

const env = await load(); // Reads from .env file

export const requireEnv = (key: string): string => {
  const value = env[key as keyof typeof env];

  if (value === undefined) {
    const denoVal = Deno.env.get(key);

    if (denoVal === undefined) {
      throw new Error(`${key} is not loaded`);
    }
    return denoVal;
  }
  return value;
};

export const loadOptionalEnv = (key: string): string | undefined => {
  const value = env[key as keyof typeof env];

  if (value === undefined) {
    const denoVal = Deno.env.get(key);
    if (denoVal === undefined) {
      return undefined;
    }
    return denoVal;
  }
  return value;
};
