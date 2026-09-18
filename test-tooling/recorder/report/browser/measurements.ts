/** Exact metric comparisons, visible range filters and measurement summaries. */
export const measurementsScript: string = String.raw`
function measure(r, key) {
  const e = r.execution, p = e.simulations.at(-1);
  return ({ duration: r.durationMs, instructions: p?.instructions, reads: p?.readOnlyEntries,
    writes: p?.readWriteEntries, readBytes: p?.diskReadBytes, writeBytes: p?.writeBytes,
    fee: p?.minResourceFee, charged: e.feeCharged })[key];
}
const feeMetric = (key) => key === "fee" || key === "charged";
const available = (value) => value !== undefined && value !== null;
const formatMetric = (value) => typeof value === "number" ? number(value) : value ?? "—";
function compareMetric(a, b, key) {
  const x = feeMetric(key) ? BigInt(a) : a, y = feeMetric(key) ? BigInt(b) : b;
  return x < y ? -1 : x > y ? 1 : 0;
}
function sortMetric(a, b, key, descending) {
  // Missing measurements stay last in either direction; they never become zero.
  if (!available(a)) return available(b) ? 1 : 0;
  if (!available(b)) return -1;
  return compareMetric(a, b, key) * (descending ? -1 : 1);
}
function metricValues(rows, key) {
  return rows.map((r) => measure(r, key)).filter(available).sort((a, b) => compareMetric(a, b, key));
}
function medianMetric(rows, key) {
  const values = metricValues(rows, key); return values[Math.ceil(values.length * .5) - 1];
}
function rangeValue(text, key) {
  if (!text.trim()) return;
  if (feeMetric(key)) return /^\d+$/.test(text.trim()) ? BigInt(text.trim()) : null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
function metricRange(key) {
  const min = rangeValue(state[key + "Min"], key), max = rangeValue(state[key + "Max"], key);
  const invalid = min === null || max === null || (min !== undefined && max !== undefined && min > max);
  return { min, max, invalid, active: state[key + "Min"] !== "" || state[key + "Max"] !== "" };
}
function withinRanges(r) {
  return metricColumns.every(([key]) => {
    const { min, max, invalid, active } = metricRange(key);
    if (!active) return true;
    const raw = measure(r, key);
    if (invalid || !available(raw)) return false;
    const value = feeMetric(key) ? BigInt(raw) : raw;
    return (min === undefined || value >= min) && (max === undefined || value <= max);
  });
}
function measurementHeading(th, key, title, grouped = false) {
  th.classList.add("num", "metric-column");
  const sortKey = grouped ? state.order : state.sort, descending = grouped ? state.reverse : state.desc;
  const control = button(title, () => navigate(grouped
    ? { order: key, reverse: sortKey === key && descending ? "" : "1", page: "0" }
    : { sort: key, desc: sortKey === key && descending ? "" : "1", page: "0" }), "sort-button");
  control.append(el("span", sortKey === key ? descending ? " ↓" : " ↑" : " ↕", "sort-indicator"));
  control.setAttribute("aria-label", title);
  th.replaceChildren(control);
  th.setAttribute("aria-sort", sortKey === key ? descending ? "descending" : "ascending" : "none");
}
function measurementFilters(th, key, title) {
  const range = el("div", undefined, "range-inputs"), { invalid } = metricRange(key);
  for (const [suffix, label] of [["Min", "Min"], ["Max", "Max"]]) {
    const field = el("label", label), input = el("input");
    input.type = "text"; input.inputMode = feeMetric(key) ? "numeric" : "decimal";
    input.id = "range-" + key + suffix; input.value = state[key + suffix];
    input.placeholder = "Any"; input.setAttribute("aria-label", title + " " + label.toLowerCase());
    input.setAttribute("aria-invalid", String(invalid));
    input.oninput = () => navigate({ [key + suffix]: input.value, page: "0" }, true);
    field.append(input); range.append(field);
  }
  if (invalid) { const error = el("small", "Use nonnegative values with min ≤ max" + (feeMetric(key) ? " (whole stroops)." : "."), "failed"); error.setAttribute("role", "status"); range.append(error); }
  th.append(range);
}
function stats(values) {
  values = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!values.length) return;
  let mean = 0, m2 = 0;
  values.forEach((v, i) => { const delta = v - mean; mean += delta / (i + 1); m2 += delta * (v - mean); });
  return { count: values.length, min: values[0], max: values.at(-1), mean,
    median: values[Math.ceil(values.length * .5) - 1], p95: values[Math.ceil(values.length * .95) - 1],
    variance: m2 / values.length, deviation: Math.sqrt(m2 / values.length) };
}
function metricDetails(host, rows) {
  const body = table(host, ["Measurement", "Samples / calls", "Median", "Min–max", "Standard deviation"]);
  const more = el("details", undefined, "data-section"); more.append(el("summary", "More statistics: mean, p95 and variance"));
  const advanced = table(more, ["Measurement", "Mean", "p95", "Population variance (squared units)"]);
  for (const [key, title] of metricColumns) {
    const values = metricValues(rows, key), s = stats(values), row = el("tr");
    cell(row, title); cell(row, values.length + " / " + rows.length, "num");
    cell(row, formatMetric(medianMetric(rows, key)), "num");
    cell(row, values.length ? formatMetric(values[0]) + "–" + formatMetric(values.at(-1)) : "—", "num");
    cell(row, feeMetric(key) ? "—" : number(s?.deviation), "num"); body.append(row);
    if (!feeMetric(key)) {
      const extra = el("tr"); cell(extra, title); cell(extra, number(s?.mean), "num"); cell(extra, number(s?.p95), "num"); cell(extra, number(s?.variance), "num"); advanced.append(extra);
    }
  }
  host.append(el("p", "Sample counts exclude missing values. Median uses the nearest-rank sample. Standard deviation describes spread in the metric's units; one call cannot show repeatability. Fees retain exact whole stroops; their mean and deviation are not calculated."), more);
}
`;
