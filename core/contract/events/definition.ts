import { xdr } from "stellar-sdk";
import type { Spec } from "@/contract/spec.ts";
import { Event } from "@/event/event.ts";
import { EventType } from "@/event/types.ts";
import { EventFilter } from "@/event/event-filter/index.ts";
import type { TopicFilter } from "@/event/event-filter/types.ts";
import type { ContractEventOptions } from "@/contract/events/types.ts";
import { requireMap, validateEventValue } from "@/contract/events/codec.ts";
import * as E from "@/contract/events/error.ts";
import {
  containsSorobanValue,
  needsExtendedCodec,
} from "@/contract/encoding/index.ts";
import { sorobanTypeFromSpec } from "@/soroban-types/codecs/custom.ts";

/** A decoded occurrence retaining all Colibri event metadata and raw XDR. */
export class ContractEvent<Data extends object = Record<string, unknown>>
  extends Event {
  /** Native fields decoded against the selected event declaration. */
  readonly fields: Readonly<Data>;
  /** Creates a decoded occurrence from an existing Colibri event. */
  constructor(event: Event, fields: Data) {
    super({ ...event, topic: event.scvalTopics, value: event.scvalValue });
    this.fields = Object.freeze({ ...fields });
  }
  /** Returns a declared native field with its generated TypeScript type. */
  get<Key extends keyof Data>(key: Key): Data[Key] {
    return this.fields[key];
  }
}

/** One event declaration, with decoding and indexed-field filters. No network I/O. */
export class ContractEventDefinition<
  Data extends object = Record<string, unknown>,
  Topics extends object = Record<string, unknown>,
