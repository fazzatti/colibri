const STELLAR_CLI_VERSION = "26.1.0";
const STELLAR_CLI_IMAGE =
  "docker.io/stellar/stellar-cli@sha256:ccdebe3bd4af47e01f275c3da6caeb2752d02b06bc8bc1b3db534432498810c0";
const RUSTUP_TOOLCHAIN = "1.95.0";
const PACKAGE = "build-verification-upgradeable-contract";

const check = Deno.args.includes("--check");
const root = new URL("../", import.meta.url);
const sourceDirectory = new URL(
  "_internal/build-verification/contracts/upgradeable/",
  root,
);
const fixtureDirectory = new URL(
  "_internal/build-verification/fixtures/",
  root,
);
const archiveUrl = new URL("upgradeable-source.tar.gz", fixtureDirectory);
const obsoleteArchiveUrl = new URL("upgradeable-source.tar", fixtureDirectory);
const networkProbeArchiveUrl = new URL(
  "upgradeable-network-required-source.tar",
  fixtureDirectory,
);
const v1Url = new URL("upgradeable-v1.wasm", fixtureDirectory);
const v2Url = new URL("upgradeable-v2.wasm", fixtureDirectory);
const manifestUrl = new URL("manifest.json", fixtureDirectory);

const encoder = new TextEncoder();

