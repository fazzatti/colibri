/**
 * @module
 * Portable evidence aggregation, profiling statistics and standalone HTML rendering.
 */
import type { RecorderReport } from "@/recorder/types.ts";
import { styles } from "@/recorder/report/styles.ts";
import { browserScript } from "@/recorder/report/browser.ts";

function embedded(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(
    /\u2028/g,
    "\\u2028",
  ).replace(/\u2029/g, "\\u2029");
}
/** Render a self-contained file:// report without fetching scripts, fonts or evidence. */
export function renderReport(report: RecorderReport): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Colibri test evidence</title><style>${styles}</style></head><body>
<header><div class="title-row"><h1>Colibri test evidence</h1><p id="run"></p></div><nav aria-label="Report views"><button id="summary-tab" aria-pressed="true">Summary</button><button id="evidence-tab" aria-pressed="false">Evidence</button><button id="profiling-tab" aria-pressed="false">Profiling</button></nav></header>
<div class="context-bar"><nav id="breadcrumbs" aria-label="Current context"></nav><button id="clear-context" hidden>Clear context</button></div>
<div class="toolbar"><label>Search<input id="search" type="search" placeholder="Test, file, contract or hash"></label><details id="advanced-filters"><summary id="filter-summary">Filters</summary><div class="filter-fields"><label>Test outcome<select id="test-status"><option value="">All tests</option><option>passed</option><option>failed</option><option>skipped</option><option>unknown</option></select></label><label>Pipeline outcome<select id="outcome"><option value="">All pipeline calls</option><option>passed</option><option>failed</option><option>running</option></select></label><label>Chain outcome<select id="chain"><option value="">All chain outcomes</option><option>not-submitted</option><option>unknown</option><option>confirmed-success</option><option>confirmed-failed</option></select></label><label>Client<select id="client"><option value="">All clients</option></select></label><label>Method<select id="method"><option value="">All methods</option></select></label></div></details><button id="clear-filters">Clear filters</button><span id="filter-notice" role="status"></span></div>
<div id="warnings" role="status"></div>
<main><section id="summary-view" aria-label="Run summary"></section>
<section id="evidence" class="layout" hidden aria-label="Test evidence"><aside id="tree" aria-label="Contexts and files"></aside><div id="detail"></div></section>
<section id="profiles" hidden aria-label="Transaction profiling"><h2>Profiling</h2><p>Each row is one recorded pipeline call. A read can simulate without submitting; an invoke can simulate, sign and submit; a classic call can contain several Stellar operations. Calls are counted separately from tests and submitted transactions.</p><p>Timings cover observed pipeline hooks. Resources and minimum resource fees come from the last captured simulation and represent budgets, not actual usage. Confirmed fees come from the chain result. Missing measurements appear as —.</p><div class="profile-controls"><label>View<select id="profile-mode"><option value="executions">Individual pipeline calls</option><option value="groups">Compare repeated calls</option></select></label><label id="cross-label" class="checkbox" hidden><input id="cross-files" type="checkbox">Group across files</label></div><p id="group-explanation" hidden>Groups share the same file, network, client label, contract, method, kind, operation sequence and pipeline/chain outcomes. Missing identities stay separate. A group may contain only one call. Enable grouping across files explicitly to remove the file boundary. Select a row to see the exact calls and sample counts.</p><p class="context-label">All measurements are shown together. Click a column heading to sort, use its min/max fields to filter, and scroll the table horizontally to compare resources and fees.</p><p id="profile-empty" class="empty" hidden>No matching pipeline calls. Clear filters or select another context.</p><div id="profile-content"></div></section></main>
<script type="application/json" id="evidence-data">${
    embedded(report)
  }</script><script>${browserScript}</script></body></html>`;
}
export { mergeFragments, summarize } from "@/recorder/report/aggregate.ts";
export { profileGroups, statistics } from "@/recorder/report/statistics.ts";
export type { ProfileGroup, Statistics } from "@/recorder/report/statistics.ts";
export type {
  Evidence,
  EvidenceRecord,
  ExecutionEvidence,
  RecorderReport,
  ResourceProfile,
  StageEvidence,
} from "@/recorder/types.ts";
