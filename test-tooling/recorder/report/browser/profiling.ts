/** Individual pipeline calls by default, with explicit optional comparison groups. */
export const profilingScript: string = String.raw`
function groupKey(r) {
  const e = r.execution;
  return JSON.stringify([state.cross ? null : r.file, e.network ?? null, e.client ?? null,
    e.contract ?? null, e.method ?? null, e.kind, e.operations, r.status, e.chain,
    // Missing identity cannot establish that two calls are comparable.
    !e.network || (["read", "invoke"].includes(e.kind) && (!e.contract || !e.method)) || (!e.method && !e.operations.length) ? r.id : null]);
}
function operationName(r) { const e = r.execution; return e.kind + " " + (e.method || e.operations.join(", ") || "unknown operation"); }
function callContext(r) {
  const e = r.execution, text = [fileLabel(r.file), e.client || "Unnamed client", ownerTest(r)?.name].filter(Boolean).join(" · ");
  const context = el("small", text, "context-label compact-context"); context.title = text;
  return context;
}
function profileTable(host, groups = false) {
  const titles = groups ? ["Call group", "Recorded calls", "Pipeline outcome", "Chain outcome"] : ["Recorded pipeline call", "Pipeline outcome", "Chain outcome"];
  const columns = metricColumns.map(([key, title]) => [key, groups ? "Median " + title.toLowerCase() : title]);
  if (groups) columns.splice(1, 0, ["range", "Duration min–max (ms)"]);
  const body = table(host, [...titles, ...columns.map(([, title]) => title)]);
  const node = body.parentNode; node.className = "profile-table";
  node.parentNode.classList.add("profile-scroll"); node.parentNode.tabIndex = 0;
  node.parentNode.setAttribute("aria-label", "Measurements table; scroll horizontally for all columns");
  const headings = node.querySelectorAll("th"); node.style.setProperty("--columns", headings.length);
  columns.forEach(([key, title], i) => {
    const th = headings[i + titles.length];
    if (key === "range") { th.classList.add("num", "metric-column"); return; }
    measurementHeading(th, key, title, groups);
    measurementFilters(th, key, metricColumns.find(([id]) => id === key)[1]);
  });
  if (groups) measurementHeading(headings[1], "count", "Recorded calls", true);
  return body;
}
function executionTable(host, rows) {
  const body = profileTable(host); body.id = "profile-body";
  const sorted = [...rows].sort((a, b) => sortMetric(measure(a, state.sort), measure(b, state.sort), state.sort, state.desc));
  paginate(host, sorted, (r) => {
    const row = el("tr"), name = el("div");
    const link = recordLink(r); link.textContent = operationName(r); link.title = r.name;
    name.append(link, callContext(r)); cell(row, name); actionRow(row, link);
    cell(row, badge(r.status)); cell(row, r.execution.chain);
    for (const [key] of metricColumns) { const td = cell(row, formatMetric(measure(r, key)), "num"); td.dataset.metric = key; }
    body.append(row);
  });
}
function groupDefinition(host, members) {
  const r = members[0], e = r.execution;
  host.append(el("h3", operationName(r) + " · " + members.length + " recorded " + (members.length === 1 ? "call" : "calls")));
  const facts = [
    ["Files", state.cross ? [...new Set(members.map((item) => fileLabel(item.file)))].join(", ") : fileLabel(r.file)],
    ["Network", e.network || "Unavailable — this call stays separate"], ["Client label", e.client || "Unnamed"],
    ["Contract", e.contract || "Unavailable / not applicable"], ["Method", e.method || "Unavailable / not applicable"],
    ["Kind / operation sequence", e.kind + " / " + e.operations.join(", ")],
    ["Pipeline outcome", r.status], ["Chain outcome", e.chain]
  ];
  factsTable(host, facts);
  host.append(el("p", "Every call below shares these recorded keys. Inputs may differ, and a client label does not prove object identity. These are observations, not an equivalent-workload benchmark."));
}
function profileView() {
  const host = $("profile-content"); host.replaceChildren();
  const candidates = report.records.filter((r) => r.execution && matches(r));
  const rows = candidates.filter(withinRanges);
  $("profile-empty").hidden = rows.length > 0;
  $("profile-empty").textContent = metricColumns.some(([key]) => metricRange(key).invalid)
    ? "Correct the highlighted measurement ranges below." : "No matching pipeline calls. Clear filters or select another context.";
  $("group-explanation").hidden = state.mode !== "groups";
  host.append(el("p", rows.length + " of " + candidates.length + " recorded pipeline calls match the measurement ranges. Ranges apply to individual calls before comparison groups are calculated.", "measurement-notice"));
  if (state.mode === "executions") { executionTable(host, rows); return; }
  const groups = new Map();
  for (const r of rows) { const key = groupKey(r); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); }
  if (state.group && groups.has(state.group)) {
    const members = groups.get(state.group);
    host.append(button("Back to comparison groups", () => navigate({ group: "", page: "0" })));
    groupDefinition(host, members); metricDetails(host, members);
    host.append(el("h3", "Individual calls in this group")); executionTable(host, members); return;
  }
  const body = profileTable(host, true); body.id = "group-body";
  const entries = [...groups].sort((a, b) => {
    const value = (members) => state.order === "count" ? members.length : medianMetric(members, state.order);
    return sortMetric(value(a[1]), value(b[1]), state.order, state.reverse);
  });
  paginate(host, entries, ([key, members]) => {
    const r = members[0], e = r.execution, row = el("tr"), name = el("div");
    const link = button(operationName(r), () => navigate({ group: key, page: "0" }), "text-button"); link.dataset.group = key;
    const context = el("small", [state.cross ? new Set(members.map((r) => r.file)).size + " files" : fileLabel(r.file), e.client || "Unnamed client", e.contract].filter(Boolean).join(" · "), "context-label compact-context"); context.title = context.textContent;
    name.append(link, context); cell(row, name); actionRow(row, link);
    cell(row, number(members.length), "num"); cell(row, badge(r.status)); cell(row, e.chain);
    for (const [metric] of metricColumns) {
      cell(row, formatMetric(medianMetric(members, metric)), "num");
      if (metric === "duration") {
        const values = metricValues(members, metric);
        cell(row, values.length ? number(values[0]) + "–" + number(values.at(-1)) : "—", "num");
      }
    }
    body.append(row);
  });
}
`;
