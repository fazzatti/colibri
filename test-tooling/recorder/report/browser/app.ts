/** View controls, persistent offline URLs and browser-history restoration. */
export const appScript: string = String.raw`
function render() {
  breadcrumbs();
  for (const tab of ["summary", "evidence", "profiling"]) {
    $(tab + "-tab").setAttribute("aria-pressed", String(state.tab === tab));
  }
  $("summary-view").hidden = state.tab !== "summary";
  $("evidence").hidden = state.tab !== "evidence";
  $("profiles").hidden = state.tab !== "profiling";
  const inputs = { search: "q", "test-status": "test", outcome: "outcome", chain: "chain", client: "client", method: "method", "profile-mode": "mode" };
  for (const [id, key] of Object.entries(inputs)) $(id).value = state[key];
  const activeFilters = [state.test, state.outcome, state.chain, state.client, state.method].filter(Boolean).length;
  $("filter-summary").textContent = activeFilters ? "Filters (" + activeFilters + ")" : "Filters";
  $("cross-files").checked = Boolean(state.cross);
  $("cross-label").hidden = state.mode !== "groups";
  $("clear-context").hidden = !state.scope && !state.file && !state.record;
  $("filter-notice").textContent = state.q || state.test || state.outcome || state.chain || state.client || state.method
    ? "Filters active across report views." : "";
  if (metricColumns.some(([key]) => metricRange(key).active)) $("filter-notice").textContent += " Measurement ranges active in Profiling.";
  const focused = document.activeElement;
  const rangeId = focused?.id?.startsWith("range-") ? focused.id : "";
  const cursor = rangeId ? [focused.selectionStart, focused.selectionEnd] : null;
  const profileScroll = document.querySelector(".profile-scroll");
  const scroll = rangeId && profileScroll ? [profileScroll.scrollLeft, profileScroll.scrollTop] : null;
  const restore = focused?.getAttribute("aria-label");
  const identity = focused?.dataset.context || focused?.dataset.suite;
  const identityKey = focused?.dataset.context ? "context" : "suite";
  if (state.tab !== "summary") $("summary-view").replaceChildren();
  if (state.tab !== "evidence") { $("detail").replaceChildren(); $("tree").replaceChildren(); }
  if (state.tab !== "profiling") $("profile-content").replaceChildren();
  if (state.tab === "summary") summaryView();
  if (state.tab === "evidence") evidenceView();
  if (state.tab === "profiling") profileView();
  for (const table of document.querySelectorAll("table")) {
    const sample = table.querySelector("tbody tr"), headings = table.querySelectorAll("thead tr:first-child th");
    if (sample) [...sample.children].forEach((td, i) => { if (td.classList.contains("num")) headings[i]?.classList.add("num"); });
  }
  if (rangeId && $(rangeId)) {
    $(rangeId).focus({ preventScroll: true }); $(rangeId).setSelectionRange(...cursor);
    const nextScroll = document.querySelector(".profile-scroll");
    if (scroll && nextScroll) { nextScroll.scrollLeft = scroll[0]; nextScroll.scrollTop = scroll[1]; }
  } else if (focused && !focused.isConnected) {
    const target = identity
      ? [...document.querySelectorAll("button[data-" + identityKey + "]")].find((n) => n.dataset[identityKey] === identity)
      : restore && [...document.querySelectorAll("button[aria-label]")].find((n) => n.getAttribute("aria-label") === restore);
    if (target) target.focus();
    else { const heading = document.querySelector("section:not([hidden]) h2"); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } }
  }
}
for (const tab of ["summary", "evidence", "profiling"]) $(tab + "-tab").onclick = () => navigate({ tab });
for (const [id, key] of [["test-status", "test"], ["outcome", "outcome"], ["chain", "chain"], ["client", "client"], ["method", "method"], ["profile-mode", "mode"]]) {
  $(id).onchange = () => navigate({ [key]: $(id).value, page: "0", group: "" });
}
$("search").oninput = () => navigate({ q: $("search").value, page: "0", group: "" }, true);
$("cross-files").onchange = () => navigate({ cross: $("cross-files").checked ? "1" : "", group: "", page: "0" });
$("clear-context").onclick = () => navigate({ scope: "", file: "", record: "", group: "", page: "0" });
$("clear-filters").onclick = () => {
  const ranges = {};
  for (const [key] of metricColumns) { ranges[key + "Min"] = ""; ranges[key + "Max"] = ""; }
  navigate({ ...ranges, q: "", test: "", outcome: "", chain: "", client: "", method: "", group: "", page: "0" });
};
for (const field of ["client", "method"]) {
  for (const value of [...new Set(report.records.map((r) => r.execution?.[field]).filter(Boolean))].sort()) {
    const option = el("option", value); option.value = value; $(field).append(option);
  }
}
$("run").textContent = (report.complete ? "Recording complete" : "Incomplete evidence") +
  (report.exitCode === undefined ? " · runner exit unavailable" : " · runner/source exit " + report.exitCode);
for (const message of report.diagnostics) $("warnings").append(el("p", message));
if (report.exitCode) $("warnings").append(el("p", "A source runner exited with code " + report.exitCode + ". The Summary separates that result from the currently selected tests."));
history.scrollRestoration = "manual";
window.addEventListener("popstate", (event) => {
  readState(); render();
  if (event.state?.scroll) requestAnimationFrame(() => scrollTo(...event.state.scroll));
});
window.addEventListener("hashchange", () => { readState(); render(); });
readState(); render();
`;
