/** Summary hierarchy and the flat file index used when no evidence is selected. */
export const summaryScript: string = String.raw`
function metrics(host, records, tests) {
  const values = [new Set([...records, ...(tests || [])].map((r) => r.file)).size, ...counts(records, tests)], names = ["Files", "Tests", "Passed", "Failed", "Skipped", "Unknown", "Pipeline calls"];
  const strip = el("div", undefined, "metrics");
  names.forEach((label, i) => {
    const item = el("div"); item.append(el("strong", number(values[i])), el("span", label)); strip.append(item);
  });
  host.append(strip);
}
function contextFiles(host, flat = false) {
  const { records, tests } = selection();
  const visibleFiles = files.filter((f) => records.some((r) => r.file === f) || tests.some((r) => r.file === f));
  if (!visibleFiles.length) { host.append(el("p", "No matching evidence. Clear filters to browse all files.", "empty")); return; }
  const body = table(host, [flat ? "Test file" : "Context / file", "Tests", "Passed", "Failed", "Skipped", "Unknown", "Pipeline calls"]);
  body.id = "file-body";
  function draw(child, depth) {
    const row = el("tr"), open = button("", () => {
      if (!child.directory) { openFile(child.key); return; }
      if (expanded.has(child.key)) expanded.delete(child.key); else expanded.add(child.key);
      render();
    }, "row-button");
    open.style.paddingInlineStart = (depth * 20 + 8) + "px";
    open.title = child.directory ? child.key : fileLabel(child.key);
    disclosureLabel(open, child.name, child.directory ? expanded.has(child.key) : undefined, child.directory ? "folder" : "test");
    if (child.directory) {
      open.dataset.context = child.key;
      open.setAttribute("aria-label", (expanded.has(child.key) ? "Collapse " : "Expand ") + child.key);
      open.append(el("small", child.files.length + " files", "row-count"));
    } else open.dataset.file = child.key;
    cell(row, open); actionRow(row, open);
    const subset = records.filter((r) => child.files.includes(r.file));
    counts(subset, tests.filter((r) => child.files.includes(r.file))).forEach((value) => cell(row, number(value), "num"));
    body.append(row);
  }
  if (flat) {
    paginate(host, visibleFiles, (file) => draw({ key: file, name: fileLabel(file), directory: false, files: [file] }, 0));
    return;
  }
  function level(path, depth) {
    for (const item of fileChildren(visibleFiles, path)) {
      const child = compactFolder(item); draw(child, depth);
      if (child.directory && expanded.has(child.key)) level(child.key, depth + 1);
    }
  }
  level(state.scope, 0);
}
function summaryView() {
  const host = $("summary-view"); host.replaceChildren();
  host.append(el("h2", state.file ? fileLabel(state.file) : state.scope || "All contexts"));
  const { records, tests } = selection(); metrics(host, records, tests);
  const executions = records.filter((r) => r.execution);
  const kinds = el("p", ["read", "invoke", "classic", "custom"].map((k) =>
    k + ": " + executions.filter((r) => r.execution.kind === k).length).join(" · "));
  host.append(kinds, el("p", "Counts follow the current context and filters. A pipeline call is one observed invocation, not a test or necessarily a submitted transaction. Pipeline errors are separate from test failures."));
  const health = el("details", undefined, "data-section");
  health.append(el("summary", "Run results and recording completeness"), el("p", "Run: " + report.runId),
    el("p", report.complete ? "Evidence reconciliation completed." : "Evidence is incomplete; inspect the diagnostics above."),
    el("p", report.exitCode === undefined ? "Runner exit code unavailable." : "Runner/source exit code: " + report.exitCode + ". Test counts describe recorded leaf tests, not the runner exit status."));
  if (report.exitCode && !tests.some((r) => status(r) === "failed")) health.append(el("p", "A nonzero exit with no selected failed tests can reflect filters, failures outside test bodies or a consolidated run containing later successful reruns. Check the source artifacts."));
  host.append(health, el("h3", "Test files"), el("p", "Expand a context row, then select a file to see its tests.")); contextFiles(host);
}
`;
