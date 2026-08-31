import { assert, assertEquals, assertFalse } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TEST_DIGEST, testImageDetails } from "@/testing.test.ts";
import { DefaultBuildCommandPolicy } from "@/core/policy/build-command.ts";
import { DefaultBuildOptionPolicy } from "@/core/policy/build-options.ts";
import { OfficialStellarImagePolicy } from "@/core/policy/official-stellar-image.ts";
import { DefaultSourceRetrievalPolicy } from "@/core/policy/source-retrieval.ts";
import { createDefaultVerificationPolicy } from "@/core/policy/verification.ts";
import {
  CommandPolicyRejectedError,
  OptionPolicyRejectedError,
} from "@/core/policy/error.ts";

describe("core verification policies", () => {
  it("accepts only the exact default Stellar contract-build command", () => {
    const policy = new DefaultBuildCommandPolicy();
    assert(policy.evaluate(["contract", "build"]).accepted);
    for (
      const command of [
        [],
        ["contract"],
        ["contract", "build", "extra"],
        ["contract", "invoke"],
      ]
    ) {
      const decision = policy.evaluate(command);
      assertFalse(decision.accepted);
      assertEquals(decision.reasons.length, 1);
    }
  });

  it("accepts the versioned option allow-list and safe relative paths", () => {
    const policy = new DefaultBuildOptionPolicy();
    const options = [
      "--all-features",
      "--ignore-checks",
      "--locked",
      "--no-default-features",
      "--offline",
      "--optimize",
      "--release",
      "--wasm32v1-none",
      "--features=a,b",
      "--manifest-path=contracts/Cargo.toml",
      "--package=hello",
      "--profile=production",
    ];
    assert(policy.evaluate(options, ["contract", "build"]).accepted);
    for (
      const option of [
        "",
        "--unknown",
        "--package",
        "--package=",
        "--manifest-path=/tmp/Cargo.toml",
        "--manifest-path=../Cargo.toml",
        "--manifest-path=contracts\\Cargo.toml",
        "--manifest-path=.",
        "--manifest-path=bad\0path",
      ]
    ) {
      assertFalse(
        policy.evaluate([option], ["contract", "build"]).accepted,
        option,
      );
    }
    assertFalse(
      policy.evaluate(
        ["--package=a", "--package=b"],
        ["contract", "build"],
      ).accepted,
    );
    assertFalse(policy.evaluate([], ["contract", "invoke"]).accepted);
  });

  it("evaluates schemes, credentials, addresses, and explicit exceptions", () => {
    const policy = new DefaultSourceRetrievalPolicy();
    assert(
      policy.evaluate({
        url: "https://example.com/source.tar.gz",
        redirect: 0,
        resolvedAddresses: [
          "93.184.216.34",
          "2606:2800:220:1:248:1893:25c8:1946",
        ],
      }).accepted,
    );
    const rejectedFacts = [
      { url: "not a URL", addresses: ["93.184.216.34"] },
      { url: "http://example.com/a", addresses: ["93.184.216.34"] },
      { url: "https://u:p@example.com/a", addresses: ["93.184.216.34"] },
      { url: "https://example.com/a", addresses: [] },
      { url: "https://example.com/a", addresses: ["127.0.0.1"] },
      { url: "https://example.com/a", addresses: ["::1"] },
      { url: "https://example.com/a", addresses: ["::ffff:10.0.0.1"] },
    ];
    for (const facts of rejectedFacts) {
      assertFalse(
        policy.evaluate({
          url: facts.url,
          redirect: 0,
          resolvedAddresses: facts.addresses,
        }).accepted,
      );
    }
    const local = new DefaultSourceRetrievalPolicy({
      allowHttp: true,
      allowPrivateNetwork: true,
    });
    assert(
      local.evaluate({
        url: "http://127.0.0.1/source.tar",
        redirect: 1,
        resolvedAddresses: ["127.0.0.1"],
      }).accepted,
    );
    assertEquals(
      local.evaluate({
        url: "http://127.0.0.1/source.tar",
        redirect: 2,
        resolvedAddresses: ["127.0.0.1"],
      }).warnings,
      ["Source retrieval followed redirect 2."],
    );
    assert(
      new DefaultSourceRetrievalPolicy({ allowedHosts: ["LOCALHOST"] })
        .evaluate({
          url: "https://localhost/source.tar",
          redirect: 0,
          resolvedAddresses: ["127.0.0.1"],
        }).accepted,
    );
  });

  it("covers private IPv4 and IPv6 ranges without treating them as public", () => {
    const policy = new DefaultSourceRetrievalPolicy();
    const privateAddresses = [
      "invalid",
      "1.2.3",
      "1.2.3.999",
      "0.0.0.1",
      "10.0.0.1",
      "100.64.0.1",
      "169.254.1.1",
      "172.16.0.1",
      "192.0.2.1",
      "192.168.0.1",
      "198.18.0.1",
      "224.0.0.1",
      "::",
      "fc00::1",
      "fd00::1",
      "fe80::1",
      "fe90::1",
      "fea0::1",
      "feb0::1",
      "ff00::1",
      "2001:db8::1",
    ];
    for (const address of privateAddresses) {
      assertFalse(
        policy.evaluate({
          url: "https://example.com/source.tar",
          redirect: 0,
          resolvedAddresses: [address],
        }).accepted,
        address,
      );
    }
    const publicAddresses = [
      "1.2.3.4",
      "100.63.255.255",
      "100.128.0.1",
      "169.253.255.255",
      "169.255.0.1",
      "172.15.255.255",
      "172.32.0.1",
      "191.255.255.255",
      "192.1.0.1",
      "198.17.255.255",
      "198.20.0.1",
      "223.255.255.255",
      "2606:4700:4700::1111",
    ];
    for (const address of publicAddresses) {
      assert(
        policy.evaluate({
          url: "https://example.com/source.tar",
          redirect: 0,
          resolvedAddresses: [address],
        }).accepted,
        address,
      );
    }
  });

  it("records official image trust, runtime, provenance, and SBOM checks", () => {
    const policy = new OfficialStellarImagePolicy();
    const accepted = policy.evaluate(testImageDetails());
    assert(accepted.accepted);
    assertEquals(accepted.warnings.length, 2);

    const provenance = {
      present: true,
      parsed: true,
      signatureVerified: false,
      predicateTypes: ["https://slsa.dev/provenance/v1"],
      subjectDigests: [TEST_DIGEST.slice(7)],
      sourceRepositories: [
        "https://github.com/stellar/stellar-cli-docker/",
      ],
    };
    const withAttestations = policy.evaluate(testImageDetails({
      provenance,
      sbom: { present: true, formats: ["spdx"] },
    }));
    assert(withAttestations.accepted);
    assertEquals(withAttestations.warnings.length, 1);
    assert(
      policy.evaluate(testImageDetails({
        provenance: {
          ...provenance,
          signatureVerified: true,
          subjectDigests: [TEST_DIGEST],
        },
        sbom: { present: true, formats: ["cyclonedx"] },
      })).accepted,
    );

    const invalidImages = [
      { registry: "registry.example.com" },
      { requestedDigest: `sha256:${"f".repeat(64)}` },
      { resolvedThroughIndex: true },
      { architecture: undefined },
      { entrypoint: ["sh"] },
      { workingDirectory: "/tmp" },
      { provenance: { ...provenance, parsed: false } },
      { provenance: { ...provenance, subjectDigests: ["f".repeat(64)] } },
      {
        provenance: {
          ...provenance,
          sourceRepositories: ["https://example.com"],
        },
      },
    ];
    for (const overrides of invalidImages) {
      assertFalse(policy.evaluate(testImageDetails(overrides)).accepted);
    }
    assert(
      new OfficialStellarImagePolicy({
        registry: "registry.example.com",
        repository: "org/image",
        sourceRepository: "https://example.com/source/",
      }).evaluate(testImageDetails({
        registry: "registry.example.com",
        repository: "org/image",
        provenance: {
          ...provenance,
          sourceRepositories: ["https://example.com/source"],
        },
      })).accepted,
    );
  });

  it("composes defaults while preserving caller policy replacements", () => {
    const custom = new DefaultBuildCommandPolicy();
    const defaults = createDefaultVerificationPolicy({ command: custom });
    assertEquals(defaults.command, custom);
    assert(defaults.options instanceof DefaultBuildOptionPolicy);
    assert(defaults.image instanceof OfficialStellarImagePolicy);
    assert(defaults.source instanceof DefaultSourceRetrievalPolicy);
  });

  it("uses stable fallback details for empty policy rejection reasons", () => {
    assertEquals(
      new CommandPolicyRejectedError(["contract", "invoke"], []).details,
      "The effective build command was rejected.",
    );
    assertEquals(
      new OptionPolicyRejectedError(["--unknown"], []).details,
      "The effective build options were rejected.",
    );
  });
});
