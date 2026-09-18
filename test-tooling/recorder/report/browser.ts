/** Browser code is shipped inline; evidence is always inserted with textContent. */
export const browserScript: string = String.raw`
"use strict";
const report = JSON.parse(document.getElementById("evidence-data").textContent);
const groups = JSON.parse(document.getElementById("profile-data").textContent);
const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
const status = (r) =>
  r.runnerStatus ||
  (r.kind === "test" || r.kind === "suite" ? "unknown" : r.status);
const number = (n) =>
  n === undefined || n === null
    ? "—"
    : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
let selected, sortKey = "duration", descending = true, page = 0;
const perPage = 50;
const tests = report.records.filter((r) => r.kind === "test");
const fileNames = [...new Set(report.records.map((r) => r.file))];
const common = (fileNames[0] || "").split("/").slice(0, -1);
while (common.length && !fileNames.every((file) => file.startsWith(common.join("/") + "/"))) common.pop();
const fileLabel = (file) => common.length ? file.slice(common.join("/").length + 1) : file;
for (
  const [name, value] of [
    ["Tests", tests.length],
    ["Passed", tests.filter((r) => r.runnerStatus === "passed").length],
    ["Failed", tests.filter((r) => r.runnerStatus === "failed").length],
    [
      "Skipped",
      tests.filter((r) => r.runnerStatus === "skipped").length,
    ],
    [
      "Unknown",
      tests.filter((r) => !r.runnerStatus || r.runnerStatus === "unknown")
        .length,
    ],
    ["Executions", report.records.filter((r) => r.execution).length],
  ]
) $("summary").append(el("span", name + ": " + value));
$("run").textContent = "Run " + report.runId + " · " +
  (report.complete ? "Runner finished" : "Incomplete evidence") +
  (report.exitCode === undefined
    ? " · runner exit unavailable"
    : " · exit " + report.exitCode);
for (const warning of report.diagnostics) {
  $("warnings").append(el("p", warning));
}
function choices(id, values) {
  for (const value of [...new Set(values.filter(Boolean))].sort()) {
    const option = el("option", id === "file" ? fileLabel(value) : value);
    option.value = value;
    $(id).append(option);
  }
}
choices("file", report.records.map((r) => r.file));
choices("client", report.records.map((r) => r.execution?.client));
choices("method", report.records.map((r) => r.execution?.method));
function matches(r) {
  const q = $("search").value.toLowerCase();
  return (!$("file").value || r.file === $("file").value) &&
    (!$("status").value || status(r) === $("status").value) &&
    (!$("client").value || r.execution?.client === $("client").value) &&
    (!$("method").value || r.execution?.method === $("method").value) &&
    (!q ||
      [
        r.name,
        r.file,
        r.execution?.hash,
        r.execution?.contract,
        JSON.stringify(r.path),
      ].join(" ").toLowerCase().includes(q));
}
function jsonSection(parent, title, data) {
  if (data === undefined) return;
  const block = el("details");
  block.append(el("summary", title), el("pre", JSON.stringify(data, null, 2)));
  parent.append(block);
}
async function copyHash(hash, button) {
  try {
    await navigator.clipboard.writeText(hash);
    $("toast").textContent = "Hash copied.";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(button.previousSibling);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    $("toast").textContent =
      "Hash selected. Press Ctrl+C or Command+C to copy.";
  }
}
function detail(record) {
  selected = record.id;
  const host = $("detail");
  host.replaceChildren();
  host.append(el("h2", record.name));
  const list = el("dl");
  for (
    const [key, value] of [
      ["Kind", record.kind],
      ["File", record.file],
      ["Runner status", record.runnerStatus || "unavailable"],
      ["Observed status", record.status],
      ["Started", record.startedAt],
      [
        "Duration",
        record.durationMs === undefined
          ? "unavailable"
          : number(record.durationMs) + " ms",
      ],
    ]
  ) list.append(el("dt", key), el("dd", value));
  host.append(list);
  if (record.execution) {
    const e = record.execution;
    host.append(
      el("h3", "Transaction"),
      el("p", e.kind + " · chain: " + e.chain),
    );
    for (
      const [label, hash] of [["Hash", e.hash], ["Inner hash", e.innerHash]]
    ) {
      if (hash) {
        const row = el("div", undefined, "hash");
        const value = el("span", hash, "mono");
        const copy = el("button", "Copy " + label.toLowerCase());
        copy.onclick = () => copyHash(hash, copy);
        row.append(value, copy);
        host.append(el("strong", label), row);
      }
    }
    jsonSection(host, "Network, contract and operations", {
      network: e.network,
      client: e.client,
      contract: e.contract,
      method: e.method,
      operations: e.operations,
    });
    jsonSection(host, "Simulation budgets (not actual usage)", e.simulations);
    jsonSection(host, "Authorization", e.authorization);
    jsonSection(host, "Submitted transaction", e.submitted);
    jsonSection(host, "Confirmed fees (stroops)", {
      feeCharged: e.feeCharged,
      resourceFees: e.resourceFees,
    });
    jsonSection(host, "Pipeline stages", e.stages);
  }
  jsonSection(host, "Captured context and result", record.data);
  jsonSection(host, "Error", record.error);
  const related = report.records.filter((r) =>
    r.testId === record.id || r.callId === record.id || r.parentId === record.id
  );
  if (related.length) {
    host.append(el("h3", "Related evidence"));
    for (const child of related) host.append(recordButton(child));
  }
  for (const button of document.querySelectorAll("button[data-record]")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.record === selected),
    );
  }
}
function recordButton(record) {
  const button = el("button", record.name, "record " + status(record));
  button.dataset.record = record.id;
  button.append(el("small", record.kind + " · " + status(record)));
  button.onclick = () => detail(record);
  return button;
}
function evidence() {
  const host = $("tree");
  host.replaceChildren();
  const filtered = report.records.filter(matches);
  const files = new Map();
  for (const r of filtered) {
    const items = files.get(r.file) || [];
    items.push(r);
    files.set(r.file, items);
  }
  if (!files.size) host.append(el("p", "No matching evidence.", "empty"));
  for (const [file, records] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const group = el("details");
    group.open = files.size <= 10;
    group.append(
      el("summary", fileLabel(file) + " (" + records.length + ")"),
    );
    group.title = file;
    for (const record of records.slice(0, 200)) {
      group.append(recordButton(record));
    }
    if (records.length > 200) {
      group.append(el("p", "Showing 200 items. Filter to narrow the list."));
    }
    host.append(group);
  }
  if (selected && !filtered.some((r) => r.id === selected)) {
    selected = undefined;
    $("detail").replaceChildren(
      el("p", "Select evidence to inspect.", "empty"),
    );
  }
}
function value(r, key) {
  const e = r.execution;
  const p = e.simulations.at(-1);
  return ({
    name: r.name,
    kind: e.kind,
    client: e.client,
    contract: e.contract,
    method: e.method,
    duration: r.durationMs,
    instructions: p?.instructions,
    reads: p?.readOnlyEntries,
    writes: p?.readWriteEntries,
    readBytes: p?.diskReadBytes,
    writeBytes: p?.writeBytes,
    fee: p?.minResourceFee,
  })[key];
}
const columns = [
  ["name", "Execution"],
  ["kind", "Kind"],
  ["client", "Client"],
  ["contract", "Contract"],
  ["method", "Method"],
  ["duration", "Duration (ms)"],
  ["instructions", "Instructions (budget)"],
  ["reads", "Read-only entries"],
  ["writes", "Read-write entries"],
  ["readBytes", "Disk read (bytes)"],
  ["writeBytes", "Write (bytes)"],
  ["fee", "Min resource fee (stroops)"],
];
for (const [key, label] of columns) {
  const th = el("th");
  th.scope = "col";
  const button = el("button", label);
  button.onclick = () => {
    descending = sortKey === key ? !descending : true;
    sortKey = key;
    page = 0;
    profiles();
  };
  th.append(button);
  $("profile-head").append(th);
}
function profiles() {
  const rows = report.records.filter((r) => r.execution && matches(r));
  rows.sort((a, b) => {
    const x = value(a, sortKey), y = value(b, sortKey);
    if (x === undefined) return y === undefined ? 0 : 1;
    if (y === undefined) return -1;
    const result = sortKey === "fee"
      ? (BigInt(x) < BigInt(y) ? -1 : BigInt(x) > BigInt(y) ? 1 : 0)
      : typeof x === "number"
      ? x - y
      : String(x).localeCompare(String(y));
    return result * (descending ? -1 : 1);
  });
  const body = $("profile-body");
  body.replaceChildren();
  for (const r of rows.slice(page * perPage, (page + 1) * perPage)) {
    const row = el("tr");
    for (const [key] of columns) {
      const td = el("td");
      const v = value(r, key);
      if (key === "name") {
        const button = el("button", r.name);
        button.onclick = () => {
          tab("evidence");
          detail(r);
        };
        td.append(button);
      } else {
        td.textContent = typeof v === "number" ? number(v) : v ?? "—";
        if (typeof v === "number" || key === "fee") td.className = "num";
      }
      row.append(td);
    }
    body.append(row);
  }
  $("profile-empty").hidden = rows.length > 0;
  $("page").textContent = rows.length
    ? "Showing " + (page * perPage + 1) + "–" +
      Math.min((page + 1) * perPage, rows.length) + " of " + rows.length
    : "0 executions";
  $("previous").disabled = page === 0;
  $("next").disabled = (page + 1) * perPage >= rows.length;
  for (const [i, [key]] of columns.entries()) {
    $("profile-head").children[i].setAttribute(
      "aria-sort",
      key === sortKey ? (descending ? "descending" : "ascending") : "none",
    );
  }
  const aggregate = $("groups");
  aggregate.replaceChildren();
  // Aggregates follow filters by recalculating from the matching execution IDs.
  for (const group of groups) {
    const members = rows.filter((r) => {
      const e = r.execution;
      return e.network === group.network && e.client === group.client &&
        e.contract === group.contract && e.method === group.method &&
        e.kind === group.kind;
    });
    if (!members.length) continue;
    const block = el("details");
    block.append(
      el(
        "summary",
        [group.client, group.contract, group.method, group.kind].filter(Boolean)
          .join(" · ") + " — " + members.length + " executions",
      ),
    );
    const stats = (values) => {
      values = values.filter((v) => v !== undefined).sort((a, b) => a - b);
      if (!values.length) return null;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) /
        values.length;
      return {
        samples: values.length,
        min: values[0],
        max: values.at(-1),
        mean,
        p50: values[Math.ceil(values.length * .5) - 1],
        p95: values[Math.ceil(values.length * .95) - 1],
        variance,
        standardDeviation: Math.sqrt(variance),
      };
    };
    block.open = true;
    block.append(el("p", group.network || "Network unavailable"));
    const table = el("table"), head = el("tr");
    for (
      const label of [
        "Metric",
        "Samples",
        "Min",
        "Mean",
        "Max",
        "p50",
        "p95",
        "Std. deviation",
        "Variance",
      ]
    ) head.append(el("th", label));
    const thead = el("thead");
    thead.append(head);
    table.append(thead);
    const tbody = el("tbody");
    for (
      const [label, samples] of [[
        "Duration (ms)",
        members.map((r) => r.durationMs),
      ], [
        "Instructions (budget)",
        members.map((r) => r.execution.simulations.at(-1)?.instructions),
      ], [
        "Disk read (bytes, budget)",
        members.map((r) => r.execution.simulations.at(-1)?.diskReadBytes),
      ], [
        "Write (bytes, budget)",
        members.map((r) => r.execution.simulations.at(-1)?.writeBytes),
      ]]
    ) {
      const stat = stats(samples), row = el("tr");
      row.append(el("td", label));
      for (
        const key of [
          "samples",
          "min",
          "mean",
          "max",
          "p50",
          "p95",
          "standardDeviation",
          "variance",
        ]
      ) row.append(el("td", number(stat?.[key]), "num"));
      tbody.append(row);
    }
    table.append(tbody);
    const scroll = el("div", undefined, "table-scroll");
    scroll.append(table);
    block.append(scroll);
    aggregate.append(block);
  }
}
function tab(name) {
  $("evidence").hidden = name !== "evidence";
  $("profiles").hidden = name !== "profiles";
  $("evidence-tab").setAttribute("aria-pressed", String(name === "evidence"));
  $("profile-tab").setAttribute("aria-pressed", String(name === "profiles"));
}
$("evidence-tab").onclick = () => tab("evidence");
$("profile-tab").onclick = () => tab("profiles");
$("previous").onclick = () => {
  page--;
  profiles();
};
$("next").onclick = () => {
  page++;
  profiles();
};
for (const id of ["search", "file", "status", "client", "method"]) {
  $(id).addEventListener("input", () => {
    page = 0;
    evidence();
    profiles();
  });
}
evidence();
profiles();
`;
