/** Event payload filters preserve confirmed/simulated provenance and captured counts. */
export const eventsScript: string = String.raw`
function eventMatches(item) {
  const diagnostic = item?.source === "diagnostic" || item?.type === "diagnostic" || item?.successful === false;
  const type = diagnostic ? "diagnostic" : item?.type;
  return (!state.eventType || type === state.eventType) && (!state.eventContract || item?.contract === state.eventContract);
}
function eventFilters(host, execution) {
  const controls = el("div", undefined, "filter-fields event-filters");
  const collections = [execution.events, ...execution.simulations.map((p) => p.events)];
  const contracts = [...new Set(collections.flatMap((events) => Array.isArray(events?.items) ? events.items.map((item) => item?.contract).filter((id) => typeof id === "string" && id) : []))].sort();
  if (state.eventContract && !contracts.includes(state.eventContract)) contracts.push(state.eventContract);
  for (const [key, title, choices] of [
    ["eventType", "Event type", [["", "All types"], ["contract", "Contract"], ["diagnostic", "Diagnostic / unsuccessful"], ["system", "System"]]],
    ["eventOrigin", "Event origin", [["", "Confirmed and simulated"], ["confirmed", "Confirmed execution"], ["simulation", "Simulation"]]],
    ["eventContract", "Event contract", [["", "All contracts"], ...contracts.map((id) => [id, id])]]
  ]) {
    const label = el("label", title), select = el("select");
    select.id = "filter-" + key; select.setAttribute("aria-label", title);
    for (const [value, text] of choices) { const option = el("option", text); option.value = value; select.append(option); }
    select.value = state[key]; select.onchange = () => navigate({ [key]: select.value });
    label.append(select); controls.append(label);
  }
  const clear = button("Clear event filters", () => navigate({ eventType: "", eventOrigin: "", eventContract: "" }));
  clear.disabled = !state.eventType && !state.eventOrigin && !state.eventContract; controls.append(clear);
  host.append(controls);
}
function eventCollection(host, title, events) {
  host.append(el("h3", title));
  if (!events) { host.append(el("p", "Not captured. Re-record with event collection enabled.")); return; }
  host.append(el("p", events.count + " events: " + events.contractCount + " contract, " + events.systemCount + " system. " + events.diagnosticCount + " diagnostic or unsuccessful-call events (excluded from the event count)."));
  if (events.omitted) host.append(el("p", events.omitted + " payloads omitted by the recording level or entry limit."));
  if (!Array.isArray(events.items)) { jsonSection(host, "Captured events", events.items, true); return; }
  const visible = events.items.map((item, index) => ({ item, index })).filter(({ item }) => eventMatches(item));
  host.append(el("p", "Showing " + visible.length + " of " + events.items.length + " captured payloads", "event-match-count"));
  if (!visible.length) { host.append(el("p", "No events match these filters.", "empty")); return; }
  const body = table(host, ["#", "Source / type", "Contract", "Topics and data"]);
  body.className = "event-rows";
  visible.forEach(({ item, index }) => {
    const row = el("tr"); cell(row, index + 1, "num");
    cell(row, [item?.source, item?.type, item?.stage, item?.operationIndex === undefined ? null : "operation " + (item.operationIndex + 1), item?.successful === false ? "unsuccessful call" : null].filter(Boolean).join(" / "));
    cell(row, item?.contract || "—", "event-contract");
    const data = el("div");
    if (item && typeof item === "object") { data.append(el("strong", "Topics"), el("pre", JSON.stringify(item.topics, null, 2)), el("strong", "Data"), el("pre", JSON.stringify(item.data, null, 2))); }
    else data.append(el("pre", JSON.stringify(item)));
    cell(row, data); body.append(row);
  });
}
function eventPanel(host, execution) {
  host.append(el("p", "Confirmed events come from transaction metadata. Simulation events are previews and are never added to the confirmed count. Diagnostic wrappers are not counted twice."));
  eventFilters(host, execution);
  if (state.eventOrigin !== "simulation") eventCollection(host, "Confirmed execution", execution.events);
  if (state.eventOrigin !== "confirmed") {
    if (!execution.simulations.length) host.append(el("p", "No simulation events were captured."));
    execution.simulations.forEach((profile, index) => eventCollection(host, "Simulation " + (index + 1) + " · " + profile.stage, profile.events));
  }
}
`;
