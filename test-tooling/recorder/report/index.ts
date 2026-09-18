/**
 * @module
 * Portable evidence aggregation, profiling statistics and standalone HTML rendering.
 */
import type { RecorderReport } from "@/recorder/types.ts";
import { profileGroups } from "@/recorder/report/statistics.ts";
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
<header><h1>Colibri test evidence</h1><p id="run"></p><div id="summary"></div><nav aria-label="Report views"><button id="evidence-tab" aria-pressed="true">Evidence</button><button id="profile-tab" aria-pressed="false">Profiling</button></nav></header>
<div class="toolbar"><label>Search<input id="search" type="search" placeholder="Test, contract, or transaction hash"></label><label>File<select id="file"><option value="">All files</option></select></label><label>Status<select id="status"><option value="">All statuses</option><option>passed</option><option>failed</option><option>skipped</option><option>unknown</option><option>running</option></select></label><label>Client<select id="client"><option value="">All clients</option></select></label><label>Method<select id="method"><option value="">All methods</option></select></label></div>
<div id="warnings" role="status"></div><section id="evidence" class="layout" aria-label="Test evidence"><aside id="tree" aria-label="Files and observations"></aside><main><div id="toast" role="status" aria-live="polite"></div><div id="detail"><p class="empty">Select evidence to inspect.</p></div></main></section>
<section id="profiles" hidden aria-label="Transaction profiling"><h2>Profiled executions</h2><p>Timings cover observed pipeline hooks. Simulation resources are recommended budgets, not measured usage. Missing measurements appear as —. Fees use stroops.</p><div class="table-scroll"><table><thead><tr id="profile-head"></tr></thead><tbody id="profile-body"></tbody></table></div><p id="profile-empty" class="empty" hidden>No matching executions.</p><div class="pager"><button id="previous">Previous</button><span id="page"></span><button id="next">Next</button></div><h2>Grouped measurements</h2><p>Groups separate network, client, contract, method and execution kind. Statistics follow the filters above; variance is population variance. Each metric reports its available sample count.</p><div id="groups"></div></section>
<script type="application/json" id="evidence-data">${
    embedded(report)
  }</script><script type="application/json" id="profile-data">${
    embedded(profileGroups(report))
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
