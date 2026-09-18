/** Browsable operation groups and paginated execution measurements. */
export const profilingScript: string = String.raw`
function measure(r, key) {
  const e = r.execution, p = e.simulations.at(-1);
  return ({ duration: r.durationMs, instructions: p?.instructions, reads: p?.readOnlyEntries,
    writes: p?.readWriteEntries, readBytes: p?.diskReadBytes, writeBytes: p?.writeBytes,
    fee: p?.minResourceFee, charged: e.feeCharged })[key];
}
const metricSets = {
  timing: [["duration", "Duration (ms)"]],
  resources: [["instructions", "Instructions (budget)"], ["reads", "Read-only entries"],
    ["writes", "Read-write entries"], ["readBytes", "Disk read (bytes)"], ["writeBytes", "Write (bytes)"]],
  fees: [["fee", "Minimum resource fee (stroops)"], ["charged", "Confirmed fee charged (stroops)"]]
};
function stats(values) {
  values = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!values.length) return;
  let mean = 0, m2 = 0;
  values.forEach((v, i) => { const delta = v - mean; mean += delta / (i + 1); m2 += delta * (v - mean); });
  return { count: values.length, min: values[0], max: values.at(-1), mean,
    median: values[Math.ceil(values.length * .5) - 1], p95: values[Math.ceil(values.length * .95) - 1],
    variance: m2 / values.length, deviation: Math.sqrt(m2 / values.length) };
}
function groupKey(r) {
  const e = r.execution;
  return JSON.stringify([state.cross ? null : r.file, e.network ?? null, e.client ?? null,
    e.contract ?? null, e.method ?? null, e.kind, e.operations, r.status, e.chain,
    // Unknown identity is not evidence that two unrelated executions are comparable.
    !e.network || (["read", "invoke"].includes(e.kind) && (!e.contract || !e.method)) || (!e.method && !e.operations.length) ? r.id : null]);
}
function operationName(r) { const e = r.execution; return e.kind + " " + (e.method || e.operations.join(", ") || "unknown operation"); }
function executionTable(host, rows) {
  const columns = metricSets[state.metrics];
  const body = table(host, ["Execution / test", "File", "Pipeline / chain outcome", ...columns.map(([, title]) => title)]);
  body.id = "profile-body";
  const headings = body.parentNode.querySelectorAll("th");
  columns.forEach(([key, title], i) => {
    headings[i + 3].replaceChildren(button(title, () => navigate({ sort: key, desc: state.sort === key && state.desc ? "" : "1", page: "0" }), "text-button"));
    headings[i + 3].setAttribute("aria-sort", state.sort === key ? state.desc ? "descending" : "ascending" : "none");
  });
  const sorted = [...rows].sort((a, b) => {
    const x = measure(a, state.sort), y = measure(b, state.sort);
    if (x === undefined) return y === undefined ? 0 : 1;
    if (y === undefined) return -1;
    const comparison = ["fee", "charged"].includes(state.sort)
      ? BigInt(x) < BigInt(y) ? -1 : BigInt(x) > BigInt(y) ? 1 : 0 : x - y;
    return comparison * (state.desc ? -1 : 1);
  });
  paginate(host, sorted, (r) => {
    const row = el("tr"), name = el("div"); name.append(recordLink(r));
    const test = ownerTest(r);
    if (test) { const link = recordLink(test); link.classList.add("context-label"); name.append(link); }
    cell(row, name); cell(row, button(fileLabel(r.file), () => openFile(r.file), "text-button"));
    const outcome = el("div"); outcome.append(badge(r.status), el("small", r.execution.chain, "context-label")); cell(row, outcome);
    for (const [key] of columns) { const v = measure(r, key); cell(row, typeof v === "number" ? number(v) : v, "num"); }
    body.append(row);
  });
}
function metricDetails(host, rows) {
  const body = table(host, ["Metric", "Samples / executions", "Median", "Min–max", "Standard deviation"]);
  const more = el("details", undefined, "data-section"); more.append(el("summary", "More statistics: mean, p95 and variance"));
  const advanced = table(more, ["Metric", "Mean", "p95", "Population variance (squared units)"]);
  for (const [key, title] of [...metricSets.timing, ...metricSets.resources]) {
    const s = stats(rows.map((r) => measure(r, key))), row = el("tr"), extra = el("tr");
    cell(row, title); cell(row, (s?.count || 0) + " / " + rows.length, "num");
    cell(row, number(s?.median), "num"); cell(row, s ? number(s.min) + "–" + number(s.max) : "—", "num"); cell(row, number(s?.deviation), "num"); body.append(row);
    cell(extra, title); cell(extra, number(s?.mean), "num"); cell(extra, number(s?.p95), "num"); cell(extra, number(s?.variance), "num"); advanced.append(extra);
  }
  host.append(el("p", "Standard deviation describes spread in the metric's own units. Each sample count excludes missing values. A single sample cannot demonstrate repeatability; p95 is most useful with many samples."), more);
  // Keep fee comparisons exact: do not coerce potentially large stroop integers to Number.
  const fees = el("details", undefined, "data-section"); fees.append(el("summary", "Fee ranges (exact stroops)"));
  const feeBody = table(fees, ["Metric", "Samples / executions", "Minimum", "Maximum"]);
  for (const [key, title] of metricSets.fees) {
    const values = rows.map((r) => measure(r, key)).filter((v) => v !== undefined).map(BigInt).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    const row = el("tr"); cell(row, title); cell(row, values.length + " / " + rows.length); cell(row, values[0]?.toString()); cell(row, values.at(-1)?.toString()); feeBody.append(row);
  }
  host.append(fees);
}
function profileView() {
  const host = $("profile-content"); host.replaceChildren();
  const rows = report.records.filter((r) => r.execution && matches(r));
  $("profile-empty").hidden = rows.length > 0;
  if (!rows.length) return;
  if (state.mode === "executions") { executionTable(host, rows); return; }
  const groups = new Map();
  for (const r of rows) { const key = groupKey(r); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); }
  if (state.group && groups.has(state.group)) {
    const members = groups.get(state.group), r = members[0], e = r.execution;
    host.append(button("Back to operation groups", () => navigate({ group: "", page: "0" })), el("h3", operationName(r)));
    const definition = el("dl");
    for (const [key, value] of [["Files", state.cross ? "Across files (explicitly enabled)" : fileLabel(r.file)],
      ["Network", e.network || "Unavailable — this execution stays separate"], ["Client", e.client || "Unnamed"],
      ["Contract", e.contract || "Unavailable / not applicable"], ["Method", e.method || "Unavailable / not applicable"],
      ["Kind / operations", e.kind + " / " + e.operations.join(", ")], ["Pipeline / chain", r.status + " / " + e.chain]]) definition.append(el("dt", key), el("dd", value));
    host.append(definition, el("p", "These keys identify this group. Inputs may differ; measurements describe the captured executions, not an equivalent-workload benchmark."));
    metricDetails(host, members); host.append(el("h3", "Executions in this group")); executionTable(host, members); return;
  }
  const body = table(host, ["Operation / context", "Executions", "Median (ms)", "Duration range (ms)", "Pipeline / chain outcome"]);
  body.id = "group-body";
  const headings = body.parentNode.querySelectorAll("th");
  for (const [index, key, label] of [[0, "name", "Operation / context"], [1, "count", "Executions"], [2, "duration", "Median (ms)"]]) {
    headings[index].replaceChildren(button(label, () => navigate({ order: key, reverse: state.order === key && state.reverse ? "" : "1", page: "0" }), "text-button"));
    headings[index].setAttribute("aria-sort", state.order === key ? state.reverse ? "descending" : "ascending" : "none");
  }
  const entries = [...groups].sort((a, b) => {
    const metric = (members) => state.order === "count" ? members.length : stats(members.map((r) => r.durationMs))?.median ?? -1;
    const comparison = state.order === "name" ? operationName(a[1][0]).localeCompare(operationName(b[1][0])) : metric(a[1]) - metric(b[1]);
    return comparison * (state.reverse ? -1 : 1);
  });
  paginate(host, entries, ([key, members]) => {
    const r = members[0], e = r.execution, row = el("tr"), name = el("div");
    const link = button(operationName(r), () => navigate({ group: key, page: "0" }), "text-button"); link.dataset.group = key;
    name.append(link, el("small", [state.cross ? new Set(members.map((r) => r.file)).size + " files" : fileLabel(r.file), e.client || "Unnamed client", e.network || "Network unavailable", e.contract].filter(Boolean).join(" · "), "context-label"));
    cell(row, name); cell(row, number(members.length), "num");
    const s = stats(members.map((r) => r.durationMs)); cell(row, number(s?.median), "num"); cell(row, s ? number(s.min) + "–" + number(s.max) : "—", "num");
    const outcome = el("div"); outcome.append(badge(r.status), el("small", e.chain, "context-label")); cell(row, outcome); body.append(row);
  });
}
`;
