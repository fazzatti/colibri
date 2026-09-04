import type { xdr } from "stellar-sdk";
import type {
  ContractInterfaceAnalysis,
  ContractInterfaceDifference,
  ContractInterfaceFunction,
  ContractInterfaceType,
  ContractInterfaceTypeRequirement,
  ContractInterfaceValue,
  ContractSpec,
  ContractStandardProvider,
} from "@/contract/interface/types.ts";
import {
  normalizeContractInterfaceType,
  normalizeContractUserType,
} from "@/contract/interface/normalize-contract-interface.ts";

type ActualFunction = {
  readonly name: string;
  readonly inputs: readonly {
    readonly name: string;
    readonly type: ContractInterfaceType;
  }[];
  readonly outputs: readonly ContractInterfaceType[];
};

const sameValue = (
  left: ContractInterfaceValue,
  right: ContractInterfaceValue,
): boolean => JSON.stringify(left) === JSON.stringify(right);

const compareValues = (
  expected: ContractInterfaceValue,
  actual: ContractInterfaceValue,
  path: string,
): ContractInterfaceDifference[] => {
  if (sameValue(expected, actual)) return [];

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const differences: ContractInterfaceDifference[] = [];
    if (expected.length !== actual.length) {
      differences.push({
        path: `${path}.length`,
        expected: expected.length,
        actual: actual.length,
      });
    }
    const length = Math.min(expected.length, actual.length);
    for (let index = 0; index < length; index++) {
      differences.push(
        ...compareValues(expected[index], actual[index], `${path}[${index}]`),
      );
    }
    return differences;
  }

  if (
    expected !== null && actual !== null && !Array.isArray(expected) &&
    !Array.isArray(actual) && typeof expected === "object" &&
    typeof actual === "object"
  ) {
    const differences: ContractInterfaceDifference[] = [];
    const expectedRecord = expected as Readonly<
      Record<string, ContractInterfaceValue>
    >;
    const actualRecord = actual as Readonly<
      Record<string, ContractInterfaceValue>
    >;
    const keys = new Set([
      ...Object.keys(expectedRecord),
      ...Object.keys(actualRecord),
    ]);
    for (const key of keys) {
      const childPath = `${path}.${key}`;
      if (!(key in expectedRecord)) {
        differences.push({ path: childPath, actual: actualRecord[key] });
      } else if (!(key in actualRecord)) {
        differences.push({ path: childPath, expected: expectedRecord[key] });
      } else {
        differences.push(
          ...compareValues(
            expectedRecord[key],
            actualRecord[key],
            childPath,
          ),
        );
      }
    }
    return differences;
  }

  return [{ path, expected, actual }];
};

const compareRequirement = (
  requirement: ContractInterfaceTypeRequirement,
  actual: ContractInterfaceType,
  path: string,
  variables: Map<string, ContractInterfaceType>,
): ContractInterfaceDifference[] => {
  if (requirement.kind === "exact") {
    return compareValues(requirement.type, actual, path);
  }

  if (!requirement.allowedTypes.some((allowed) => sameValue(allowed, actual))) {
    return [{
      path,
      expected: {
        variable: requirement.name,
        allowed_types: requirement.allowedTypes,
      },
      actual,
    }];
  }

  const captured = variables.get(requirement.name);
  if (!captured) {
    variables.set(requirement.name, actual);
    return [];
  }
  return compareValues(captured, actual, path);
};

const compareFunction = (
  expected: ContractInterfaceFunction,
  actual: ActualFunction,
  variables: Map<string, ContractInterfaceType>,
): ContractInterfaceDifference[] => {
  const differences: ContractInterfaceDifference[] = [];
  if (expected.inputs.length !== actual.inputs.length) {
    differences.push({
      path: "inputs.length",
      expected: expected.inputs.length,
      actual: actual.inputs.length,
    });
  }
  for (
    let index = 0;
    index < Math.min(expected.inputs.length, actual.inputs.length);
    index++
  ) {
    const expectedInput = expected.inputs[index];
    const actualInput = actual.inputs[index];
    if (expectedInput.name !== actualInput.name) {
      differences.push({
        path: `inputs[${index}].name`,
        expected: expectedInput.name,
        actual: actualInput.name,
      });
    }
    differences.push(
      ...compareRequirement(
        expectedInput.type,
        actualInput.type,
        `inputs[${index}].type`,
        variables,
      ),
    );
  }

  if (expected.outputs.length !== actual.outputs.length) {
    differences.push({
      path: "outputs.length",
      expected: expected.outputs.length,
      actual: actual.outputs.length,
    });
  }
  for (
    let index = 0;
    index < Math.min(expected.outputs.length, actual.outputs.length);
    index++
  ) {
    differences.push(
      ...compareRequirement(
        expected.outputs[index],
        actual.outputs[index],
        `outputs[${index}]`,
        variables,
      ),
    );
  }
  return differences;
};

