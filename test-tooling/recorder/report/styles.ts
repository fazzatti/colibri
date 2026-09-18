/** Self-contained report stylesheet; no downloaded fonts or assets. */
export const styles: string = `
:root {
  color-scheme: light dark;
  --bg: #f6f7f8;
  --panel: #fff;
  --ink: #17202a;
  --muted: #56616c;
  --line: #d8dde2;
  --accent: #086e77;
  --pass: #207342;
  --fail: #b42318;
  --warn: #946000;
  font: 14px/1.5 system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #15191d;
    --panel: #1d2329;
    --ink: #edf0f2;
    --muted: #aab4bf;
    --line: #3d4854;
    --accent: #73cbd1;
    --pass: #8ed8a8;
    --fail: #ff9a8e;
    --warn: #f0c770;
  }
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
}
header {
  padding: 24px 28px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
h1 {
  font-size: 21px;
  margin: 0 0 4px;
}
h2 {
  font-size: 18px;
}
h3 {
  font-size: 15px;
}
p {
  margin: 8px 0;
  color: var(--muted);
}
button, input, select {
  font: inherit;
  color: inherit;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 7px 10px;
}
button {
  cursor: pointer;
}
button:hover, button[aria-pressed="true"] {
  border-color: var(--accent);
  color: var(--accent);
}
button:focus-visible,
input:focus-visible,
select:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
nav {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 28px;
  align-items: end;
}
label {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}
input {
  min-width: 260px;
}
#summary {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-top: 16px;
}
#summary span {
  font-variant-numeric: tabular-nums;
}
#warnings {
  padding: 0 28px;
  color: var(--warn);
}
.layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  border-top: 1px solid var(--line);
  min-height: 65vh;
}
#tree {
  padding: 16px;
  border-right: 1px solid var(--line);
  overflow: auto;
  max-height: 78vh;
  position: sticky;
  top: 0;
}
#detail {
  padding: 20px 28px;
  min-width: 0;
}
summary {
  cursor: pointer;
  overflow-wrap: anywhere;
  margin: 4px 0;
}
.record {
  display: block;
  width: 100%;
  text-align: left;
  margin: 6px 0;
  padding: 8px 10px;
}
.record small {
  display: block;
  color: var(--muted);
}
.passed {
  color: var(--pass);
}
.failed {
  color: var(--fail);
}
.unknown, .running {
  color: var(--warn);
}
.muted {
  color: var(--muted);
}
.mono, pre {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
.mono {
  overflow-wrap: anywhere;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--bg);
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: 12px;
  max-height: 520px;
  overflow: auto;
}
dl {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 8px;
}
dt {
  color: var(--muted);
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.hash {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}
.table-scroll {
  overflow: auto;
  border: 1px solid var(--line);
  background: var(--panel);
}
table {
  border-collapse: collapse;
  width: 100%;
  font-variant-numeric: tabular-nums;
}
th, td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
  white-space: normal;
}
th {
  font-size: 12px;
  color: var(--muted);
  background: var(--bg);
}
th button {
  border: 0;
  padding: 0;
  background: none;
  text-align: left;
}
td.num {
  text-align: right;
}
.pager {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 12px 0;
}
#profiles {
  padding: 0 28px 28px;
}
#toast {
  min-height: 24px;
  color: var(--accent);
}
[hidden] {
  display: none !important;
}
.empty {
  padding: 32px;
  color: var(--muted);
}
@media (max-width: 800px) {
  .layout {
    grid-template-columns: 1fr;
  }
  #tree {
    max-height: 300px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  header, #detail, .toolbar, #profiles, #summary-view, .context-bar {
    padding: 16px;
  }
  dl {
    grid-template-columns: 110px 1fr;
  }
}
h1, h2, h3 { overflow-wrap: anywhere; }
.title-row { display: flex; align-items: baseline; gap: 20px; flex-wrap: wrap; }
.title-row p { font-size: 12px; }
.context-bar { padding: 12px 28px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 12px; align-items: center; }
#breadcrumbs { margin: 0; flex-wrap: wrap; align-items: baseline; gap: 8px; }
#breadcrumbs button, .text-button { padding: 0; border: 0; background: transparent; color: var(--accent); text-align: left; overflow-wrap: anywhere; }
#breadcrumbs strong { overflow-wrap: anywhere; }
#summary-view { padding: 8px 28px 28px; }
.metrics { display: flex; flex-wrap: wrap; gap: 28px; padding: 16px 0; border-block: 1px solid var(--line); }
.metrics div { display: grid; gap: 3px; }
.metrics strong { font-size: 24px; font-weight: 600; font-variant-numeric: tabular-nums; }
.metrics span { color: var(--muted); font-size: 12px; }
.context-label { display: block; color: var(--muted); font-size: 12px; margin-top: 5px; overflow-wrap: anywhere; }
.file-name { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 200px; }
.disclosure { padding: 0 6px; border: 0; background: transparent; }
#tree h2 { font-size: 13px; text-transform: uppercase; color: var(--muted); letter-spacing: .03em; }
#tree details { margin: 8px 0; padding-left: 10px; }
#tree > details { padding-left: 0; }
.file-link { display: block; width: 100%; text-align: left; border: 0; background: transparent; overflow-wrap: anywhere; font-size: 12px; margin: 4px 0; }
.file-link[aria-current] { background: var(--bg); color: var(--accent); border-left: 2px solid var(--accent); }
.badge { display: inline-block; font-size: 12px; font-weight: 600; }
.data-section { padding: 10px 0; border-bottom: 1px solid var(--line); }
.data-section > summary { font-weight: 500; }
.filter-fields { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px 0; }
#advanced-filters[open] { flex-basis: 100%; }
#advanced-filters > summary { padding: 6px 10px; border: 1px solid var(--line); border-radius: 4px; }
.profile-controls, .suite-links { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; margin: 16px 0; }
.checkbox { display: flex; align-items: center; }
.checkbox input { min-width: auto; }
#filter-notice { font-size: 12px; color: var(--muted); }
.hash { flex-wrap: wrap; }
.hash code { overflow-wrap: anywhere; min-width: 0; }
#toast:not(:empty) { padding: 10px 28px; }
#toast:empty { min-height: 0; }
#profile-content td:first-child { min-width: 230px; max-width: 560px; }
#profile-content td { overflow-wrap: anywhere; }
.num { white-space: nowrap; }
button:disabled { opacity: .5; cursor: default; }
@media (max-width: 800px) {
  #tree { position: static; }
  .context-bar, #summary-view { padding: 12px 16px; }
  .metrics { gap: 16px; }
  .toolbar label, .toolbar input, .toolbar select { min-width: 0; max-width: 100%; }
  .toolbar label:first-child { flex: 1 0 100%; }
  .context-bar { align-items: start; }
  dl { grid-template-columns: minmax(90px, 1fr) minmax(0, 2fr); }
}
`;
