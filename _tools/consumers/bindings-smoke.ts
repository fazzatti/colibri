/** Portable renderer and Soroban value consumer shared by pre/post-publication checks. */
import { generateBindings } from "@colibri/contract-bindings";
import { Spec } from "stellar-sdk/contract";
import { xdr } from "stellar-sdk";
import {
  SorobanBytesN,
  SorobanString,
  SorobanSymbol,
  SorobanU32,
  SorobanValueError,
  SorobanVec,
} from "@colibri/core/values";
import {
  type SorobanStringInput,
  SorobanSymbol as RootSymbol,
  type SorobanVecInput,
} from "@colibri/core";
if (RootSymbol !== SorobanSymbol) {
  throw new Error("Value constructor identity changed");
}
const value = new SorobanSymbol("ADMIN");
if (SorobanSymbol.type.fromXdr(value.toXdr("base64")).value !== "ADMIN") {
  throw new Error("Value encoding changed");
}
const text: SorobanVecInput<SorobanStringInput, string> = new SorobanVec([
  new SorobanString("hello"),
], SorobanString.type);
const fixed = new SorobanBytesN(new Uint8Array(32), 32);
const length: 32 = fixed.value.length;
if (length !== 32 || !text) throw new Error("Value type mismatch");
let rejected = false;
try {
  new SorobanU32(-1);
} catch (error) {
  rejected = error instanceof SorobanValueError && error.code === "SV_001";
}
if (!rejected) throw new Error("Value validation missing");
const spec = new Spec([
  xdr.ScSpecEntry.scSpecEntryFunctionV0(
    new xdr.ScSpecFunctionV0({
      name: "ping",
      doc: "Ping",
      inputs: [],
      outputs: [],
    }),
  ),
]);
const plan = generateBindings(spec, { className: "PingClient" });
if (!plan.files["index.ts"].includes("class PingClient extends Contract")) {
  throw new Error("Portable bindings rendering failed");
}