const actualFunction = (func: xdr.ScSpecFunctionV0): ActualFunction => ({
  name: func.name.toString(),
  inputs: func.inputs.map((input) => ({
    name: input.name.toString(),
    type: normalizeContractInterfaceType(input.type),
  })),
  outputs: func.outputs.map(normalizeContractInterfaceType),
});

/**
 * Analyzes whether a Stellar SDK contract specification structurally matches
 * one versioned SEP interface provider.
 *
 * Required function names, input names, ordered input/output types, reusable
 * constrained type variables, and user-defined types are checked. Additional
 * contract functions and types are reported but do not make the match fail.
 */
export const analyzeContractInterface = (
  spec: ContractSpec,
  provider: ContractStandardProvider,
): ContractInterfaceAnalysis => {
  const functions = spec.funcs().map(actualFunction);
  const functionsByName = new Map(functions.map((func) => [func.name, func]));
  const expectedFunctionNames = new Set(
    provider.interface.functions.map(({ name }) => name),
  );
  const missingFunctions: string[] = [];
  const incompatibleFunctions:
    ContractInterfaceAnalysis["incompatibleFunctions"][number][] = [];
  const variables = new Map<string, ContractInterfaceType>();

  for (const expected of provider.interface.functions) {
    const actual = functionsByName.get(expected.name);
    if (!actual) {
      missingFunctions.push(expected.name);
      continue;
    }
    const differences = compareFunction(expected, actual, variables);
    if (differences.length > 0) {
      incompatibleFunctions.push({ name: expected.name, differences });
    }
  }

  const userTypes = spec.entries
    .map(normalizeContractUserType)
    .filter((entry) => entry !== undefined);
  const userTypesByName = new Map(
    userTypes.map((entry) => [entry.name, entry]),
  );
  const expectedTypeNames = new Set(
    provider.interface.types.map(({ name }) => name),
  );
  const missingTypes: ContractInterfaceAnalysis["missingTypes"][number][] = [];
  const incompatibleTypes:
    ContractInterfaceAnalysis["incompatibleTypes"][number][] = [];

  for (const expected of provider.interface.types) {
    const actual = userTypesByName.get(expected.name);
    if (!actual) {
      missingTypes.push({ kind: expected.kind, name: expected.name });
      continue;
    }
    if (actual.kind !== expected.kind) {
      incompatibleTypes.push({
        kind: expected.kind,
        name: expected.name,
        differences: [{
          path: "kind",
          expected: expected.kind,
          actual: actual.kind,
        }],
      });
      continue;
    }
    const differences = compareValues(
      expected.definition,
      actual.definition,
      "definition",
    );
    if (differences.length > 0) {
      incompatibleTypes.push({
        kind: expected.kind,
        name: expected.name,
        differences,
      });
    }
  }

  const additionalFunctions = functions
    .filter(({ name }) => !expectedFunctionNames.has(name))
    .map(({ name }) => name);
  const additionalTypes = userTypes
    .filter(({ name }) => !expectedTypeNames.has(name))
    .map(({ kind, name }) => ({ kind, name }));

  return {
    matches: missingFunctions.length === 0 &&
      incompatibleFunctions.length === 0 && missingTypes.length === 0 &&
      incompatibleTypes.length === 0,
    missingFunctions,
    incompatibleFunctions,
    additionalFunctions,
    missingTypes,
    incompatibleTypes,
    additionalTypes,
  };
};
