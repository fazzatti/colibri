/** File navigation, inline suites and structured test/call evidence. */
export const evidenceScript: string = String.raw`
function parentOf(r) { return byId.get(r.parentId) || byId.get(r.callId) || byId.get(r.testId); }
function recordLink(r) {
  const node = button(r.name, () => openRecord(r), "text-button");
  if (r.kind === "test" || r.kind === "hook") { node.classList.add("icon-label"); node.replaceChildren(itemIcon(recordIcon(r)), el("span", r.name)); }
  node.dataset.record = r.id; return node;
}
function factsTable(host, facts) {
  const node = el("table", undefined, "facts-table"), body = el("tbody");
  for (const [key, value] of facts) {
    const row = el("tr"), heading = el("th", key); heading.scope = "row"; row.append(heading);
    cell(row, value); body.append(row);
  }
  node.append(body); host.append(node);
}
function recordTable(host, records, caption) {
  if (!records.length) return;
  host.append(el("h3", caption));
  const body = table(host, ["Observation", "Kind", "Outcome", "Started", "Duration (ms)"]);
  paginate(host, records, (r) => {
    const row = el("tr"), link = recordLink(r); cell(row, link); actionRow(row, link);
    cell(row, r.execution ? "Pipeline call" : r.kind); cell(row, badge(status(r)));
    cell(row, r.startedAt); cell(row, number(r.durationMs), "num"); body.append(row);
  });
}
function sidebar() {
  const host = $("tree"), oldScroll = host.scrollTop; host.replaceChildren();
  host.append(el("h2", "Test files"));
  const selectedPath = state.file ? fileLabel(state.file) : "";
  const reveal = sidebarFile !== state.file; sidebarFile = state.file;
  const visible = files.filter((f) => f === state.file || report.records.some((r) => r.file === f && matches(r, false)));
  function level(path, parent) {
    const list = el("ul", undefined, "file-tree");
    for (const item of fileChildren(visible, path)) {
      const child = compactFolder(item), branch = el("li");
      if (child.directory) {
        if (reveal && selectedPath.startsWith(child.key + "/")) foldersOpen.add(child.key);
        const open = foldersOpen.has(child.key), control = button("", () => {
          if (foldersOpen.has(child.key)) foldersOpen.delete(child.key); else foldersOpen.add(child.key);
          sidebar();
          [...host.querySelectorAll("button[data-folder]")].find((n) => n.dataset.folder === child.key)?.focus({ preventScroll: true });
        }, "tree-row");
        disclosureLabel(control, child.name, open, "folder"); control.dataset.folder = child.key;
        control.title = child.key; branch.append(control);
        if (open) level(child.key, branch);
      } else {
        const control = button("", () => openFile(child.key), "tree-row file-link");
        disclosureLabel(control, child.name, undefined, "file");
        control.title = fileLabel(child.key); control.dataset.file = child.key;
        if (child.key === state.file) control.setAttribute("aria-current", "page");
        branch.append(control);
      }
      list.append(branch);
    }
    parent.append(list);
  }
  level("", host); host.scrollTop = oldScroll;
  const current = host.querySelector("[aria-current]");
  if (reveal && current) {
    const item = current.getBoundingClientRect(), panel = host.getBoundingClientRect();
    if (item.bottom > panel.bottom || item.top < panel.top) host.scrollTop += item.top - panel.top - 40;
  }
}
async function copyHash(hash, value, control, feedback) {
  control.disabled = true; feedback.textContent = "";
  try {
    await navigator.clipboard.writeText(hash);
    control.textContent = "Copied"; feedback.textContent = "Hash copied."; feedback.className = "copy-feedback success";
    setTimeout(() => { control.textContent = "Copy hash"; control.disabled = false; feedback.textContent = ""; }, 2000);
  } catch {
    const range = document.createRange(); range.selectNodeContents(value);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    control.disabled = false; feedback.className = "copy-feedback failed";
    feedback.textContent = "Clipboard unavailable. Hash selected — press Ctrl+C or Command+C to copy.";
  }
}
function hashRow(host, label, hash, network) {
  if (!hash) return;
  const row = el("div", undefined, "hash"), value = el("code", hash), feedback = el("span", undefined, "copy-feedback");
  feedback.setAttribute("role", "status");
  const control = button("Copy hash", () => copyHash(hash, value, control, feedback));
  const networks = { "Test SDF Network ; September 2015": "testnet", "Public Global Stellar Network ; September 2015": "public" };
  let display = value;
  if (Object.hasOwn(networks, network) && /^[a-fA-F0-9]{64}$/.test(hash)) {
    const link = el("a"); link.href = "https://stellar.expert/explorer/" + networks[network] + "/tx/" + hash;
    link.target = "_blank"; link.rel = "noopener noreferrer"; link.title = "Open transaction on Stellar Expert";
    link.append(value); display = link;
  }
  row.append(el("strong", label), display, control, feedback); host.append(row);
}
function executionDetail(host, r) {
  const e = r.execution;
  const overview = el("section");
  overview.append(el("h3", "Overview"));
  factsTable(overview, [["Kind", e.kind], ["Method / operations", operationLabel(r)], ["Pipeline outcome", badge(r.status)], ["Chain outcome", e.chain],
    ["Started", r.startedAt], ["Ended", r.endedAt || "Unavailable"],
    ["Network", e.network || "Unavailable"], ["Client", e.client || "Unnamed"], ["Contract", e.contract || "Unavailable"]]);
  const test = ownerTest(r);
  if (test) { const origin = el("p", "Owning test: "); origin.append(recordLink(test)); overview.append(origin); }
  host.append(overview);
  hashRow(host, "Transaction hash", e.hash, e.network); hashRow(host, "Inner hash", e.innerHash, e.network);
  executionTabs(host, r);
}
function measurementPanel(measurements, r) {
  measurements.append(el("h3", "Measurements"));
  const metrics = el("div", undefined, "measurement-grid");
  const middle = Math.ceil(metricColumns.length / 2);
  for (const columns of [metricColumns.slice(0, middle), metricColumns.slice(middle)]) {
    const section = el("div"); factsTable(section, columns.map(([key, title]) => [title, formatMetric(measure(r, key))])); metrics.append(section);
  }
  measurements.append(metrics);
  measurements.append(el("p", "Resources and minimum resource fee come from the last simulation; confirmed rent is included in the charged fee. Entry counts are transaction/operation mutation records, including TTL entries. — means unavailable, not zero.", "context-label"));

}
function executionTabs(host, r) {
  const e = r.execution, sections = [["measurements", "Measurements"], ["stages", "Pipeline stages (" + e.stages.length + ")"], ["inputs", "Inputs and results"], ["authorization", "Authorization"], ["events", "Events"]];
  const tabs = el("div", undefined, "detail-tabs"); tabs.id = "call-tabs";
  tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Call evidence");
  host.append(tabs);
  const panels = {};
  function select(key) {
    navigate({ detail: key });
    $("call-tab-" + key).focus({ preventScroll: true });
    $("call-tabs").scrollIntoView({ block: "nearest" });
  }
  sections.forEach(([key, title], index) => {
    const selected = state.detail === key, control = button(title, () => select(key));
    control.id = "call-tab-" + key; control.setAttribute("role", "tab");
    control.setAttribute("aria-selected", String(selected)); control.setAttribute("aria-controls", "call-panel-" + key);
    control.tabIndex = selected ? 0 : -1;
    control.onkeydown = (event) => {
      const next = { ArrowRight: (index + 1) % sections.length, ArrowLeft: (index + sections.length - 1) % sections.length, Home: 0, End: sections.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault(); select(sections[next][0]);
    };
    tabs.append(control);
    const panel = el("div", undefined, "detail-panel"); panel.id = "call-panel-" + key;
    panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-labelledby", control.id); panel.tabIndex = 0;
    panel.hidden = !selected; panels[key] = panel; host.append(panel);
  });
  if (e.stages.length) {
    const body = table(panels.stages, ["Stage", "Outcome", "Started", "Duration (ms)"]);
    for (const stage of e.stages) {
      const row = el("tr"); cell(row, stage.name); cell(row, badge(stage.status)); cell(row, stage.startedAt); cell(row, number(stage.durationMs), "num"); body.append(row);
    }
  } else panels.stages.append(el("p", "No pipeline stages captured."));
  measurementPanel(panels.measurements, r);
  const inputs = panels.inputs;
  if (r.data === undefined && !e.stages.some((s) => s.input !== undefined || s.output !== undefined)) inputs.append(el("p", "No inputs or result captured at this recording level."));
  jsonSection(inputs, "Captured context and result", r.data, true);
  const stageData = e.stages.filter((s) => s.input !== undefined || s.output !== undefined || s.error !== undefined);
  if (stageData.length) jsonSection(inputs, "Stage inputs, outputs and errors", stageData, r.data === undefined);
  jsonSection(inputs, "Submitted transaction", e.submitted);
  jsonSection(panels.measurements, "All simulation estimates", e.simulations);
  jsonSection(panels.measurements, "Confirmed resource fee components (stroops)", e.resourceFees);
  jsonSection(panels.measurements, "Confirmed ledger changes", e.ledgerChanges);
  jsonSection(inputs, "Error", r.error, true);
  eventPanel(panels.events, e);
  if (e.authorization === undefined) panels.authorization.append(el("p", "Authorization details were not captured."));
  else jsonSection(panels.authorization, "Captured authorization details", e.authorization, true);
}

function fileTests(host, selected) {
  const candidates = [...selected.tests, ...selected.records.filter((r) => !ownerTest(r) && r.kind !== "suite")];
  const nodes = new Map();
  for (const r of candidates) {
    let current = r;
    const seen = new Set();
    while (current && current.file === state.file && !seen.has(current.id)) {
      seen.add(current.id); nodes.set(current.id, current); current = parentOf(current);
    }
  }
  // Suite rows expand in this table. Tests and shared observations open their evidence.
  const children = new Map();
  for (const r of nodes.values()) {
    const parent = parentOf(r), key = parent && nodes.has(parent.id) ? parent.id : "";
    if (!children.has(key)) children.set(key, []); children.get(key).push(r);
  }
  const visible = [], visited = new Set();
  function level(parent, depth) {
    for (const r of children.get(parent) || []) {
      if (visited.has(r.id)) continue; visited.add(r.id);
      visible.push({ r, depth });
      if (r.kind === "suite" && suitesOpen.has(r.id)) level(r.id, depth + 1);
    }
  }
  level("", 0);
  host.append(el("h3", "Suites and tests"), el("p", "Expand a suite row to see its tests and shared setup. Select a test to inspect its captured calls."));
  const body = table(host, ["Suite / test / observation", "Kind", "Outcome", "Duration (ms)"]);
  body.id = "test-body";
  paginate(host, visible, ({ r, depth }) => {
    const row = el("tr"), suite = r.kind === "suite", control = button("", () => {
      if (!suite) { openRecord(r); return; }
      if (suitesOpen.has(r.id)) suitesOpen.delete(r.id); else suitesOpen.add(r.id);
      render();
    }, "row-button");
    control.style.paddingInlineStart = (depth * 20 + 8) + "px";
    disclosureLabel(control, r.name, suite ? suitesOpen.has(r.id) : undefined, recordIcon(r));
    if (suite) { control.dataset.suite = r.id; control.setAttribute("aria-label", (suitesOpen.has(r.id) ? "Collapse " : "Expand ") + r.name); }
    else control.dataset.record = r.id;
    cell(row, control); actionRow(row, control); cell(row, r.kind); cell(row, badge(status(r))); cell(row, number(r.durationMs), "num"); body.append(row);
  });
}
function evidenceView() {
  sidebar();
  const host = $("detail"); host.replaceChildren();
  const r = byId.get(state.record);
  if (r) {
    const heading = el("h2", r.name);
    if (r.kind === "test" || r.kind === "hook") { heading.classList.add("icon-label"); heading.prepend(itemIcon(recordIcon(r))); }
    host.append(heading, el("p", fileLabel(r.file), "context-label"));
    if (r.execution) executionDetail(host, r);
    else {
      const facts = [["Kind", r.kind], ["Started", r.startedAt], ["Duration (ms)", number(r.durationMs)], ["Observed outcome", badge(r.status)]];
      if (r.kind === "test" || r.kind === "suite") facts.push(["Runner outcome", badge(r.runnerStatus || "unknown")]);
      factsTable(host, facts); jsonSection(host, "Captured context and result", r.data); jsonSection(host, "Error", r.error);
    }
    const children = report.records.filter((child) => parentOf(child)?.id === r.id).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    recordTable(host, children, "Captured calls and observations · chronological order");
    if (!children.length && !r.execution) host.append(el("p", "No child observations were captured for this item."));
    return;
  }
  if (!state.file) {
    host.append(el("h2", "Test files"), el("p", "Select a file below or in the sidebar. Search filters this list by file, test or captured evidence."));
    contextFiles(host, true); return;
  }
  const selected = selection();
  host.append(el("h2", basename(state.file)), el("p", fileLabel(state.file), "context-label"));
  metrics(host, selected.records, selected.tests); fileTests(host, selected);
  if (!selected.records.length) host.append(el("p", "No matching evidence in this file. Clear filters to see all tests.", "empty"));
}
`;
