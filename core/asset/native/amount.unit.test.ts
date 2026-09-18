import { assertEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { StellarAsset } from "@/asset/native/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { fromDecimals, toDecimals } from "@/common/helpers/format-units.ts";
import * as ERROR from "@/asset/native/amount.error.ts";

const { describe, it, observer: suiteObserver } = recordColibriTests(
  import.meta.url,
);

describe("StellarAsset exact units", () => {
  const asset = suiteObserver.attach(
    StellarAsset.NativeXLM({
      networkConfig: NetworkConfig.TestNet(),
    }),
    { name: "asset" },
  );
  it("round-trips boundaries without number coercion or floating point", () => {
    for (
      const [decimal, units] of [
        ["0", 0n],
        ["1", 10_000_000n],
        ["0.0000001", 1n],
        ["1.2345678", 12_345_678n],
        ["922337203685.4775807", 9_223_372_036_854_775_807n],
      ] as const
    ) {
      assertEquals(asset.parseAmount(decimal), units);
      assertEquals(asset.formatAmount(units), decimal);
      assertEquals(asset.parseAmount(decimal), fromDecimals(decimal, 7));
      assertEquals(asset.formatAmount(units), toDecimals(units, 7));
    }
    assertEquals(asset.decimals(), 7);
    assertEquals(asset.parseAmount("0001.230000000"), 12_300_000n);
    assertEquals(asset.formatAmount(12_300_000n), "1.23");
    // Generic helpers retain their broader signed/scientific/custom-scale API.
    assertEquals(fromDecimals("-1e2", 9), -100_000_000_000n);
    assertEquals(toDecimals(-1n, 9), "-0.000000001");
  });

  it("rejects ambiguous syntax, rounding and overflow with separate codes", () => {
    for (
      const value of ["", "-1", "+1", "1e3", ".1", "1.", " 1", NaN, null, 1]
    ) {
      const error = assertThrows(
        () => asset.parseAmount(value as string),
        ERROR.INVALID_DECIMAL,
      );
      assertEquals(ERROR.ERROR_AMNT[error.code], error.constructor);
    }
    const precision = assertThrows(
      () => asset.parseAmount("0.00000001"),
      ERROR.EXCESS_PRECISION,
    );
    const overflow = assertThrows(
      () => asset.parseAmount("922337203685.4775808"),
      ERROR.DECIMAL_OVERFLOW,
    );
    for (const error of [precision, overflow]) {
      assertEquals(ERROR.ERROR_AMNT[error.code], error.constructor);
    }
    for (const value of [-1n, 9_223_372_036_854_775_808n, 1, null]) {
      const error = assertThrows(
        () => asset.formatAmount(value as bigint),
        ERROR.INVALID_UNITS,
      );
      assertEquals(ERROR.ERROR_AMNT[error.code], error.constructor);
    }
  });
});
