/** Context/file overview shared by Summary and the unselected Evidence view. */
export const summaryScript: string = String.raw`
function metrics(host, records, tests) {
  const values = [new Set([...records, ...(tests || [])].map((r) => r.file)).size, ...counts(records, tests)], names = ["Files", "Tests", "Passed", "Failed", "Skipped", "Unknown", "Executions"];
  const strip = el("div", undefined, "metrics");
  names.forEach((label, i) => {
    const item = el("div"); item.append(el("strong", number(values[i])), el("span", label)); strip.append(item);
  });
  host.append(strip);
}
function contextFiles(host) {
  const { records, tests } = selection();
  const visibleFiles = files.filter((f) => records.some((r) => r.file === f) || tests.some((r) => r.file === f));
  if (!visibleFiles.length) { host.append(el("p", "No matching evidence. Clear filters to browse all files.", "empty")); return; }
  const body = table(host, ["Context / file", "Tests", "Passed", "Failed", "Skipped", "Unknown", "Executions"]);
  body.id = "file-body";
  const base = state.file ? fileLabel(state.file).split("/").slice(0, -1).join("/") : state.scope;
  function level(path, depth) {
    const children = new Map();
    for (const f of visibleFiles) {
      const label = fileLabel(f);
      if (path && !label.startsWith(path + "/")) continue;
      const rest = path ? label.slice(path.length + 1) : label;
      const name = rest.split("/")[0], directory = rest.includes("/");
      const key = directory ? (path ? path + "/" : "") + name : f;
      if (!children.has(key)) children.set(key, { key, name, directory, files: [] });
      children.get(key).files.push(f);
    }
    for (const child of [...children.values()].sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name))) {
      const row = el("tr"), label = el("div", undefined, "file-name");
      label.style.paddingInlineStart = (depth * 18) + "px";
      if (child.directory) {
        const toggle = button(expanded.has(child.key) ? "▾" : "▸", () => {
          if (expanded.has(child.key)) expanded.delete(child.key); else expanded.add(child.key);
          render();
        }, "disclosure");
        toggle.setAttribute("aria-label", (expanded.has(child.key) ? "Collapse " : "Expand ") + child.key);
        toggle.setAttribute("aria-expanded", String(expanded.has(child.key))); label.append(toggle);
      }
      const open = button(child.name, () => child.directory
        ? navigate({ scope: child.key, file: "", record: "", group: "", page: "0" }) : openFile(child.key), "text-button");
      open.title = child.directory ? child.key : fileLabel(child.key);
      label.append(open, el("small", child.directory ? child.files.length + " files" : "Test file", "muted"));
      cell(row, label);
      const subset = records.filter((r) => child.files.includes(r.file));
      const values = counts(subset, tests.filter((r) => child.files.includes(r.file)));
      values.forEach((value, i) => {
        if ([2, 4].includes(i) && value) {
          cell(row, button(number(value), () => navigate({ tab: "evidence", scope: child.directory ? child.key : "", file: child.directory ? "" : child.key,
            record: "", test: i === 2 ? "failed" : "unknown", page: "0" }), "text-button"), "num");
        } else cell(row, number(value), "num");
      });
      body.append(row);
      if (child.directory && expanded.has(child.key)) level(child.key, depth + 1);
    }
  }
  level(base, 0);
}
function summaryView() {
  const host = $("summary-view"); host.replaceChildren();
  host.append(el("h2", state.file ? fileLabel(state.file) : state.scope || "All contexts"));
  const { records, tests } = selection(); metrics(host, records, tests);
  const executions = records.filter((r) => r.execution);
  const kinds = el("p", ["read", "invoke", "classic", "custom"].map((k) =>
    k + ": " + executions.filter((r) => r.execution.kind === k).length).join(" · "));
  host.append(kinds, el("p", "Counts follow the current context and filters. Execution errors are separate from test failures."));
  const health = el("details", undefined, "data-section");
  health.append(el("summary", "Run results and recording completeness"), el("p", "Run: " + report.runId),
    el("p", report.complete ? "Evidence reconciliation completed." : "Evidence is incomplete; inspect the diagnostics above."),
    el("p", report.exitCode === undefined ? "Runner exit code unavailable." : "Runner/source exit code: " + report.exitCode + ". Test counts describe recorded leaf tests, not the runner exit status."));
  if (report.exitCode && !tests.some((r) => status(r) === "failed")) health.append(el("p", "A nonzero exit with no selected failed tests can reflect filters, failures outside test bodies or a consolidated run containing later successful reruns. Check the source artifacts."));
  host.append(health, el("h3", "Test files")); contextFiles(host);
}
`;
