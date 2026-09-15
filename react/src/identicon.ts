"use client";
// @deno-types="@types/react"
import { createElement, useMemo } from "react";
import type { ReactElement } from "@/native.ts";
import { type IdenticonOptions, identiconSvg } from "@colibri/identicon/svg";
/** Deterministic SVG data URL. G-address SEP-33 plus Colibri's C-address extension. */
export function useIdenticon(
  address: string | undefined,
  options: IdenticonOptions = {},
): string | undefined {
  const { size, padding, background, saturation, value } = options;
  return useMemo(
    () =>
      address
        ? `data:image/svg+xml;charset=utf-8,${
          encodeURIComponent(
            identiconSvg(address, {
              size,
              padding,
              background,
              saturation,
              value,
            }),
          )
        }`
        : undefined,
    [address, size, padding, background, saturation, value],
  );
}
/** Unstyled accessible identicon image properties. */
export interface AccountIdenticonProps extends IdenticonOptions {
  /** Full G or C address. */
  address: string;
  /** Accessible text; use an empty string for a decorative duplicate. */
  alt: string;
  /** Application-owned CSS class. */
  className?: string;
}
/** Small optional presentation primitive; SVG output does not import a PNG encoder. */
export function AccountIdenticon(
  { address, alt, className, ...options }: AccountIdenticonProps,
): ReactElement {
  const src = useIdenticon(address, options);
  return createElement("img", {
    src,
    alt,
    className,
    width: options.size ?? 40,
    height: options.size ?? 40,
  });
}
