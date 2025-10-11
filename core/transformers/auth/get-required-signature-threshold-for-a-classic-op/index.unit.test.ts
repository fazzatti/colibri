import { assertEquals, assertExists, assertRejects } from "@std/assert";

import { describe, it } from "@std/testing/bdd";
import { getRequiredOperationThresholdForClassicOperation as getRequirements } from "./index.ts";

import * as E from "./error.ts";

import {
  Asset,
  AuthClawbackEnabledFlag,
  type AuthFlag,
  AuthImmutableFlag,
  AuthRequiredFlag,
  AuthRevocableFlag,
  Claimant,
  Operation,
  type SignerKeyOptions,
  type xdr,
} from "stellar-sdk";
import {
  OperationThreshold,
  type SignatureRequirement,
} from "../../../signer/types.ts";

const helperGetOpObj = (op: xdr.Operation) => {
  return Operation.fromXDRObject(op);
};

describe("Transformer getRequiredOperationThresholdForClassicOperation", () => {
  it("returns void if no requirements are identified", () => {
    const op = {
      type: "MOCK OP",
    } as unknown as Operation;

    const requirements = getRequirements(op) as SignatureRequirement;
    assertEquals(requirements, undefined);
  });

  it("returns signature requirements for a classic operation without source", () => {
    const op = helperGetOpObj(Operation.setOptions({ homeDomain: "mock" }));
    const requirements = getRequirements(op) as SignatureRequirement;
    assertExists(requirements);
    assertExists(requirements.thresholdLevel);
    assertExists(requirements.address);
    assertEquals(requirements.address, "source-account");
    assertEquals(requirements.thresholdLevel, OperationThreshold.medium);
  });

  it("returns signature requirements for a classic operation with a G-account as source", () => {
    const op = helperGetOpObj(
      Operation.setOptions({
        homeDomain: "mock",
        source: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
      })
    );
    const requirements = getRequirements(op) as SignatureRequirement;
    assertExists(requirements);
    assertExists(requirements.thresholdLevel);
    assertExists(requirements.address);
    assertEquals(
      requirements.address,
      "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR"
    );
    assertEquals(requirements.thresholdLevel, OperationThreshold.medium);
  });

  it("returns signature requirements for a classic operation with a Muxed account as source", () => {
    const op = helperGetOpObj(
      Operation.setOptions({
        homeDomain: "mock",
        source:
          "MAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNUAAAAAAAAAAAAGRHO",
      })
    );
    const requirements = getRequirements(op) as SignatureRequirement;
    assertExists(requirements);
    assertExists(requirements.thresholdLevel);
    assertExists(requirements.address);
    assertEquals(
      requirements.address,
      "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR"
    );
    assertEquals(requirements.thresholdLevel, OperationThreshold.medium);
  });

  it("returns the right thresholds for low security classic operations", () => {
    const lowLevelOps = [
      Operation.allowTrust({
        trustor: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
        assetCode: "XLM",
        authorize: true,
      }),
      Operation.bumpSequence({
        bumpTo: "1",
      }),
      Operation.setTrustLineFlags({
        trustor: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
        asset: new Asset(
          "TEST",
          "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR"
        ),
        flags: {
          authorized: true,
        },
      }),
    ];

    for (const op of lowLevelOps) {
      assertEquals(
        getRequirements(helperGetOpObj(op)) as SignatureRequirement,
        {
          address: "source-account",
          thresholdLevel: OperationThreshold.low,
        }
      );
    }
  });

  it("returns the right thresholds for medium security classic operations", () => {
    const mediumLevelOps = [
      Operation.createAccount({
        destination: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
        startingBalance: "0",
      }),
      Operation.payment({
        destination: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
        asset: Asset.native(),
        amount: "10",
      }),
      Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: "10",
        destination: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
        destAsset: new Asset(
          "TEST",
          "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR"
        ),
        destMin: "9.5",
      }),
      Operation.pathPaymentStrictReceive({
        sendAsset: Asset.native(),
        destAmount: "10",
        destination: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
        destAsset: new Asset(
          "TEST",
          "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR"
        ),
        sendMax: "9.5",
      }),
      Operation.manageSellOffer({
        selling: Asset.native(),
        amount: "10",
        price: "1",
        buying: new Asset(
          "TEST",
          "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR"
        ),
      }),
      Operation.manageBuyOffer({
        selling: Asset.native(),
        buyAmount: "10",
        price: "1",
        buying: new Asset(
          "TEST",
          "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR"
        ),
      }),
      Operation.createPassiveSellOffer({
        selling: Asset.native(),
        amount: "10",
        price: "1",
        buying: new Asset(
          "TEST",
          "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR"
        ),
      }),
      Operation.changeTrust({
        asset: new Asset(
          "TEST",
          "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR"
        ),
      }),
      Operation.manageData({
        value: "test",
        name: "test",
      }),
      Operation.createClaimableBalance({
        asset: Asset.native(),
        amount: "10",
        claimants: [
          new Claimant(
            "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR"
          ),
        ],
      }),
      Operation.claimClaimableBalance({
        balanceId:
          "00000000f6b85f3c49ca18f0f5b0d74ffe7197508b81280dd2f076c8c5805274dce9e795",
      }),
      Operation.beginSponsoringFutureReserves({
        sponsoredId: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
      }),
      Operation.endSponsoringFutureReserves({}),
      Operation.clawback({
        asset: new Asset(
          "TEST",
          "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR"
        ),
        amount: "10",
        from: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
      }),
      Operation.clawbackClaimableBalance({
        balanceId:
          "00000000f6b85f3c49ca18f0f5b0d74ffe7197508b81280dd2f076c8c5805274dce9e795",
      }),
      Operation.liquidityPoolDeposit({
        maxAmountA: "10",
        maxAmountB: "10",
        maxPrice: "1",
        minPrice: "0.5",
        liquidityPoolId:
          "3e24a724de6983eea010b316e179e126b18352c1db04cd09edd66ea2eab7e5cf",
      }),
      Operation.liquidityPoolWithdraw({
        minAmountA: "10",
        minAmountB: "10",
        amount: "10",
        liquidityPoolId:
          "3e24a724de6983eea010b316e179e126b18352c1db04cd09edd66ea2eab7e5cf",
      }),
      Operation.revokeAccountSponsorship({
        account: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
      }),
      Operation.revokeTrustlineSponsorship({
        account: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
        asset: new Asset(
          "TEST",
          "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR"
        ),
      }),
      Operation.revokeOfferSponsorship({
        offerId: "1784285786",
        seller: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
      }),
      Operation.revokeDataSponsorship({
        name: "name",
        account: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
      }),
      Operation.revokeClaimableBalanceSponsorship({
        balanceId:
          "00000000f6b85f3c49ca18f0f5b0d74ffe7197508b81280dd2f076c8c5805274dce9e795",
      }),
      Operation.revokeLiquidityPoolSponsorship({
        liquidityPoolId:
          "3e24a724de6983eea010b316e179e126b18352c1db04cd09edd66ea2eab7e5cf",
      }),
      Operation.revokeSignerSponsorship({
        account: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
        signer: {
          ed25519PublicKey:
            "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
        } as SignerKeyOptions.Ed25519PublicKey,
      }),
      Operation.setOptions({
        homeDomain: "mock",
      }),
      Operation.setOptions({
        setFlags: AuthRequiredFlag,
      }),
      Operation.setOptions({
        setFlags: AuthRevocableFlag,
      }),
      Operation.setOptions({
        setFlags: AuthClawbackEnabledFlag,
      }),
      Operation.setOptions({
        setFlags: AuthImmutableFlag,
      }),
      Operation.setOptions({
        setFlags: (AuthRequiredFlag |
          AuthRevocableFlag |
          AuthClawbackEnabledFlag |
          AuthImmutableFlag) as AuthFlag,
      }),
      Operation.setOptions({
        clearFlags: AuthRequiredFlag,
      }),
      Operation.setOptions({
        clearFlags: AuthRevocableFlag,
      }),
      Operation.setOptions({
        clearFlags: AuthClawbackEnabledFlag,
      }),
      Operation.setOptions({
        clearFlags: AuthImmutableFlag,
      }),
      Operation.setOptions({
        clearFlags: (AuthRequiredFlag |
          AuthRevocableFlag |
          AuthClawbackEnabledFlag |
          AuthImmutableFlag) as AuthFlag,
      }),
      Operation.setOptions({
        inflationDest:
          "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
      }),
    ];

    for (const op of mediumLevelOps) {
      assertEquals(
        getRequirements(helperGetOpObj(op)) as SignatureRequirement,
        {
          address: "source-account",
          thresholdLevel: OperationThreshold.medium,
        }
      );
    }
  });

  it("returns the right thresholds for high security classic operations", () => {
    const highLevelOps = [
      Operation.accountMerge({
        destination: "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
      }),
      Operation.setOptions({
        masterWeight: 1,
      }),
      Operation.setOptions({
        signer: {
          ed25519PublicKey:
            "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
          weight: 1,
        },
      }),
      Operation.setOptions({
        signer: {
          ed25519PublicKey:
            "GAKT7G5CXB4DVUAUOJXY7KLN6UFZLICTNCKHH6HOOOZC3HDA2YDNURJR",
          weight: 0,
        },
      }),
      Operation.setOptions({
        lowThreshold: 1,
      }),
      Operation.setOptions({
        medThreshold: 1,
      }),
      Operation.setOptions({
        highThreshold: 1,
      }),
    ];

    for (const op of highLevelOps) {
      assertEquals(
        getRequirements(helperGetOpObj(op)) as SignatureRequirement,
        {
          address: "source-account",
          thresholdLevel: OperationThreshold.high,
        }
      );
    }
  });

  it("throws FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE if the source account is invalid", async () => {
    const op = helperGetOpObj(
      Operation.setOptions({
        homeDomain: "mock",
      })
    );

    op.source = "invalid-source" as unknown as string; // Force invalid source

    await assertRejects(
      async () => await getRequirements(op),
      E.FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE
    );
  });
  it("throws UNEXPECTED_ERROR if an unexpected error occurs", async () => {
    const op = helperGetOpObj(
      Operation.setOptions({
        homeDomain: "mock",
      })
    );

    // Stub OperationThreshold.medium to throw when accessed
    // deno-lint-ignore no-unused-vars
    const originalMedium = Object.getOwnPropertyDescriptor(
      OperationThreshold,
      "medium"
    );
    Object.defineProperty(OperationThreshold, "medium", {
      get: () => {
        throw new Error("Forced failure");
      },
      configurable: true,
    });

    await assertRejects(
      async () => await getRequirements(op),
      E.UNEXPECTED_ERROR
    );
  });
});
