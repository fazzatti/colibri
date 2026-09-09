// deno-coverage-ignore-file
import { nativeToScVal, StrKey, xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";

export const contractId = StrKey.encodeContract(
  new Uint8Array(32),
) as `C${string}`;
export const symbol = (value: string) => xdr.ScVal.scvSymbol(value);
export const amount = () => nativeToScVal(42n, { type: "i128" });
export function eventEntry(
  format = xdr.ScSpecEventDataFormat.scSpecEventDataFormatMap,
  name = "Transfer",
  params?: xdr.ScSpecEventParamV0[],
  prefixTopics = ["transfer"],
): xdr.ScSpecEntry {
  return xdr.ScSpecEntry.scSpecEntryEventV0(
    new xdr.ScSpecEventV0({
      name,
      doc: "Token transfer.",
      lib: "",
      prefixTopics,
      dataFormat: format,
      params: params ?? [
        new xdr.ScSpecEventParamV0({
          name: "owner",
          doc: "Indexed owner",
          type: xdr.ScSpecTypeDef.scSpecTypeSymbol(),
          location:
            xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationTopicList,
        }),
        new xdr.ScSpecEventParamV0({
          name: "amount",
          doc: "Raw amount",
          type: xdr.ScSpecTypeDef.scSpecTypeI128(),
          location: xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationData,
        }),
      ],
    }),
  );
}
export function bindingSpec(): Spec {
  return new Spec([
    xdr.ScSpecEntry.scSpecEntryFunctionV0(
      new xdr.ScSpecFunctionV0({
        doc: "Balance",
        name: "balance",
        inputs: [
          new xdr.ScSpecFunctionInputV0({
            name: "owner",
            doc: "Owner",
            type: xdr.ScSpecTypeDef.scSpecTypeSymbol(),
          }),
        ],
        outputs: [xdr.ScSpecTypeDef.scSpecTypeI128()],
      }),
    ),
    xdr.ScSpecEntry.scSpecEntryFunctionV0(
      new xdr.ScSpecFunctionV0({
        doc: "Ping",
        name: "ping",
        inputs: [],
        outputs: [],
      }),
    ),
    eventEntry(),
  ]);
}
