/** Nested file, suite, test and execution evidence views. */
export const evidenceScript: string = String.raw`
function parentOf(r) { return byId.get(r.parentId) || byId.get(r.callId) || byId.get(r.testId); }
function recordLink(r) {
  const node = button(r.name, () => openRecord(r), "text-button");
  node.dataset.record = r.id; return node;
}
function recordTable(host, records, caption) {
  if (!records.length) return;
  host.append(el("h3", caption));
  const body = table(host, ["Name / context", "Kind", "Outcome", "Duration (ms)"]);
  paginate(host, records, (r) => {
    const row = el("tr"), name = el("div");
    name.append(recordLink(r), el("small", (r.path || []).slice(0, -1).join(" / "), "context-label"));
    cell(row, name); cell(row, r.kind); cell(row, badge(status(r))); cell(row, number(r.durationMs), "num");
    body.append(row);
  });
}
function sidebar() {
  const host = $("tree"); host.replaceChildren();
  host.append(el("h2", "Browse evidence"));
  const selectedPath = state.file ? fileLabel(state.file) : state.scope;
  const visible = new Set(report.records.filter((r) => matches(r, false)).map((r) => r.file));
  function level(path, parent) {
    const children = new Map();
    for (const f of files) {
      if (!visible.has(f) && f !== state.file) continue;
      const label = fileLabel(f);
      if (path && !label.startsWith(path + "/")) continue;
      const rest = path ? label.slice(path.length + 1) : label;
      const name = rest.split("/")[0], directory = rest.includes("/");
      children.set(name, { file: f, directory });
    }
    for (const [name, child] of [...children].sort(([a], [b]) => a.localeCompare(b))) {
      const context = path ? path + "/" + name : name;
      if (child.directory) {
        const block = el("details"); block.open = selectedPath === context || selectedPath.startsWith(context + "/");
        block.append(el("summary", name));
        block.append(button("View " + name, () => navigate({ tab: "evidence", scope: context, file: "", record: "", page: "0" }), "text-button"));
        // Populate a branch only when needed, keeping large reports responsive.
        let built = false;
        const populate = () => { if (!built && block.open) { built = true; level(context, block); } };
        block.ontoggle = populate; populate(); parent.append(block);
      } else {
        const item = button(name, () => openFile(child.file), "file-link");
        item.title = fileLabel(child.file); item.dataset.file = child.file;
        if (child.file === state.file) item.setAttribute("aria-current", "page");
        parent.append(item);
      }
    }
  }
  level("", host);
  const current = host.querySelector("[aria-current]");
  if (current && current.getBoundingClientRect().bottom > host.getBoundingClientRect().bottom) {
    host.scrollTop += current.getBoundingClientRect().top - host.getBoundingClientRect().top - 40;
  }
}
async function copyHash(hash, value) {
  try { await navigator.clipboard.writeText(hash); $("toast").textContent = "Hash copied."; }
  catch {
    const range = document.createRange(); range.selectNodeContents(value);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    $("toast").textContent = "Hash selected. Press Ctrl+C or Command+C to copy.";
  }
}
function executionDetail(host, r) {
  const e = r.execution;
  host.append(el("h3", "Execution"));
  const facts = el("dl");
  for (const [key, value] of [["Kind", e.kind], ["Pipeline outcome", r.status], ["Chain outcome", e.chain],
    ["Network", e.network || "Unavailable"], ["Client", e.client || "Unnamed"], ["Contract", e.contract || "Unavailable"],
    ["Method / operations", e.method || e.operations.join(", ") || "Unavailable"]]) {
    facts.append(el("dt", key), el("dd", value));
  }
  host.append(facts);
  const test = ownerTest(r);
  if (test) { const origin = el("p", "Owning test: "); origin.append(recordLink(test)); host.append(origin); }
  for (const [label, hash] of [["Hash", e.hash], ["Inner hash", e.innerHash]]) {
    if (!hash) continue;
    const row = el("div", undefined, "hash"), value = el("code", hash);
    row.append(el("strong", label), value, button("Copy " + label.toLowerCase(), () => copyHash(hash, value)));
    host.append(row);
  }
  const stages = el("details", undefined, "data-section");
  stages.append(el("summary", "Pipeline stages (" + e.stages.length + ")"));
  const body = table(stages, ["Stage", "Outcome", "Duration (ms)"]);
  for (const stage of e.stages) { const row = el("tr"); cell(row, stage.name); cell(row, badge(stage.status)); cell(row, number(stage.durationMs), "num"); body.append(row); }
  host.append(stages);
  jsonSection(host, "Simulation budgets (not actual usage)", e.simulations);
  jsonSection(host, "Authorization", e.authorization);
  jsonSection(host, "Submitted transaction", e.submitted);
  jsonSection(host, "Confirmed fees (stroops)", { feeCharged: e.feeCharged, resourceFees: e.resourceFees });
  jsonSection(host, "Stage inputs and outputs", e.stages);
}
function evidenceView() {
  sidebar();
  const host = $("detail"); host.replaceChildren();
  const r = byId.get(state.record);
  if (r) {
    host.append(el("h2", r.name));
    const meta = el("p", r.kind + " · "); meta.append(badge(status(r))); host.append(meta);
    host.append(el("p", fileLabel(r.file), "context-label"));
    const facts = el("dl");
    for (const [key, value] of [["Started", r.startedAt], ["Duration (ms)", number(r.durationMs)],
      ["Runner outcome", r.runnerStatus || "Unavailable"], ["Observed outcome", r.status]]) facts.append(el("dt", key), el("dd", value));
    host.append(facts);
    if (r.execution) executionDetail(host, r);
    jsonSection(host, "Captured context and result", r.data);
    jsonSection(host, "Error", r.error);
    const children = report.records.filter((child) => parentOf(child)?.id === r.id)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    recordTable(host, children, r.kind === "suite" ? "Tests and shared setup / teardown" : "Captured observations");
    if (!children.length && !r.execution) host.append(el("p", "No child observations were captured for this item."));
    return;
  }
  if (!state.file) {
    host.append(el("h2", state.scope || "Contexts"), el("p", "Choose a context or file to browse its suites and tests."));
    contextFiles(host); return;
  }
  const selected = selection(), records = selected.records.filter((r) => r.file === state.file);
  host.append(el("h2", basename(state.file)), el("p", fileLabel(state.file), "context-label"));
  metrics(host, records, selected.tests);
  const suites = report.records.filter((item) => item.file === state.file && item.kind === "suite" && !parentOf(item));
  if (suites.length) {
    const strip = el("div", undefined, "suite-links");
    strip.append(el("span", "Suites: ", "muted"));
    for (const suite of suites) strip.append(recordLink(suite));
    host.append(strip);
  }
  recordTable(host, selected.tests, "Tests by suite");
  const shared = records.filter((item) => !ownerTest(item) && item.kind !== "suite" && !parentOf(item));
  const hooks = records.filter((item) => item.kind === "hook" && !ownerTest(item));
  recordTable(host, [...new Map([...shared, ...hooks].map((item) => [item.id, item])).values()], "Shared setup, teardown and file observations");
  if (!records.length) host.append(el("p", "No matching evidence in this file. Clear filters to see all tests.", "empty"));
}
`;
