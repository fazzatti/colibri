/** Shared indexes and navigation for the offline report. Values enter the DOM as text. */
export const modelScript: string = String.raw`
"use strict";
const report = JSON.parse(document.getElementById("evidence-data").textContent);
const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
const button = (text, action, cls) => {
  const node = el("button", text, cls);
  node.type = "button";
  node.onclick = action;
  return node;
};
const number = (n) => n === undefined || n === null ? "—" :
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
const status = (r) => r.kind === "test" || r.kind === "suite"
  ? r.runnerStatus || "unknown" : r.status;
const byId = new Map(report.records.map((r) => [r.id, r]));
const files = [...new Set(report.records.map((r) => r.file))].sort();
const prefix = (files[0] || "").split("/").slice(0, -1);
while (prefix.length && !files.every((f) => f.startsWith(prefix.join("/") + "/"))) prefix.pop();
const fileLabel = (f) => prefix.length ? f.slice(prefix.join("/").length + 1) : f;
const basename = (f) => fileLabel(f).split("/").at(-1);
const defaults = { tab: "summary", scope: "", file: "", record: "", detail: "stages", q: "",
  test: "", outcome: "", chain: "", client: "", method: "", mode: "executions", cross: "", group: "", page: "0", sort: "duration", desc: "1", order: "duration", reverse: "1" };
const metricColumns = [
  ["duration", "Duration (ms)"], ["instructions", "Instructions (budget)"],
  ["reads", "Read-only entries"], ["writes", "Read-write entries"],
  ["readBytes", "Disk read (bytes)"], ["writeBytes", "Write (bytes)"],
  ["fee", "Minimum resource fee (stroops)"], ["charged", "Confirmed fee charged (stroops)"],
  ["rent", "Confirmed rent (stroops)"], ["events", "Confirmed events"], ["simEvents", "Simulated events"],
  ["created", "Created entries"], ["updated", "Updated entries"], ["removed", "Removed entries"],
  ["restored", "Restored entries"], ["ttl", "TTL extensions"],
  ["simCreated", "Simulated created entries"], ["simTtl", "Simulated TTL extensions"]
];
for (const [key] of metricColumns) { defaults[key + "Min"] = ""; defaults[key + "Max"] = ""; }
let state = { ...defaults };
const expanded = new Set(), foldersOpen = new Set(), suitesOpen = new Set();
let sidebarFile = "";
const pageSize = 50;
function readState() {
  state = { ...defaults };
  const params = new URLSearchParams(location.hash.slice(1));
  for (const key of Object.keys(defaults)) if (params.has(key)) state[key] = params.get(key);
  if (!["summary", "evidence", "profiling"].includes(state.tab)) state.tab = "summary";
  if (!["stages", "inputs", "authorization", "events"].includes(state.detail)) state.detail = "stages";
  if (!files.includes(state.file)) state.file = "";
  if (!byId.has(state.record)) state.record = "";
  if (!["groups", "executions"].includes(state.mode)) state.mode = "executions";
  if (!metricColumns.some(([key]) => key === state.sort)) state.sort = "duration";
  if (!["count", ...metricColumns.map(([key]) => key)].includes(state.order)) state.order = "duration";
  state.page = String(Math.max(0, Number.parseInt(state.page) || 0));
}
function navigate(change, replace = false) {
  const newView = ["tab", "file", "record", "group"].some((key) => key in change && change[key] !== state[key]);
  state = { ...state, ...change };
  const params = new URLSearchParams();
  for (const key of Object.keys(defaults)) if (state[key] !== defaults[key]) params.set(key, state[key]);
  const hash = "#" + params;
  const position = { scroll: [scrollX, scrollY] };
  history.replaceState(position, "");
  history[replace ? "replaceState" : "pushState"](position, "", hash);
  render();
  if (newView) scrollTo(0, 0);
}
function openFile(file, tab = "evidence") {
  navigate({ tab, scope: "", file, record: "", detail: "stages", group: "", page: "0" });
}
function openRecord(r) {
  navigate({ tab: "evidence", scope: "", file: r.file, record: r.id, detail: "stages", group: "", page: "0" });
}
function inScope(r) {
  const f = fileLabel(r.file);
  return (!state.file || r.file === state.file) &&
    (!state.scope || f.startsWith(state.scope + "/"));
}
function ownerTest(r) {
  const seen = new Set();
  while (r && !seen.has(r.id)) {
    if (r.kind === "test") return r;
    seen.add(r.id);
    r = byId.get(r.testId) || byId.get(r.parentId) || byId.get(r.callId);
  }
}
function matches(r, scoped = true) {
  if (scoped && !inScope(r)) return false;
  const e = r.execution;
  const test = ownerTest(r);
  const text = [r.name, fileLabel(r.file), ...(r.path || []), test?.name,
    e?.hash, e?.innerHash, e?.contract, e?.method, e?.client, e ? operationLabel(r) : ""].join(" ").toLowerCase();
  return (!state.q || text.includes(state.q.toLowerCase())) &&
    (!state.test || (test && status(test) === state.test)) &&
    (!state.outcome || (e && r.status === state.outcome)) &&
    (!state.chain || e?.chain === state.chain) &&
    (!state.client || e?.client === state.client) &&
    (!state.method || e?.method === state.method);
}
function selection() {
  const records = report.records.filter((r) => matches(r));
  // Execution searches/filters retain their owning tests in the counts and lists.
  const tests = new Map(records.filter((r) => r.kind === "test").map((r) => [r.id, r]));
  for (const r of records) {
    const test = ownerTest(r);
    if (test) tests.set(test.id, test);
  }
  return { records, tests: [...tests.values()] };
}
function counts(records, tests = records.filter((r) => r.kind === "test")) {
  return [tests.length, ...["passed", "failed", "skipped", "unknown"].map((s) =>
    tests.filter((r) => status(r) === s).length), records.filter((r) => r.execution).length];
}
function badge(value) { return el("span", value, "badge " + value); }
function jsonSection(parent, title, data, open = false) {
  if (data === undefined) return;
  const block = el("details", undefined, "data-section");
  block.open = open;
  block.append(el("summary", title), el("pre", JSON.stringify(data, null, 2)));
  parent.append(block);
}
function table(host, headings) {
  const scroll = el("div", undefined, "table-scroll");
  const node = el("table"), head = el("tr");
  for (const label of headings) { const th = el("th", label); th.scope = "col"; head.append(th); }
  const thead = el("thead"); thead.append(head); node.append(thead);
  const body = el("tbody"); node.append(body); scroll.append(node); host.append(scroll);
  return body;
}
function cell(row, value, cls) {
  const td = el("td", undefined, cls);
  td.append(value instanceof Node ? value : document.createTextNode(value ?? "—"));
  row.append(td); return td;
}
function paginate(host, rows, draw) {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Number(state.page), pages - 1);
  for (const r of rows.slice(page * pageSize, (page + 1) * pageSize)) draw(r);
  const pager = el("div", undefined, "pager");
  const previous = button("Previous page", () => navigate({ page: String(page - 1) }));
  const next = button("Next page", () => navigate({ page: String(page + 1) }));
  previous.disabled = page === 0; next.disabled = page + 1 >= pages;
  pager.append(previous, el("span", rows.length ?
    (page * pageSize + 1) + "–" + Math.min((page + 1) * pageSize, rows.length) + " of " + rows.length : "0 results"), next);
  host.append(pager);
}
// A single native button supplies keyboard access; the entire table row shares its action.
function actionRow(row, control) {
  row.classList.add("action-row");
  row.onclick = (event) => { if (!event.target.closest("button, a, input, select")) control.click(); };
}
function itemIcon(kind) {
  const paths = {
    test: "M14 2l8 8M16 4L5 15a4.24 4.24 0 0 0 6 6L22 10M9 11l6 6",
    file: "M14 2H5v20h14V7zM14 2v5h5M8 12h8M8 16h6",
    before: "M4 5v7h15M14 7l5 5-5 5",
    after: "M20 5v7H5M10 7l-5 5 5 5"
  };
  if (paths[kind]) {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [key, value] of Object.entries({ class: "item-icon " + kind, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" })) icon.setAttribute(key, value);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", paths[kind]);
    icon.append(path); return icon;
  }
  const icon = el("span", undefined, "item-icon " + kind); icon.setAttribute("aria-hidden", "true");
  return icon;
}
function recordIcon(r) {
  if (r.kind === "suite") return "folder";
  if (r.kind === "test") return "test";
  if (r.kind === "hook") return /^after/i.test(r.name) ? "after" : "before";
  return "file";
}
// Older reports may retain the operation XDR JSON even without operationDetails.
function operationDetails(r) {
  const e = r.execution;
  if (e.operationDetails?.length) return e.operationDetails;
  const params = r.data?.input?.parameters || r.data?.parameters;
  return e.operations.map((type, i) => {
    const body = Array.isArray(params) ? params[i]?.body : undefined;
    const host = body?.invoke_host_function?.host_function;
    const hostNames = { invoke_contract: "hostFunctionTypeInvokeContract", create_contract: "hostFunctionTypeCreateContract", create_contract_v2: "hostFunctionTypeCreateContractV2", upload_contract_wasm: "hostFunctionTypeUploadContractWasm" };
    const hostFunction = host && typeof host === "object" ? hostNames[Object.keys(host)[0]] : undefined;
    return { type, hostFunction, method: host?.invoke_contract?.function_name || e.method, extendTo: body?.extend_footprint_ttl?.extend_to };
  });
}
function operationLabel(r) {
  const labels = { hostFunctionTypeCreateContract: "deploy contract", hostFunctionTypeCreateContractV2: "deploy contract (constructor)", hostFunctionTypeUploadContractWasm: "upload WASM", hostFunctionTypeInvokeContract: "invoke contract" };
  const details = operationDetails(r);
  return details.map((op) => {
    if (op.type === "invokeHostFunction") return op.type + (op.method ? " / " + op.method : labels[op.hostFunction] ? " / " + labels[op.hostFunction] : "");
    if (op.type === "restoreFootprint") return op.type + " / restore entries";
    if (op.type === "extendFootprintTtl") return op.type + " / extend TTL" + (op.extendTo === undefined ? "" : " (target: current ledger + " + op.extendTo + ")");
    return op.type;
  }).join(", ") || r.execution.method || "Unavailable";
}
function disclosureLabel(control, name, open, kind) {
  const arrow = el("span", open === undefined ? "" : open ? "▾" : "▸", "arrow");
  arrow.setAttribute("aria-hidden", "true");
  control.replaceChildren(arrow, itemIcon(kind), el("span", name, "row-name"));
  if (open !== undefined) control.setAttribute("aria-expanded", String(open));
}
function fileChildren(visible, path = "") {
  const children = new Map();
  for (const file of visible) {
    const label = fileLabel(file);
    if (path && !label.startsWith(path + "/")) continue;
    const rest = path ? label.slice(path.length + 1) : label;
    const name = rest.split("/")[0], directory = rest.includes("/");
    const key = directory ? (path ? path + "/" : "") + name : file;
    if (!children.has(key)) children.set(key, { key, name, directory, files: [] });
    children.get(key).files.push(file);
  }
  return [...children.values()].sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name));
}
function compactFolder(child) {
  while (child.directory) {
    const nested = fileChildren(child.files, child.key);
    if (nested.length !== 1 || !nested[0].directory) break;
    child = { ...nested[0], name: child.name + "/" + nested[0].name };
  }
  return child;
}
function breadcrumbs() {
  const host = $("breadcrumbs"); host.replaceChildren();
  host.append(button("All contexts", () => navigate({ scope: "", file: "", record: "", group: "", page: "0" })));
  const path = state.file ? fileLabel(state.file).split("/").slice(0, -1) : state.scope.split("/").filter(Boolean);
  path.forEach((part) => {
    host.append(el("span", "/", "muted"), el("span", part, "muted"));
  });
  if (state.file) host.append(el("span", "/", "muted"), button(basename(state.file), () => navigate({ record: "", group: "", page: "0" })));
  const record = byId.get(state.record);
  if (record) {
    const trail = [], seen = new Set([record.id]); let parent = byId.get(record.parentId) || byId.get(record.testId);
    while (parent && !seen.has(parent.id)) { seen.add(parent.id); trail.unshift(parent); parent = byId.get(parent.parentId) || byId.get(parent.testId); }
    for (const r of trail) host.append(el("span", "/", "muted"), button(r.name, () => {
      if (r.kind !== "suite") { openRecord(r); return; }
      suitesOpen.add(r.id); openFile(r.file);
    }));
    host.append(el("span", "/", "muted"), el("strong", record.name));
  }
}
`;