> {
  /** Original declaration name. */
  readonly name: string;
  /** Zero-based occurrence among same-named declarations. */
  readonly occurrence: number;
  /** Creates a definition from an SDK spec and an optional emitting-contract restriction. */
  constructor(
    private readonly spec: Spec,
    private readonly declaration: xdr.ScSpecEventV0,
    occurrence = 0,
    private readonly options: ContractEventOptions = {},
  ) {
    this.options = { ...options };
    this.name = declaration.name.toString();
    this.occurrence = occurrence;
    const names = declaration.params.map((param) => param.name.toString());
    if (new Set(names).size !== names.length) {
      throw new E.INVALID_SPEC(`duplicate parameters in ${this.name}`);
    }
    if (declaration.prefixTopics.length + this.topicParams().length > 4) {
      throw new E.INVALID_SPEC(`too many topics in ${this.name}`);
    }
    if (
      declaration.dataFormat.name === "scSpecEventDataFormatSingleValue" &&
      this.dataParams().length !== 1
    ) {
      throw new E.INVALID_SPEC(
        `single-value event ${this.name} must have one data field`,
      );
    }
  }
  /** Checks the full declaration and optional contract restriction. */
  is(event: Event): boolean {
    return this.tryFromEvent(event) !== undefined;
  }
  /** Returns undefined for a nonmatching occurrence. */
  tryFromEvent(event: Event): ContractEvent<Data> | undefined {
    try {
      return this.fromEvent(event);
    } catch (cause) {
      if (cause instanceof E.DECODE_FAILED) return undefined;
      throw cause;
    }
  }
  /** Decodes a matching occurrence or throws a typed error. */
  fromEvent(event: Event): ContractEvent<Data> {
    try {
      if (
        event.type !== EventType.Contract ||
        (this.options.contractId &&
          event.contractId !== this.options.contractId)
      ) throw new E.DECODE_FAILED(this.name);
      const topics = event.scvalTopics.map((value) =>
        xdr.ScVal.fromXdr(value.toXdr())
      );
      const prefix = this.declaration.prefixTopics;
      const indexed = this.topicParams();
      if (topics.length !== prefix.length + indexed.length) {
        throw new E.DECODE_FAILED(this.name);
      }
      prefix.forEach((name, index) => {
        if (
          topics[index].type !== "scvSymbol" ||
          topics[index].value.toString() !== name.toString()
        ) throw new E.DECODE_FAILED(this.name);
      });
      const fields: Record<string, unknown> = Object.create(null);
      indexed.forEach((param, index) => {
        fields[param.name.toString()] = this.decode(
          topics[prefix.length + index],
          param.type,
        );
      });
      this.decodeData(xdr.ScVal.fromXdr(event.scvalValue.toXdr()), fields);
      return new ContractEvent(event, fields as Data);
    } catch (cause) {
      if (cause instanceof E.DECODE_FAILED) throw cause;
      throw new E.DECODE_FAILED(this.name, cause);
    }
  }
  /** Creates a Colibri topic filter; omitted indexed fields become wildcards. */
  toTopicFilter(values: Partial<Topics> = {}): TopicFilter {
    try {
      const params = this.topicParams();
      if (
        Object.keys(values).some((key) =>
          !params.some((param) => param.name.toString() === key)
        )
      ) throw new E.INVALID_FILTER(this.name);
      const topics = containsSorobanValue(values) || params.some((param) =>
          needsExtendedCodec(this.spec, param.type)
        )
        ? [
          ...this.declaration.prefixTopics.map((topic) =>
            xdr.ScVal.scvSymbol(topic.toString()).toXdr("base64")
          ),
          ...params.map((param) => {
            const value =
              (values as Record<string, unknown>)[param.name.toString()];
            return Object.hasOwn(values, param.name.toString())
              ? sorobanTypeFromSpec(this.spec, param.type).encodeUnknown(value)
                .toXdr("base64")
              : "*";
          }),
        ]
        : this.spec.eventTopicFilter(
          this.name,
          { ...values },
          this.occurrence,
        );
      // An event with no topics needs RPC's trailing wildcard filter.
      if (topics.length === 0) {
        return ["**"];
      }
      return topics.map((value) =>
        value === "*" ? "*" : xdr.ScVal.fromXdr(value, "base64")
      ) as TopicFilter;
    } catch (cause) {
      if (cause instanceof E.INVALID_FILTER) throw cause;
      throw new E.INVALID_FILTER(this.name, cause);
    }
  }
  /** Creates a full filter, scoped to the contract when this definition is bound. */
  toEventFilter(values: Partial<Topics> = {}): EventFilter {
    return new EventFilter({
      type: EventType.Contract,
      contractIds: this.options.contractId
        ? [this.options.contractId]
        : undefined,
      topics: [this.toTopicFilter(values)],
    });
  }
  /** Selects the ordered indexed fields. */
  private topicParams(): xdr.ScSpecEventParamV0[] {
    return this.declaration.params.filter((param) =>
      param.location.name === "scSpecEventParamLocationTopicList"
    );
  }
  /** Selects the ordered payload fields. */
  private dataParams(): xdr.ScSpecEventParamV0[] {
    return this.declaration.params.filter((param) =>
      param.location.name === "scSpecEventParamLocationData"
    );
  }
  /** Validates a field before native decoding. */
  private decode(value: xdr.ScVal, type: xdr.ScSpecTypeDef): unknown {
    if (needsExtendedCodec(this.spec, type)) {
      return sorobanTypeFromSpec(this.spec, type).decode(value);
    }
    validateEventValue(this.spec, value, type);
    return this.spec.scValToNative(value, type);
  }
  /** Decodes the declared payload format into named fields. */
  private decodeData(value: xdr.ScVal, fields: Record<string, unknown>): void {
    const params = this.dataParams();
    let values: xdr.ScVal[];
    switch (this.declaration.dataFormat.name) {
      case "scSpecEventDataFormatSingleValue":
        values = [value];
        break;
      case "scSpecEventDataFormatVec": {
        if (value.type !== "scvVec" || value.value?.length !== params.length) {
          throw new E.DECODE_FAILED(this.name);
        }
        values = value.value!;
        break;
      }
      case "scSpecEventDataFormatMap": {
        const map = requireMap(value);
        if (
          map.length !== params.length ||
          new Set(map.map((entry) => entry.key.toXdr("base64"))).size !==
            map.length
        ) throw new E.DECODE_FAILED(this.name);
        values = params.map((param) => {
          const entry = map.find((entry) =>
            entry.key.type === "scvSymbol" &&
            entry.key.value.toString() === param.name.toString()
          );
          if (!entry) throw new E.DECODE_FAILED(this.name);
          return entry.val;
        });
        break;
      }
      default:
        throw new E.INVALID_SPEC(`unknown data format in ${this.name}`);
    }
    params.forEach((param, index) => {
      fields[param.name.toString()] = this.decode(values[index], param.type);
    });
  }
}
