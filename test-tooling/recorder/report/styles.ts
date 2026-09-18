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
  font-size: 22px;
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
  grid-template-columns: 320px minmax(0, 1fr);
  border-top: 1px solid var(--line);
  min-height: 65vh;
}
aside {
  padding: 16px;
  border-right: 1px solid var(--line);
  overflow: auto;
  max-height: 78vh;
}
main {
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
  white-space: nowrap;
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
  aside {
    max-height: 300px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  header, main, .toolbar, #profiles {
    padding: 16px;
  }
  dl {
    grid-template-columns: 110px 1fr;
  }
}
`;
