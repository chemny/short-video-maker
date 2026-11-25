import fs from 'node:fs';
import path from 'node:path';

const extensions = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'];
const importPattern = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g;

const resolveFile = (base) => {
  for (const extension of extensions) {
    const candidate = base + extension;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  for (const extension of extensions.slice(1)) {
    const candidate = path.join(base, `index${extension}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

// Source files an authored composition can actually load: the entry plus every local file it imports,
// transitively. Packages (bare specifiers) are covered by the lockfile and are not walked. Returns null
// when any local import cannot be resolved, so callers fall back to hashing the whole tree instead of
// silently missing a dependency.
export const reachableSources = (entry) => {
  const seen = new Set();
  const queue = [path.resolve(entry)];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.(tsx?|jsx?|mjs)$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(importPattern)) {
      const specifier = match[2];
      if (!specifier.startsWith('.') && !path.isAbsolute(specifier)) continue;
      const resolved = resolveFile(path.resolve(path.dirname(file), specifier));
      if (!resolved) return null;
      queue.push(resolved);
    }
  }
  return [...seen].sort();
};
