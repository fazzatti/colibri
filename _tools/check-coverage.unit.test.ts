import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { verifyCoverage } from "colibri-tools/check-coverage.ts";

const complete = `TN:
SF:/src/client.ts
FN:1,read
FNDA:3,read
FNF:1
FNH:1
DA:1,3
DA:2,2
LF:2
LH:2
BRDA:1,0,0,1
BRDA:1,0,1,2
BRF:2
BRH:2
end_of_record
`;

describe("exact aggregate coverage gate", () => {
  it("accepts fully covered sources including generated clients and files without functions", () => {
    assertEquals(
      verifyCoverage(complete.replaceAll("read", "end_of_record")).functions,
      1,
    );
    assertEquals(
      verifyCoverage(
        complete + complete.replace("/src/client.ts", "/generated/client.ts") +
          `SF:/src/constants.ts
FNF:0
FNH:0
DA:1,1
LF:1
LH:1
BRF:0
BRH:0
end_of_record
`,
      ),
      { files: 3, lines: 5, branches: 4, functions: 2 },
    );
  });

  it("fails independently for missed lines, uncalled functions and partial or untaken branches", () => {
    for (
      const [source, metric] of [
        [
          complete.replace("DA:2,2", "DA:2,0").replace("LH:2", "LH:1"),
          "lines 1/2",
        ],
        [
          complete.replace("FNDA:3,read", "FNDA:0,read").replace(
            "FNH:1",
            "FNH:0",
          ),
          "functions 0/1",
        ],
        ...["0", "-"].map((count) => [
          complete.replace("BRDA:1,0,1,2", `BRDA:1,0,1,${count}`).replace(
            "BRH:2",
            "BRH:1",
          ),
          "branches 1/2",
        ]),
      ]
    ) {
      assertThrows(() => verifyCoverage(source), Error, metric);
    }
  });

  it("rejects empty, truncated, duplicate and inconsistent reports instead of passing on incomplete evidence", () => {
    for (
      const invalid of [
        "",
        "TN:\n",
        complete.replace("end_of_record", ""),
        complete.replace("FNH:1\n", ""),
        complete.replace("BRH:2", "BRH:2\nBRH:2"),
        complete.replace("DA:2,2", "DA:2,0"),
        complete.replace("BRF:2", "BRF:-1"),
        complete.replace("FNF:1", "FNF:9007199254740992"),
        complete.replace("SF:/src/client.ts", "SF:"),
        complete + complete,
      ]
    ) assertThrows(() => verifyCoverage(invalid));
  });

  it("enforces success and failure through the real command entrypoint", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const path = directory + "/coverage.lcov";
      const invoke = () =>
        new Deno.Command(Deno.execPath(), {
          args: [
            "run",
            "--allow-read",
            new URL("./check-coverage.ts", import.meta.url).pathname,
            path,
          ],
          stdout: "piped",
          stderr: "piped",
        }).output();
      await Deno.writeTextFile(path, complete);
      const passed = await invoke();
      assertEquals(passed.code, 0);
      assertStringIncludes(
        new TextDecoder().decode(passed.stdout),
        "100% coverage",
      );
      await Deno.writeTextFile(
        path,
        complete.replace("BRDA:1,0,1,2", "BRDA:1,0,1,0").replace(
          "BRH:2",
          "BRH:1",
        ),
      );
      const failed = await invoke();
      assertEquals(failed.code, 1);
      assertStringIncludes(
        new TextDecoder().decode(failed.stderr),
        "branches 1/2",
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
