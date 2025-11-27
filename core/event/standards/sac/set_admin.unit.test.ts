import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Keypair, Address } from "stellar-sdk";
import { Event } from "@/event/event.ts";
import {
  SetAdminEvent,
  SetAdminEventSchema,
} from "@/event/standards/sac/set_admin.ts";
import { EventType } from "@/event/types.ts";
import type { ContractId } from "@/strkeys/types.ts";

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
    contractId: contract as ContractId,
    topic: topics,
    value: value,
  });
}

const assetString =
  "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("SetAdminEventSchema", () => {
  it("should have correct structure per CAP-0046-06", () => {
    assertEquals(SetAdminEventSchema.name, "set_admin");
    assertEquals(SetAdminEventSchema.topics.length, 2);
    assertEquals(SetAdminEventSchema.topics[0].name, "admin");
    assertEquals(SetAdminEventSchema.topics[0].type, "address");
    assertEquals(SetAdminEventSchema.topics[1].name, "asset");
    assertEquals(SetAdminEventSchema.topics[1].type, "string");
    assertEquals(SetAdminEventSchema.value.name, "newAdmin");
    assertEquals(SetAdminEventSchema.value.type, "address");
  });
});

describe("SetAdminEvent", () => {
  describe("is()", () => {
    it("should return true for valid SAC set_admin event", () => {
      const admin = Keypair.random().publicKey();
      const newAdmin = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_admin"),
          new Address(admin).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        new Address(newAdmin).toScVal()
      );

      assertEquals(SetAdminEvent.is(event), true);
    });

    it("should return true for native asset set_admin", () => {
      const admin = Keypair.random().publicKey();
      const newAdmin = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_admin"),
          new Address(admin).toScVal(),
          xdr.ScVal.scvString("native"),
        ],
        new Address(newAdmin).toScVal()
      );

      assertEquals(SetAdminEvent.is(event), true);
    });

    it("should return false for wrong number of topics", () => {
      const admin = Keypair.random().publicKey();
      const newAdmin = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_admin"),
          new Address(admin).toScVal(),
          // missing asset topic
        ],
        new Address(newAdmin).toScVal()
      );

      assertEquals(SetAdminEvent.is(event), false);
    });

    it("should return false for wrong event name", () => {
      const admin = Keypair.random().publicKey();
      const newAdmin = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_authorized"),
          new Address(admin).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        new Address(newAdmin).toScVal()
      );

      assertEquals(SetAdminEvent.is(event), false);
    });
  });

  describe("fromEvent()", () => {
    it("should create SetAdminEvent with typed accessors", () => {
      const admin = Keypair.random().publicKey();
      const newAdmin = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_admin"),
          new Address(admin).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        new Address(newAdmin).toScVal()
      );

      const setAdminEvent = SetAdminEvent.fromEvent(event);

      assertExists(setAdminEvent);
      assertEquals(setAdminEvent.admin, admin);
      assertEquals(setAdminEvent.newAdmin, newAdmin);
      assertEquals(setAdminEvent.asset, assetString);
    });
  });

  describe("address type checks", () => {
    it("should identify account addresses", () => {
      const admin = Keypair.random().publicKey();
      const newAdmin = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_admin"),
          new Address(admin).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        new Address(newAdmin).toScVal()
      );

      const setAdminEvent = SetAdminEvent.fromEvent(event);

      assertEquals(setAdminEvent.isAdminAccount(), true);
      assertEquals(setAdminEvent.isAdminContract(), false);
      assertEquals(setAdminEvent.isNewAdminAccount(), true);
      assertEquals(setAdminEvent.isNewAdminContract(), false);
    });

    it("should identify contract addresses", () => {
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const newAdmin = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("set_admin"),
          new Address(contractId).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        new Address(newAdmin).toScVal()
      );

      const setAdminEvent = SetAdminEvent.fromEvent(event);

      assertEquals(setAdminEvent.isAdminAccount(), false);
      assertEquals(setAdminEvent.isAdminContract(), true);
    });
  });

  describe("toTopicFilter()", () => {
    it("should create filter for any SAC set_admin event", () => {
      const filter = SetAdminEvent.toTopicFilter({});

      assertEquals(filter.length, 3);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1], null);
      assertEquals(filter[2], null);
    });

    it("should create filter for set_admin by specific admin", () => {
      const admin = Keypair.random().publicKey();
      const filter = SetAdminEvent.toTopicFilter({ admin });

      assertEquals(filter.length, 3);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1]?.switch().name, "scvAddress");
      assertEquals(filter[2], null);
    });
  });
});