const run = async (
  executable: string,
  args: readonly string[],
  cwd = root.pathname,
): Promise<string> => {
  const output = await new Deno.Command(executable, {
    args: [...args],
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) {
    throw new Error(
      `${executable} ${args.join(" ")} failed:\n${
        new TextDecoder().decode(output.stderr)
      }`,
    );
  }
  return new TextDecoder().decode(output.stdout).trim();
};

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const octal = (value: number, width: number): Uint8Array =>
  encoder.encode(value.toString(8).padStart(width - 1, "0") + "\0");

const tarHeader = (
  path: string,
  size: number,
  directory: boolean,
): Uint8Array => {
  const normalizedPath = directory ? path.replace(/\/$/, "") : path;
  const pathBytes = encoder.encode(normalizedPath);
  let name = normalizedPath;
  let prefix = "";
  if (pathBytes.length > 100) {
    for (let index = normalizedPath.lastIndexOf("/"); index > 0;) {
      const candidatePrefix = normalizedPath.slice(0, index);
      const candidateName = normalizedPath.slice(index + 1);
      if (
        encoder.encode(candidatePrefix).length <= 155 &&
        encoder.encode(candidateName).length <= 100
      ) {
        prefix = candidatePrefix;
        name = candidateName;
        break;
      }
      index = normalizedPath.lastIndexOf("/", index - 1);
    }
    if (!prefix) {
      throw new Error(`Fixture path cannot be encoded as ustar: ${path}`);
    }
  }
  const header = new Uint8Array(512);
  header.set(encoder.encode(name), 0);
  header.set(octal(directory ? 0o755 : 0o644, 8), 100);
  header.set(octal(0, 8), 108);
  header.set(octal(0, 8), 116);
  header.set(octal(size, 12), 124);
  header.set(octal(0, 12), 136);
  header.fill(0x20, 148, 156);
  header[156] = directory ? 0x35 : 0x30;
  header.set(encoder.encode("ustar\0"), 257);
  header.set(encoder.encode("00"), 263);
  header.set(encoder.encode("root"), 265);
  header.set(encoder.encode("root"), 297);
  header.set(encoder.encode(prefix), 345);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  const encodedChecksum = encoder.encode(
    checksum.toString(8).padStart(6, "0") + "\0 ",
  );
  header.set(encodedChecksum, 148);
  return header;
};

const concatenate = (chunks: readonly Uint8Array[]): Uint8Array => {
  const output = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

const createNetworkProbeArchive = async (): Promise<Uint8Array> => {
  const files = ["Cargo.lock", "Cargo.toml", "README.md", "src/lib.rs"];
  const chunks: Uint8Array[] = [
    tarHeader("upgradeable-source/", 0, true),
    tarHeader("upgradeable-source/src/", 0, true),
  ];
  for (const path of files) {
    const bytes = await Deno.readFile(new URL(path, sourceDirectory));
    chunks.push(
      tarHeader(`upgradeable-source/${path}`, bytes.length, false),
      bytes,
      new Uint8Array((512 - (bytes.length % 512)) % 512),
    );
  }
  chunks.push(new Uint8Array(1024));
  return concatenate(chunks);
};

type FixtureArchiveEntry = {
  readonly directory: boolean;
  readonly relativePath: string;
};

const collectArchiveEntries = async (
  directory: string,
  relativePrefix = "",
): Promise<FixtureArchiveEntry[]> => {
  const entries: FixtureArchiveEntry[] = [];
  const children = [];
  for await (const child of Deno.readDir(directory)) children.push(child);
  children.sort((left, right) => left.name.localeCompare(right.name));
  for (const child of children) {
    const relativePath = relativePrefix
      ? `${relativePrefix}/${child.name}`
      : child.name;
    const absolutePath = `${directory}/${child.name}`;
    if (child.isSymlink) {
      throw new Error(
        `Fixture source cannot contain symlinks: ${relativePath}`,
      );
    }
    entries.push({ directory: child.isDirectory, relativePath });
    if (child.isDirectory) {
      entries.push(...await collectArchiveEntries(absolutePath, relativePath));
    }
  }
  return entries;
};

const createDirectoryArchive = async (
  directory: string,
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [
    tarHeader("upgradeable-source/", 0, true),
  ];
  for (const entry of await collectArchiveEntries(directory)) {
    const path = `upgradeable-source/${entry.relativePath}`;
    if (entry.directory) {
      chunks.push(tarHeader(`${path}/`, 0, true));
      continue;
    }
    const bytes = await Deno.readFile(`${directory}/${entry.relativePath}`);
    chunks.push(
      tarHeader(path, bytes.length, false),
      bytes,
      new Uint8Array((512 - (bytes.length % 512)) % 512),
    );
  }
  chunks.push(new Uint8Array(1024));
  return concatenate(chunks);
};

const gzip = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const stream = new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(
    new CompressionStream("gzip"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const createVendoredSource = async (): Promise<{
  readonly archive: Uint8Array;
  readonly directory: string;
  readonly temporaryRoot: string;
}> => {
  const temporaryRoot = await Deno.makeTempDir({
    prefix: "colibri-build-verification-fixture-",
  });
  const directory = `${temporaryRoot}/upgradeable-source`;
  await Deno.mkdir(`${directory}/src`, { recursive: true });
  for (const path of ["Cargo.lock", "Cargo.toml", "README.md", "src/lib.rs"]) {
    await Deno.copyFile(new URL(path, sourceDirectory), `${directory}/${path}`);
  }
  await run(
    "cargo",
    ["vendor", "--locked", "--versioned-dirs", "vendor"],
    directory,
  );
  await Deno.mkdir(`${directory}/.cargo`, { recursive: true });
  await Deno.writeTextFile(
    `${directory}/.cargo/config.toml`,
    `[source.crates-io]
replace-with = "vendored-sources"

[source.vendored-sources]
directory = "vendor"

[net]
offline = true
`,
  );
  return {
    archive: await gzip(await createDirectoryArchive(directory)),
    directory,
    temporaryRoot,
  };
};

const sameFile = async (url: URL, expected: Uint8Array): Promise<boolean> => {
  try {
    const actual = await Deno.readFile(url);
    return actual.length === expected.length &&
      actual.every((byte, index) => byte === expected[index]);
  } catch (cause) {
    if (cause instanceof Deno.errors.NotFound) return false;
    throw cause;
  }
};

const build = async (
  sourceSha256: string,
  buildSourceDirectory: string,
  feature?: "v2",
): Promise<Uint8Array> => {
  await Deno.remove(`${buildSourceDirectory}/target`, { recursive: true })
    .catch((cause) => {
      if (!(cause instanceof Deno.errors.NotFound)) throw cause;
    });
  const options = [
    "--locked",
    `--package=${PACKAGE}`,
    "--optimize",
    ...(feature ? [`--features=${feature}`] : []),
  ];
  const args = [
    "run",
    "--rm",
    "--platform=linux/amd64",
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--tmpfs=/tmp:rw,nosuid,nodev,size=268435456,mode=1777",
    "--tmpfs=/stellar/.cargo/registry:rw,nosuid,nodev,size=1073741824,mode=1777",
    "--tmpfs=/stellar/.cargo/git:rw,nosuid,nodev,size=536870912,mode=1777",
    `--env=RUSTUP_TOOLCHAIN=${RUSTUP_TOOLCHAIN}`,
    `--volume=${buildSourceDirectory}:/source:rw`,
    STELLAR_CLI_IMAGE,
    "contract",
    "build",
    ...options,
    "--meta",
    `bldimg=${STELLAR_CLI_IMAGE}`,
    ...options.flatMap((option) => ["--meta", `bldopt=${option}`]),
    "--meta",
    `source_sha256=${sourceSha256}`,
  ];
  await run("docker", args);
  return await Deno.readFile(
    `${buildSourceDirectory}/target/wasm32v1-none/release/build_verification_upgradeable_contract.wasm`,
  );
};

const stellarVersion = await run("stellar", ["--version"]);
if (!stellarVersion.includes(`stellar ${STELLAR_CLI_VERSION}`)) {
  throw new Error(
    `Expected Stellar CLI ${STELLAR_CLI_VERSION}, got ${stellarVersion}`,
  );
}

if (
  !(await Deno.stat(new URL("Cargo.lock", sourceDirectory)).catch(() => null))
) {
  await run(
    "cargo",
    [
      "generate-lockfile",
      "--manifest-path",
      sourceDirectory.pathname + "Cargo.toml",
    ],
  );
}

const networkProbeArchive = await createNetworkProbeArchive();
const vendoredSource = await createVendoredSource();
try {
  const archive = vendoredSource.archive;
  const sourceSha256 = await sha256(archive);
  const v1 = await build(sourceSha256, vendoredSource.directory);
  const v2 = await build(sourceSha256, vendoredSource.directory, "v2");
  const manifest = encoder.encode(
    `${
      JSON.stringify(
        {
          stellarCli: STELLAR_CLI_VERSION,
          image: STELLAR_CLI_IMAGE,
          rustupToolchain: RUSTUP_TOOLCHAIN,
          sourceSha256,
          networkProbeSourceSha256: await sha256(networkProbeArchive),
          artifacts: {
            "upgradeable-v1.wasm": await sha256(v1),
            "upgradeable-v2.wasm": await sha256(v2),
          },
        },
        null,
        2,
      )
    }\n`,
  );

  const outputs = [
    [archiveUrl, archive],
    [networkProbeArchiveUrl, networkProbeArchive],
    [v1Url, v1],
    [v2Url, v2],
    [manifestUrl, manifest],
  ] as const;
  if (check) {
    const stale: string[] = [];
    for (const [url, bytes] of outputs) {
      if (!(await sameFile(url, bytes))) {
        stale.push(url.pathname.split("/").at(-1)!);
      }
    }
    if (await Deno.stat(obsoleteArchiveUrl).catch(() => null)) {
      stale.push(obsoleteArchiveUrl.pathname.split("/").at(-1)!);
    }
    if (stale.length > 0) {
      throw new Error(
        `Stale build-verification fixtures: ${stale.join(", ")}`,
      );
    }
  } else {
    await Deno.mkdir(fixtureDirectory, { recursive: true });
    for (const [url, bytes] of outputs) await Deno.writeFile(url, bytes);
    await Deno.remove(obsoleteArchiveUrl).catch((cause) => {
      if (!(cause instanceof Deno.errors.NotFound)) throw cause;
    });
  }
} finally {
  await Deno.remove(vendoredSource.temporaryRoot, { recursive: true })
    .catch(() => undefined);
  await Deno.remove(new URL("target/", sourceDirectory), { recursive: true })
    .catch(() => undefined);
}
