import type { IdenticonColor } from "@/core/types.ts";

/** Converts a validated HSV triple to rounded reference-compatible RGB. */
export const colorFromHue = (
  hue: number,
  saturation: number,
  value: number,
): IdenticonColor => {
  const sector = hue * 6;
  const fraction = sector - Math.floor(sector);
  const low = value * (1 - saturation);
  const falling = value * (1 - fraction * saturation);
  const rising = value * (1 - (1 - fraction) * saturation);
  const channels = [
    [value, rising, low],
    [falling, value, low],
    [low, value, rising],
    [low, falling, value],
    [rising, low, value],
    [value, low, falling],
  ][Math.floor(sector) % 6];
  return Object.freeze({
    r: Math.round(channels[0] * 255),
    g: Math.round(channels[1] * 255),
    b: Math.round(channels[2] * 255),
  });
};
