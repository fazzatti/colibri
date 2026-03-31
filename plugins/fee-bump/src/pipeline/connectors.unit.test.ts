import { assertEquals, assertRejects, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createRunContext, step } from "convee";
import {
  ColibriError,
  LocalSigner,
  NativeAccount,
  steps,
  type EnvelopeSigningRequirementsOutput,
  type FeeBumpConfig,
  type WrapFeeBumpOutput,
} from "@colibri/core";
import {
  envSignReqToSignEnvelope,
  inputToBuild,
  wrapFeeBumpToEnvelopeSigningRequirements,
} from "@/pipeline/connectors.ts";
import type { FeeBumpPipelineInput } from "@/pipeline/types.ts";

const seedStepOutput = async <Output>(
  context: ReturnType<typeof createRunContext>,
  stepId: string,
  output: Output,
) => {
  const seedStep = step(() => output, { id: stepId });
  await seedStep.runWith({ context: { parent: context } });
};

describe("fee-bump pipeline connectors", () => {
  const signer = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const feeBumpConfig: FeeBumpConfig = {
    source: signer.address(),
    fee: "10000000",
    signers: [signer.signer()],
  };

  it("converts fee-bump pipeline input to wrap-fee-bump input", () => {
    const transaction = { id: "tx" } as unknown as FeeBumpPipelineInput["transaction"];

    const connector = inputToBuild("Test Network", feeBumpConfig);
    const result = connector({ transaction });

    assertEquals(result.transaction, transaction);
    assertEquals(result.config, feeBumpConfig);
    assertEquals(result.networkPassphrase, "Test Network");
  });

  it("converts wrap-fee-bump output to envelope-signing-requirements input", () => {
    const transaction = { id: "fee-bump" } as unknown as WrapFeeBumpOutput;

    const result = wrapFeeBumpToEnvelopeSigningRequirements(transaction);

    assertEquals(result, { transaction });
  });

  it("transforms envelope requirements to sign-envelope input", async () => {
    const requirements: EnvelopeSigningRequirementsOutput = [];
    const transaction = { id: "fee-bump" } as unknown as WrapFeeBumpOutput;
    const context = createRunContext();

    await seedStepOutput(context, steps.WRAP_FEE_BUMP_STEP_ID, transaction);

    const connector = envSignReqToSignEnvelope(feeBumpConfig);
    const result = await connector.runWith(
      { context: { parent: context } },
      ...requirements,
    );

    assertExists(result);
    assertEquals(result.signatureRequirements, requirements);
    assertEquals(result.transaction, transaction);
    assertEquals(result.signers, feeBumpConfig.signers);
  });

  it("throws when the wrapped transaction step output is missing", async () => {
    const connector = envSignReqToSignEnvelope(feeBumpConfig);
    const context = createRunContext();

    await assertRejects(
      () => connector.runWith({ context: { parent: context } }),
      ColibriError,
      "Missing required step output",
    );
  });
});
