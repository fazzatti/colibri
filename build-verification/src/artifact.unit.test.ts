import { assertEquals, assertRejects } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import * as E from "@/error.ts";
import { selectBuildArtifact, snapshotBuildArtifacts } from "@/artifact.ts";

const directories: string[] = [];
const workspace = async (): Promise<string> => {
  const root = await Deno.makeTempDir();
  directories.push(root);
  await Deno.mkdir(`${root}/target/wasm32v1-none/release/deps`, {
    recursive: true,
  });
  return root;
};

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await Deno.remove(directory, { recursive: true });
  }
});

describe("build artifact selection", () => {
  it("selects one new or changed release wasm", async () => {
    const root = await workspace();
    const path = `${root}/target/wasm32v1-none/release/hello.wasm`;
    await Deno.writeFile(path, new Uint8Array([1]));
    const before = await snapshotBuildArtifacts(root);
    await Deno.writeFile(path, new Uint8Array([2]));
    const artifact = await selectBuildArtifact(root, before, []);
    assertEquals(artifact.path, path);
    assertEquals(artifact.wasm, new Uint8Array([2]));
  });

  it("ignores unchanged and deps artifacts", async () => {
    const root = await workspace();
    await Deno.writeFile(
      `${root}/target/wasm32v1-none/release/hello.wasm`,
      new Uint8Array([1]),
    );
    await Deno.writeFile(
      `${root}/target/wasm32v1-none/release/deps/dependency.wasm`,
      new Uint8Array([2]),
    );
    const before = await snapshotBuildArtifacts(root);
    await assertRejects(
      () => selectBuildArtifact(root, before, []),
      E.BuildArtifactNotFoundError,
    );
  });

  it("uses --package to select a hyphenated package name", async () => {
    const root = await workspace();
    const before = await snapshotBuildArtifacts(root);
    await Deno.writeFile(
      `${root}/target/wasm32v1-none/release/my_contract.wasm`,
      new Uint8Array([1]),
    );
    await Deno.writeFile(
      `${root}/target/wasm32v1-none/release/other.wasm`,
      new Uint8Array([2]),
    );
    const artifact = await selectBuildArtifact(root, before, [
      "--package=my-contract",
    ]);
    assertEquals(artifact.path.endsWith("/my_contract.wasm"), true);
  });

  it("rejects ambiguous artifacts instead of guessing", async () => {
    const root = await workspace();
    const before = await snapshotBuildArtifacts(root);
    await Deno.writeFile(
      `${root}/target/wasm32v1-none/release/a.wasm`,
      new Uint8Array([1]),
    );
    await Deno.writeFile(
      `${root}/target/wasm32v1-none/release/b.wasm`,
      new Uint8Array([2]),
    );
    await assertRejects(
      () => selectBuildArtifact(root, before, []),
      E.BuildArtifactAmbiguousError,
    );
  });

  it("wraps artifact traversal failures", async () => {
    const missing = "/definitely/missing/build-verification-workspace";
    await assertRejects(
      () => selectBuildArtifact(missing, new Map(), []),
      E.BuildArtifactReadFailedError,
    );
    await assertRejects(
      () => snapshotBuildArtifacts(missing),
      E.BuildArtifactSnapshotFailedError,
    );
  });
});
