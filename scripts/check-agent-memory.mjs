import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const checks = [];

const add = (ok, label, detail = '') => {
  checks.push({ ok, label, detail });
};

const hasText = (path, ...needles) => {
  if (!existsSync(path)) return false;
  const text = readFileSync(path, 'utf8');
  return needles.every((needle) => text.includes(needle));
};

const graphPath = resolve(root, 'graphify-out/graph.json');
const reportPath = resolve(root, 'graphify-out/GRAPH_REPORT.md');

add(existsSync(graphPath), 'graphify-out/graph.json exists');
add(existsSync(reportPath), 'graphify-out/GRAPH_REPORT.md exists');

if (existsSync(graphPath)) {
  const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
  const edgeCount = Array.isArray(graph.links)
    ? graph.links.length
    : Array.isArray(graph.edges)
      ? graph.edges.length
      : 0;
  add(Array.isArray(graph.nodes) && graph.nodes.length > 0, `graph has nodes (${graph.nodes?.length ?? 0})`);
  add(edgeCount > 0, `graph has edges (${edgeCount})`);
}

if (existsSync(reportPath)) {
  const report = readFileSync(reportPath, 'utf8');
  add(report.includes('God Nodes'), 'graph report includes God Nodes');
  add(report.includes('Communities'), 'graph report includes Communities');
}

const graphifyHelp = spawnSync(process.execPath, ['scripts/graphify.mjs', '--help'], {
  cwd: root,
  encoding: 'utf8',
});
add(graphifyHelp.status === 0, 'Graphify wrapper runs', graphifyHelp.stderr?.trim());

add(hasText(resolve(root, 'CLAUDE.md'), 'vault/INDEX.md', 'graphify-out/GRAPH_REPORT.md'), 'CLAUDE.md bootstraps vault + graph');
add(hasText(resolve(root, 'AGENTS.md'), 'vault/INDEX.md', 'graphify-out/GRAPH_REPORT.md'), 'AGENTS.md bootstraps vault + graph');
add(hasText(resolve(root, '.cursor/rules/graphify.mdc'), 'alwaysApply: true', 'vault/INDEX.md'), 'Cursor rule is always-on');
add(hasText(resolve(root, '.graphifyignore'), 'node_modules/', 'CREDENZIALI.md'), '.graphifyignore protects heavy/private files');

const graphRootPath = resolve(root, 'graphify-out/.graphify_root');
if (existsSync(graphRootPath)) {
  const graphRoot = readFileSync(graphRootPath, 'utf8').trim().replaceAll('\\', '/').toLowerCase();
  const currentRoot = root.replaceAll('\\', '/').toLowerCase();
  add(graphRoot === currentRoot, 'graphify root points to current workspace', graphRoot);
}

const vaultGenerated = [
  'vault/graph.json',
  'vault/graph.html',
  'vault/GRAPH_REPORT.md',
  'vault/cache',
].filter((path) => existsSync(resolve(root, path)));

add(vaultGenerated.length === 0, 'vault root has no generated Graphify artifacts', vaultGenerated.join(', '));

for (const check of checks) {
  const marker = check.ok ? 'OK' : 'FAIL';
  console.log(`${marker} ${check.label}${check.detail ? ` - ${check.detail}` : ''}`);
}

const failed = checks.filter((check) => !check.ok);

if (failed.length > 0) {
  process.exit(1);
}

const graphStat = statSync(graphPath);
console.log(`Graph snapshot: ${Math.round(graphStat.size / 1024)} KB at ${graphPath}`);
