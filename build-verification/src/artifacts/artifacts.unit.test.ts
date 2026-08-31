import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import {
  ArtifactCollectionFailedError,
  ArtifactLimitExceededError,
  BuildArtifactAmbiguousError,
  BuildArtifactNotFoundError,
  BuildArtifactReadFailedError,
  BuildArtifactSnapshotFailedError,
  UnsafeArtifactPathError,
} from "@/artifacts/error.ts";
import {
  assertSafeArtifactRelativePath,
  DefaultBuildArtifactCollector,
  readBuildArtifactCandidate,
} from "@/artifacts/collect.ts";
import { selectBuildArtifactCandidate } from "@/artifacts/select.ts";
import { TEST_LIMITS, testRecipe } from "@/testing.test.ts";

const directories: string[] = [];
const workspace = async (): Promise<string> => {
  const root = await Deno.makeTempDir();
  directories.push(root);
  await Deno.mkdir(`${root}/target/wasm32v1-none/release/deps`, {
    recursive: true,
  });
  await Deno.mkdir(`${root}/target/wasm32-unknown-unknown/custom`, {
    recursive: true,
  });
  return root;
};

afterEach(async () => {
  for (const path of directories.splice(0)) {
    await Deno.remove(path, { recursive: true }).catch(() => undefined);
  }
});

