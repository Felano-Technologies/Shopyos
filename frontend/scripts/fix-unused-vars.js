const fs = require('fs');
const path = require('path');

const reportPath = path.join(process.cwd(), 'lint-report.json');
if (!fs.existsSync(reportPath)) {
  console.error('lint-report.json not found');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitCommaList(text) {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function removeFromObjectDestructure(line, name) {
  const m = line.match(/^(\s*(?:const|let|var)\s*\{)([^}]*)(\}\s*=.*)$/);
  if (!m) return { changed: false, line };

  const parts = splitCommaList(m[2]);
  const next = parts.filter((p) => {
    if (p === name) return false;
    if (p.startsWith(name + ':')) return false;
    if (p.endsWith(': ' + name) || p.endsWith(':' + name)) return false;
    return true;
  });

  if (next.length === parts.length) return { changed: false, line };
  if (next.length === 0) return { changed: true, line: '' };

  return { changed: true, line: `${m[1]} ${next.join(', ')} ${m[3]}` };
}

function removeFromArrayDestructure(line, name) {
  const m = line.match(/^(\s*(?:const|let|var)\s*\[)([^\]]*)(\]\s*=.*)$/);
  if (!m) return { changed: false, line };

  const parts = m[2].split(',').map((s) => s.trim());
  let changed = false;
  const next = parts.map((p) => {
    if (p === name) {
      changed = true;
      return '';
    }
    return p;
  });

  if (!changed) return { changed: false, line };
  if (next.every((p) => p === '')) return { changed: true, line: '' };

  return { changed: true, line: `${m[1]}${next.join(', ')}${m[3]}` };
}

function removeFromImport(line, name) {
  const m = line.match(/^(\s*import\s*\{)([^}]*)(\}\s*from\s*['\"].*['\"];?\s*)$/);
  if (!m) return { changed: false, line };

  const parts = splitCommaList(m[2]);
  const next = parts.filter((p) => {
    if (p === name) return false;
    if (p.startsWith(name + ' as ')) return false;
    if (p.endsWith(' as ' + name)) return false;
    return true;
  });

  if (next.length === parts.length) return { changed: false, line };
  if (next.length === 0) return { changed: true, line: '' };

  return { changed: true, line: `${m[1]} ${next.join(', ')} ${m[3]}` };
}

function removeFunctionOrInterfaceBlock(lines, startLine) {
  let i = startLine;
  let depth = 0;
  let started = false;

  while (i < lines.length) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') {
        depth += 1;
        started = true;
      } else if (ch === '}') {
        depth -= 1;
      }
    }
    lines[i] = '';
    if (started && depth <= 0) {
      break;
    }
    i += 1;
  }

  return i;
}

let filesChanged = 0;
let edits = 0;

for (const fileReport of report) {
  const warnings = (fileReport.messages || []).filter(
    (m) => m.severity === 1 && m.ruleId === '@typescript-eslint/no-unused-vars'
  );
  if (!warnings.length) continue;

  const filePath = fileReport.filePath;
  if (!fs.existsSync(filePath)) continue;

  const original = fs.readFileSync(filePath, 'utf8');
  const lines = original.split(/\r?\n/);

  const sorted = [...warnings].sort((a, b) => b.line - a.line);

  for (const warning of sorted) {
    const nameMatch = (warning.message || '').match(/'([^']+)'/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const idx = warning.line - 1;
    if (idx < 0 || idx >= lines.length) continue;

    let line = lines[idx];
    if (!line) continue;

    const esc = escapeRegExp(name);

    if (new RegExp(`catch\\s*\\(\\s*[^)]*\\b${esc}\\b[^)]*\\)`).test(line)) {
      const next = line.replace(/catch\s*\([^)]*\)/, 'catch');
      if (next !== line) {
        lines[idx] = next;
        edits += 1;
      }
      continue;
    }

    const arrowParamRegex = new RegExp(`\\(\\s*${esc}(?:\\s*:[^)]+)?\\s*\\)\\s*=>`);
    if (arrowParamRegex.test(line)) {
      const next = line.replace(arrowParamRegex, '() =>');
      if (next !== line) {
        lines[idx] = next;
        edits += 1;
      }
      continue;
    }

    if (/^\s*import\s*\{/.test(line)) {
      const r = removeFromImport(line, name);
      if (r.changed) {
        lines[idx] = r.line;
        edits += 1;
      }
      continue;
    }

    if (/^\s*(const|let|var)\s*\{/.test(line)) {
      const r = removeFromObjectDestructure(line, name);
      if (r.changed) {
        lines[idx] = r.line;
        edits += 1;
      }
      continue;
    }

    if (/^\s*(const|let|var)\s*\[/.test(line)) {
      const r = removeFromArrayDestructure(line, name);
      if (r.changed) {
        lines[idx] = r.line;
        edits += 1;
      }
      continue;
    }

    if (new RegExp(`^\\s*(const|let|var)\\s+${esc}\\s*=`).test(line)) {
      lines[idx] = '';
      edits += 1;
      continue;
    }

    if (new RegExp(`^\\s*type\\s+${esc}\\b`).test(line)) {
      lines[idx] = '';
      edits += 1;
      continue;
    }

    if (new RegExp(`^\\s*interface\\s+${esc}\\b`).test(line)) {
      removeFunctionOrInterfaceBlock(lines, idx);
      edits += 1;
      continue;
    }

    if (new RegExp(`^\\s*(?:async\\s+)?function\\s+${esc}\\b`).test(line)) {
      removeFunctionOrInterfaceBlock(lines, idx);
      edits += 1;
      continue;
    }
  }

  const output = lines.filter((ln) => ln !== '').join('\n');
  if (output !== original) {
    fs.writeFileSync(filePath, output, 'utf8');
    filesChanged += 1;
  }
}

console.log(`files_changed=${filesChanged} edits=${edits}`);
