import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Keypair, Address, Contract } from "stellar-sdk";
import { Event } from "@/event/event.ts";
import {
  SetAuthorizedEvent,
  SetAuthorizedEventSchema,
} from "@/event/standards/sac/set_authorized.ts";
import { EventType } from "@/event/types.ts";

// Helper to create a mock Event
function createMockEvent(
  topics: xdr.ScVal[],
  value: xdr.ScVal,
  contractId?: string
): Event {
  const contract =
    contractId ?? "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

  return new Event({
    id: "0000000000000000000-0000000000",
    type: EventType.Contract,
    ledger: 12345,
    ledgerClosedAt: "2024-01-01T00:00:00Z",
    transactionIndex: 0,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: "abc123",
    contractId: new Contract(contract),
    topic: topics,
    value: value,
  });
}

const assetString =
  "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("SetAuthorizedEventSchema", () => {
  it("should have correct structure per CAP-0067", () => {
    assertEquals(SetAuthorizedEventSchema.name, "set_authorized");
    assertEquals(SetAuthorizedEventSchema.topics.length, 2);
    assertEquals(SetAuthorizedEventSchema.topics[0].name, "account");
    assertEquals(SetAuthorizedEventSchema.topics[0].type, "address");
    assertEquals(SetAuthorizedEventSchema.topics[1].name, "asset");
    assertEquals(SetAuthorizedEventSchema.topics[1].type, "string");
    assertEquals(SetAuthorizedEventSchema.value.name, "authorize");
    assertEquals(SetAuthorizedEventSchema.value.type, "bool");
  });
});

describe("SetAuthorizedEvent", () => {
  describe("is()", () => {
    it("should return true for valid SAC set_authorized event", () => {
      const account = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_authorized"),
          new Address(account).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        xdr.ScVal.scvBool(true)
      );

      assertEquals(SetAuthorizedEvent.is(event), true);
    });

    it("should return true for native asset set_authorized", () => {
      const account = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_authorized"),
          new Address(account).toScVal(),
          xdr.ScVal.scvString("native"),
        ],
        xdr.ScVal.scvBool(true)
      );

      assertEquals(SetAuthorizedEvent.is(event), true);
    });

    it("should return false for wrong number of topics", () => {
      const account = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_authorized"),
          new Address(account).toScVal(),
          // missing asset topic
        ],
        xdr.ScVal.scvBool(true)
      );

      assertEquals(SetAuthorizedEvent.is(event), false);
    });

    it("should return false for wrong event name", () => {
      const account = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_admin"),
          new Address(account).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        xdr.ScVal.scvBool(true)
      );

      assertEquals(SetAuthorizedEvent.is(event), false);
    });
  });

  describe("fromEvent()", () => {
    it("should create SetAuthorizedEvent with typed accessors - authorized true", () => {
      const account = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_authorized"),
          new Address(account).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        xdr.ScVal.scvBool(true)
      );

      const setAuthEvent = SetAuthorizedEvent.fromEvent(event);

      assertExists(setAuthEvent);
      assertEquals(setAuthEvent.account, account);
      assertEquals(setAuthEvent.authorize, true);
      assertEquals(setAuthEvent.asset, assetString);
    });

    it("should create SetAuthorizedEvent with typed accessors - authorized false", () => {
      const account = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_authorized"),
          new Address(account).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        xdr.ScVal.scvBool(false)
      );

      const setAuthEvent = SetAuthorizedEvent.fromEvent(event);

      assertExists(setAuthEvent);
      assertEquals(setAuthEvent.account, account);
      assertEquals(setAuthEvent.authorize, false);
      assertEquals(setAuthEvent.asset, assetString);
    });
  });

  describe("address type checks", () => {
    it("should identify account addresses", () => {
      const account = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_authorized"),
          new Address(account).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        xdr.ScVal.scvBool(true)
      );

      const setAuthEvent = SetAuthorizedEvent.fromEvent(event);

      assertEquals(setAuthEvent.isAccountAddress(), true);
      assertEquals(setAuthEvent.isAccountContract(), false);
    });

    it("should identify contract addresses", () => {
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_authorized"),
          new Address(contractId).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        xdr.ScVal.scvBool(true)
      );

      const setAuthEvent = SetAuthorizedEvent.fromEvent(event);

      assertEquals(setAuthEvent.isAccountAddress(), false);
      assertEquals(setAuthEvent.isAccountContract(), true);
    });
  });

  describe("toTopicFilter()", () => {
    it("should create filter for any SAC set_authorized event", () => {
      const filter = SetAuthorizedEvent.toTopicFilter({});

      assertEquals(filter.length, 3);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1], null);
      assertEquals(filter[2], null);
    });

    it("should create filter for set_authorized for specific account", () => {
      const account = Keypair.random().publicKey();
      const filter = SetAuthorizedEvent.toTopicFilter({ account });

      assertEquals(filter.length, 3);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1]?.switch().name, "scvAddress");
      assertEquals(filter[2], null);
    });
  });
});
