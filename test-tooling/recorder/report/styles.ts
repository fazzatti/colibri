/** Self-contained report stylesheet; no downloaded fonts or assets. */
export const styles: string = `
:root {
  color-scheme: light dark;
  --bg: #f6f7f8; --panel: #fff; --ink: #17202a; --muted: #56616c;
  --line: #ccd3da; --accent: #086e77; --hover: #edf3f5; --selected: #dceef0;
  --pass: #207342; --fail: #b42318; --warn: #946000;
  font: 14px/1.5 system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #15191d; --panel: #1d2329; --ink: #edf0f2; --muted: #aab4bf;
    --line: #46515d; --accent: #73cbd1; --hover: #26333d; --selected: #21434b;
    --pass: #8ed8a8; --fail: #ff9a8e; --warn: #f0c770;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); }
header { padding: 20px 24px 16px; border-bottom: 1px solid var(--line); background: var(--panel); }
h1, h2, h3 { overflow-wrap: anywhere; }
h1 { font-size: 21px; margin: 0; }
h2 { font-size: 18px; margin: 12px 0; }
h3 { font-size: 15px; margin: 24px 0 12px; }
p { margin: 8px 0; color: var(--muted); }
button, input, select { font: inherit; color: inherit; background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 7px 10px; }
button { cursor: pointer; }
button:hover { background: var(--hover); }
button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); background: var(--selected); }
button:disabled { opacity: .6; cursor: default; }
button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
nav { display: flex; gap: 8px; margin-top: 16px; }
.title-row { display: flex; align-items: baseline; gap: 20px; flex-wrap: wrap; }
.title-row p { font-size: 12px; }
.context-bar { padding: 12px 24px; border-bottom: 1px solid var(--line); display: flex; justify-content: flex-start; flex-wrap: wrap; gap: 12px; align-items: center; }
#breadcrumbs { margin: 0; flex-wrap: wrap; align-items: baseline; gap: 8px; min-width: 0; }
#clear-context { flex: 0 0 auto; }
#breadcrumbs strong { overflow-wrap: anywhere; }
#breadcrumbs button, .text-button { padding: 0; border: 0; background: transparent; color: var(--accent); text-align: left; overflow-wrap: anywhere; }
#breadcrumbs button:hover, .text-button:hover { text-decoration: underline; }
.toolbar { display: flex; flex-wrap: wrap; gap: 12px; padding: 16px 24px; align-items: end; }
label { display: grid; gap: 4px; font-size: 12px; color: var(--muted); }
#search { width: 290px; max-width: 100%; }
.filter-fields { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px 0; }
#advanced-filters[open] { flex-basis: 100%; }
#advanced-filters > summary { padding: 6px 10px; border: 1px solid var(--line); border-radius: 4px; }
#filter-notice { font-size: 12px; color: var(--muted); }
#warnings { padding: 0 24px; color: var(--warn); }
#warnings:empty { display: none; }
.layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); border-top: 1px solid var(--line); min-height: 65vh; }
#tree { padding: 12px 8px; border-right: 1px solid var(--line); overflow: auto; max-height: 80vh; position: sticky; top: 0; background: var(--panel); }
#tree h2 { margin: 8px 12px 16px; font-size: 13px; color: var(--muted); }
.file-tree { list-style: none; padding: 0; margin: 0; }
.file-tree .file-tree { margin-left: 18px; padding-left: 8px; border-left: 1px solid var(--line); }
.tree-row, .row-button { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; border: 0; border-radius: 0; background: transparent; padding: 9px 8px; min-height: 38px; }
.tree-row { font-size: 12px; margin-block: 2px; border-left: 3px solid transparent; }
.tree-row:hover, .row-button:hover { background: var(--hover); }
.tree-row[aria-current] { background: var(--selected); border-left-color: var(--accent); color: var(--accent); font-weight: 600; }
.row-name { overflow-wrap: anywhere; min-width: 0; }
.arrow { width: 10px; flex: 0 0 10px; text-align: center; color: var(--muted); }
.item-icon { flex: 0 0 12px; width: 12px; height: 14px; border: 1px solid var(--muted); border-radius: 1px; }
.item-icon.test { flex: 0 0 16px; width: 16px; height: 16px; border: 0; border-radius: 0; color: currentColor; }
.icon-label { display: inline-flex; align-items: baseline; gap: 8px; }
.icon-label .item-icon { align-self: center; }
.item-icon.folder { height: 10px; position: relative; background: var(--bg); }
.item-icon.folder::before { content: ""; position: absolute; width: 6px; height: 3px; border: 1px solid var(--muted); border-bottom: 0; left: -1px; top: -4px; }
.row-count { color: var(--muted); margin-left: auto; white-space: nowrap; font-weight: normal; }
#detail { padding: 16px 24px 32px; min-width: 0; }
#summary-view { padding: 8px 24px 24px; }
.metrics { display: flex; flex-wrap: wrap; gap: 28px; padding: 16px 0; border-block: 1px solid var(--line); }
.metrics div { display: grid; gap: 3px; }
.metrics strong { font-size: 24px; font-weight: 600; font-variant-numeric: tabular-nums; }
.metrics span, .muted { color: var(--muted); }
.metrics span, .context-label { font-size: 12px; }
.context-label { display: block; color: var(--muted); margin-top: 5px; overflow-wrap: anywhere; }
.badge { display: inline-block; font-size: 12px; font-weight: 600; }
.passed, .success { color: var(--pass); }
.failed { color: var(--fail); }
.unknown, .running { color: var(--warn); }
.table-scroll { overflow: auto; border: 1px solid var(--line); background: var(--panel); }
table { border-collapse: separate; border-spacing: 0; width: 100%; font-variant-numeric: tabular-nums; }
th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); text-align: left; vertical-align: top; }
th:last-child, td:last-child { border-right: 0; }
tbody tr:last-child td { border-bottom: 0; }
th { font-size: 12px; color: var(--muted); background: var(--bg); font-weight: 600; }
.num { text-align: right; white-space: nowrap; }
th.num { white-space: normal; }
.action-row { cursor: pointer; }
.action-row:hover td, .action-row:focus-within td { background: var(--hover); }
.action-row:has(.row-button) > td:first-child { padding: 0; }
.action-row .row-button { min-height: 44px; }
#file-body > tr > td:first-child, #test-body > tr > td:first-child { min-width: 250px; }
.pager { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 12px 0; }
.evidence-overview { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; }
.facts-table { border: 1px solid var(--line); background: var(--panel); table-layout: fixed; }
.facts-table th { width: 36%; }
.facts-table th, .facts-table td { overflow-wrap: anywhere; padding: 8px 12px; }
.facts-table tr:last-child th { border-bottom: 0; }
.detail-tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px 0; margin-top: 20px; position: sticky; top: 0; z-index: 2; background: var(--bg); border-bottom: 1px solid var(--line); }
.detail-tabs [aria-selected="true"] { color: var(--accent); background: var(--selected); border-color: var(--accent); }
.detail-panel { padding: 16px 0; }
.detail-panel > .data-section:first-child { padding-top: 0; }
.hash { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 20px 0; padding: 12px; background: var(--panel); border: 1px solid var(--line); }
.hash code { overflow-wrap: anywhere; min-width: 0; }
.hash button { min-width: 90px; }
.copy-feedback { font-size: 12px; }
.copy-feedback:empty { display: none; }
summary { cursor: pointer; overflow-wrap: anywhere; }
.data-section { padding: 12px 0; border-bottom: 1px solid var(--line); }
.data-section > summary { font-weight: 500; }
pre { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--panel); padding: 16px; border: 1px solid var(--line); font-size: 12px; max-height: 520px; overflow: auto; }
#profiles { padding: 0 24px 24px; }
.profile-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; margin: 16px 0; }
.checkbox { display: flex; align-items: center; }
.measurement-notice { font-size: 12px; margin: 16px 0 8px; }
.profile-scroll { max-height: 72vh; }
.profile-table { table-layout: fixed; width: calc(var(--columns) * 150px + 150px); }
.profile-table th, .profile-table td { width: 150px; overflow-wrap: anywhere; }
.profile-table th:first-child, .profile-table td:first-child { width: 300px; position: sticky; left: 0; z-index: 1; background: var(--panel); border-right: 2px solid var(--line); }
.profile-table th { position: sticky; top: 0; z-index: 2; vertical-align: bottom; background: var(--bg); }
.profile-table th:first-child { z-index: 3; background: var(--bg); }
.profile-table td.num { font-size: 13px; }
.compact-context { font-size: 11px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sort-button { display: block; width: 100%; border: 0; padding: 0; background: none; text-align: right; font-weight: 600; font-size: 12px; }
.sort-indicator { color: var(--accent); }
.range-inputs { display: grid; gap: 4px; margin-top: 12px; }
.range-inputs label { display: grid; grid-template-columns: 24px minmax(0, 1fr); align-items: center; gap: 4px; font-size: 11px; text-align: left; }
.range-inputs input { width: 100%; min-width: 0; padding: 3px 5px; font-size: 12px; text-align: right; }
.range-inputs input[aria-invalid="true"] { border-color: var(--fail); }
.range-inputs small { font-weight: normal; text-align: left; }
.empty { padding: 16px 0; color: var(--muted); }
[hidden] { display: none !important; }
@media (max-width: 1100px) { .evidence-overview { grid-template-columns: minmax(0, 1fr); gap: 0; } }
@media (max-width: 800px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  #tree { max-height: 260px; position: static; border-right: 0; border-bottom: 1px solid var(--line); }
  header, #detail, .toolbar, #profiles, #summary-view, .context-bar { padding: 12px 16px; }
  .context-bar { align-items: start; }
  .toolbar label, .toolbar input, .toolbar select { min-width: 0; max-width: 100%; }
  .toolbar label:first-child { flex: 1 0 100%; }
  .metrics { gap: 16px; }
  .profile-table { width: calc(var(--columns) * 150px + 30px); }
  .profile-table th:first-child, .profile-table td:first-child { width: 180px; }
}
`;