describe("build artifact collection and selection", () => {
  it("captures only new or changed eligible immutable Wasm candidates", async () => {
    const root = await workspace();
    const collector = new DefaultBuildArtifactCollector();
    const release = `${root}/target/wasm32v1-none/release/hello.wasm`;
    await Deno.writeFile(release, new Uint8Array([1]));
    await Deno.writeFile(
      `${root}/target/wasm32v1-none/release/deps/dependency.wasm`,
      new Uint8Array([9]),
    );
    await Deno.writeTextFile(
      `${root}/target/wasm32v1-none/release/readme`,
      "x",
    );
    const before = await collector.snapshot(root, TEST_LIMITS);
    await Deno.writeFile(release, new Uint8Array([2]));
    await Deno.writeFile(
      `${root}/target/wasm32-unknown-unknown/custom/other.wasm`,
      new Uint8Array([3]),
    );
    const candidates = await collector.collect(root, before, TEST_LIMITS);
    assertEquals(candidates.map(({ path }) => path).sort(), [
      "target/wasm32-unknown-unknown/custom/other.wasm",
      "target/wasm32v1-none/release/hello.wasm",
    ]);
    const changed = candidates.find(({ path }) => path.endsWith("hello.wasm"));
    assertEquals(changed?.bytes, new Uint8Array([2]));
    assertEquals(changed?.size, 1);
  });

  it("returns no candidates when outputs remain unchanged", async () => {
    const root = await workspace();
    const collector = new DefaultBuildArtifactCollector();
    await Deno.writeFile(
      `${root}/target/wasm32v1-none/release/hello.wasm`,
      new Uint8Array([1]),
    );
    const before = await collector.snapshot(root, TEST_LIMITS);
    assertEquals(await collector.collect(root, before, TEST_LIMITS), []);
  });

  it("enforces individual and aggregate artifact limits", async () => {
    const root = await workspace();
    const collector = new DefaultBuildArtifactCollector();
    await Deno.writeFile(
      `${root}/target/wasm32v1-none/release/a.wasm`,
      new Uint8Array([1, 2]),
    );
    await assertRejects(
      () => collector.snapshot(root, { ...TEST_LIMITS, maxArtifactBytes: 1 }),
      ArtifactLimitExceededError,
    );
    await Deno.writeFile(
      `${root}/target/wasm32v1-none/release/b.wasm`,
      new Uint8Array([3, 4]),
    );
    await assertRejects(
      () =>
        collector.collect(root, new Map(), {
          ...TEST_LIMITS,
          maxArtifactBytes: 3,
        }),
      ArtifactLimitExceededError,
    );
  });

  it("rejects symlink candidates and inaccessible source roots", async () => {
    const root = await workspace();
    const link = `${root}/target/wasm32v1-none/release/link.wasm`;
    await Deno.symlink(
      `${root}/target/wasm32v1-none/release/missing.wasm`,
      link,
    );
    await assertRejects(
      () => new DefaultBuildArtifactCollector().snapshot(root, TEST_LIMITS),
      UnsafeArtifactPathError,
    );
    await assertRejects(
      () =>
        new DefaultBuildArtifactCollector().snapshot(
          "/definitely/missing/build-workspace",
          TEST_LIMITS,
        ),
      BuildArtifactSnapshotFailedError,
    );
    await assertRejects(
      () =>
        new DefaultBuildArtifactCollector().collect(
          "/definitely/missing/build-workspace",
          new Map(),
          TEST_LIMITS,
        ),
      ArtifactCollectionFailedError,
    );
    await assertRejects(
      () =>
        new DefaultBuildArtifactCollector().collect(
          root,
          new Map(),
          TEST_LIMITS,
        ),
      UnsafeArtifactPathError,
    );
    await Deno.remove(link);

    const socketPath = `${root}/target/ignored.socket`;
    const socket = Deno.listen({ transport: "unix", path: socketPath });
    try {
      await new DefaultBuildArtifactCollector().snapshot(root, TEST_LIMITS);
    } finally {
      socket.close();
    }
  });

  it("keeps path validation, stat failures, and read failures distinct", async () => {
    for (const path of ["", "../escape.wasm", "bad\0name.wasm"]) {
      assertThrows(
        () => assertSafeArtifactRelativePath(path),
        UnsafeArtifactPathError,
      );
    }
    assertSafeArtifactRelativePath("target/release/contract.wasm");
    await assertRejects(
      () =>
        readBuildArtifactCandidate(
          "/definitely/missing/contract.wasm",
          "target/release/contract.wasm",
          TEST_LIMITS,
        ),
      BuildArtifactReadFailedError,
    );

    const root = await workspace();
    const path = `${root}/target/wasm32v1-none/release/unreadable.wasm`;
    await Deno.writeFile(path, new Uint8Array([1]), { mode: 0o000 });
    try {
      await assertRejects(
        () =>
          readBuildArtifactCandidate(
            path,
            "target/wasm32v1-none/release/unreadable.wasm",
            TEST_LIMITS,
          ),
        BuildArtifactReadFailedError,
      );
    } finally {
      await Deno.chmod(path, 0o600);
    }
  });

  it("selects by package and profile without guessing", () => {
    const candidates = [
      {
        path: "target/wasm32v1-none/release/my_contract.wasm",
        bytes: new Uint8Array([1]),
        size: 1,
        sha256: "a",
      },
      {
        path: "target/wasm32v1-none/custom/my_contract.wasm",
        bytes: new Uint8Array([2]),
        size: 1,
        sha256: "b",
      },
    ];
    assertEquals(
      selectBuildArtifactCandidate(
        candidates,
        testRecipe({
          options: ["--package=my-contract"],
        }),
      ).sha256,
      "a",
    );
    assertEquals(
      selectBuildArtifactCandidate(
        candidates,
        testRecipe({
          options: ["--package=my-contract", "--profile=custom"],
        }),
      ).sha256,
      "b",
    );
  });

  it("rejects missing and ambiguous recipe matches", () => {
    assertThrows(
      () => selectBuildArtifactCandidate([], testRecipe()),
      BuildArtifactNotFoundError,
    );
    const candidates = ["a", "b"].map((name) => ({
      path: `target/wasm32v1-none/release/${name}.wasm`,
      bytes: new Uint8Array(),
      size: 0,
      sha256: name,
    }));
    assertThrows(
      () => selectBuildArtifactCandidate(candidates, testRecipe()),
      BuildArtifactAmbiguousError,
    );
  });
});
