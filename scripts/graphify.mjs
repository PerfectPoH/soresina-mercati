import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const shouldNormalizeRoot = args[0] === 'update' || args.includes('--update');

const quotePwsh = (value) => `'${String(value).replace(/'/g, "''")}'`;

const candidates = [
  { label: 'graphify', command: 'graphify', args },
  { label: 'py -m graphify', command: 'py', args: ['-m', 'graphify', ...args] },
  { label: 'python -m graphify', command: 'python', args: ['-m', 'graphify', ...args] },
  { label: 'python3 -m graphify', command: 'python3', args: ['-m', 'graphify', ...args] },
];

if (process.platform !== 'win32') {
  candidates.push({
    label: 'powershell.exe py -m graphify',
    command: 'powershell.exe',
    args: [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `py -m graphify ${args.map(quotePwsh).join(' ')}`,
    ],
  });
}

const normalizeGraphifyRoot = () => {
  const outDir = resolve(process.cwd(), 'graphify-out');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, '.graphify_root'), `${process.cwd().replaceAll('\\', '/')}\n`);
};

const isCommandMissing = (result) =>
  result.error?.code === 'ENOENT' || result.status === 127;

const isPythonModuleMissing = (result) =>
  /No module named graphify|ModuleNotFoundError: No module named ['"]graphify['"]/.test(
    `${result.stderr || ''}${result.stdout || ''}`,
  );

const summarizeFailure = (candidate, result) => {
  if (result.error) return `${candidate.label}: ${result.error.message}`;

  const output = `${result.stderr || result.stdout || ''}`
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-2)
    .join(' | ');

  return `${candidate.label}: exit ${result.status ?? 'unknown'}${output ? ` - ${output}` : ''}`;
};

const failures = [];

for (const candidate of candidates) {
  const result = spawnSync(candidate.command, candidate.args, {
    encoding: 'utf8',
    shell: false,
  });

  if (!result.error && result.status === 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (shouldNormalizeRoot) normalizeGraphifyRoot();
    process.exit(0);
  }

  failures.push(summarizeFailure(candidate, result));

  if (isCommandMissing(result) || isPythonModuleMissing(result)) {
    continue;
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

console.error('Unable to run Graphify.');
console.error('Tried:');
for (const failure of failures) {
  console.error(`- ${failure}`);
}
console.error('Install graphifyy or ensure its CLI is on PATH: py -m pip install --user graphifyy');
process.exit(1);
