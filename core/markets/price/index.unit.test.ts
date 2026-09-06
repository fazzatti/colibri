import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Asset, Keypair, Operation } from "stellar-sdk";
import { StellarPrice, type StellarPriceRatio } from "@/markets/price/index.ts";
import * as E from "@/markets/price/error.ts";
import { ColibriError } from "@/error/index.ts";

describe("StellarPrice", () => {
  it("constructs exact quote-per-base prices directly from quantities", () => {
    assertEquals(
      StellarPrice.fromAmounts({ baseAmount: "3", quoteAmount: "2" }),
      { n: 2, d: 3 },
    );
    assertEquals(
      StellarPrice.fromAmounts({
        baseAmount: "0.0000001",
        quoteAmount: "0.0000002",
      }),
      { n: 2, d: 1 },
    );
    assertEquals(
      StellarPrice.fromAmounts({
        baseAmount: "922337203685.4775807",
        quoteAmount: "922337203685.4775807",
      }),
      { n: 1, d: 1 },
    );
    for (const [baseAmount, quoteAmount] of [["0", "1"], ["1", "0"]]) {
      assertThrows(
        () => StellarPrice.fromAmounts({ baseAmount, quoteAmount }),
        E.ZERO_PRICE_AMOUNT,
      );
    }
    for (
      const [baseAmount, quoteAmount] of [["2147483648", "1"], [
        "1",
        "2147483648",
      ]]
    ) {
      assertThrows(
        () => StellarPrice.fromAmounts({ baseAmount, quoteAmount }),
        E.UNREPRESENTABLE_AMOUNTS,
      );
    }
    for (
      const error of [
        new E.ZERO_PRICE_AMOUNT(),
        new E.UNREPRESENTABLE_AMOUNTS("1", "2147483648"),
      ]
    ) assertEquals(E.ERROR_PRCE[error.code], error.constructor);
  });

  it("compares rational prices exactly even when cross-products exceed safe integers", () => {
    const low = { n: 2_147_483_645, d: 2_147_483_646 };
    const high = { n: 2_147_483_646, d: 2_147_483_647 };
    assertEquals(StellarPrice.compare(low, high), -1);
    assertEquals(StellarPrice.compare(high, low), 1);
    assertEquals(StellarPrice.compare({ n: 2, d: 4 }, { n: 1, d: 2 }), 0);
    assertThrows(
      () => StellarPrice.compare({ n: 0, d: 1 }, high),
      E.INVALID_RATIO,
    );
    assertThrows(
      () => StellarPrice.compare(low, { n: 0, d: 1 }),
      E.INVALID_RATIO,
    );
  });

  it("reduces exact decimal strings without floating-point arithmetic", () => {
    const vectors = [
      ["2", { n: 2, d: 1 }],
      ["1.25", { n: 5, d: 4 }],
      ["0002.5000", { n: 5, d: 2 }],
      ["0.000000001", { n: 1, d: 1_000_000_000 }],
      ["2147483647", { n: 2_147_483_647, d: 1 }],
      ["2147483647.00000000000000000000", { n: 2_147_483_647, d: 1 }],
    ] as const;
    for (const [input, expected] of vectors) {
      assertEquals(StellarPrice.fromDecimal(input), expected);
    }
  });

  it("rejects ambiguous/invalid decimal syntax and nonpositive values", () => {
    for (
      const value of [
        "",
        " 2",
        "2 ",
        "+2",
        "-2",
        ".2",
        "2.",
        "1e2",
        "NaN",
        "Infinity",
        2,
        null,
      ]
    ) {
      assertThrows(
        () => StellarPrice.fromDecimal(value as string),
        E.INVALID_DECIMAL,
      );
    }
    for (const value of ["0", "000", "0.000"]) {
      assertThrows(
        () => StellarPrice.fromDecimal(value),
        E.NON_POSITIVE_DECIMAL,
      );
    }
  });

  it("refuses precision loss and int32 overflow rather than weakening limits", () => {
    for (
      const value of [
        "2147483648",
        "0.0000000001",
        "1.2345678913",
        "999999999999999999999999999",
      ]
    ) {
      assertThrows(
        () => StellarPrice.fromDecimal(value),
        E.UNREPRESENTABLE_DECIMAL,
      );
    }
  });

  it("formats and inverts exact ratios while preserving inputs", () => {
    const price = Object.freeze({ n: 5, d: 4 });
    assertEquals(StellarPrice.invert(price), { n: 4, d: 5 });
    for (
      const [ratio, expected] of [
        [{ n: 5, d: 4 }, "1.25"],
        [{ n: 4, d: 2 }, "2"],
        [{ n: 2, d: 6 }, "1/3"],
        [{ n: 1, d: 1_000_000_000 }, "0.000000001"],
        [{ n: 1, d: 8 }, "0.125"],
        [{ n: 1, d: 25 }, "0.04"],
      ] as const
    ) assertEquals(StellarPrice.format(ratio), expected);
    assertEquals(price, { n: 5, d: 4 });
  });

  it("rejects invalid fraction components consistently", () => {
    for (
      const price of [
        null,
        { n: 0, d: 1 },
        { n: -1, d: 1 },
        { n: 0.1, d: 1 },
        { n: 2_147_483_648, d: 1 },
        { n: 1, d: 0 },
        { n: 1, d: NaN },
        { n: 1, d: Infinity },
      ]
    ) {
      assertThrows(
        () => StellarPrice.invert(price as StellarPriceRatio),
        E.INVALID_RATIO,
      );
      assertThrows(
        () => StellarPrice.format(price as StellarPriceRatio),
        E.INVALID_RATIO,
      );
    }
  });

  it("identifies price direction and issuers, including an issued asset named XLM", () => {
    const issuer = Keypair.random().publicKey();
    const issued = new Asset("XLM", issuer);
    assertEquals(
      StellarPrice.describe({
        price: { n: 2, d: 1 },
        baseAsset: issued,
        quoteAsset: Asset.native(),
      }),
      `2 XLM (native) per XLM:${issuer}`,
    );
    assertEquals(
      StellarPrice.describe({
        price: { n: 1, d: 3 },
        baseAsset: Asset.native(),
        quoteAsset: issued,
      }),
      `1/3 XLM:${issuer} per XLM (native)`,
    );
  });

  it("produces a ratio accepted unchanged by the native SDK XDR encoder", () => {
    const asset = new Asset("USD", Keypair.random().publicKey());
    const price = StellarPrice.fromDecimal("1.25");
    const operation = Operation.manageSellOffer({
      selling: asset,
      buying: Asset.native(),
      amount: "10",
      price,
    });
    assertEquals(operation.body.type, "manageSellOffer");
    if (operation.body.type === "manageSellOffer") {
      assertEquals(operation.body.manageSellOfferOp.price.n, 5);
      assertEquals(operation.body.manageSellOfferOp.price.d, 4);
    }
  });

  it("exports distinct typed errors", () => {
    const errors = [
      new E.INVALID_DECIMAL("x"),
      new E.NON_POSITIVE_DECIMAL("0"),
      new E.UNREPRESENTABLE_DECIMAL("1e20"),
      new E.INVALID_RATIO({}),
    ];
    for (const error of errors) {
      assertEquals(error instanceof ColibriError, true);
      assertEquals(error.source, "@colibri/core/markets/price");
      assertEquals(E.ERROR_PRCE[error.code], error.constructor);
    }
  });
});
