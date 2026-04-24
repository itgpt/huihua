import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const templatePath = resolve(projectRoot, 'pages/index.template.html');
const indexPath = resolve(projectRoot, 'index.html');
const includePattern = /^[ \t]*<!--\s*include:\s*([^>]+?)\s*-->[ \t]*(?:\r?\n)?/gm;

function renderFile(filePath, stack = []) {
  if (stack.includes(filePath)) {
    const chain = [...stack, filePath]
      .map((item) => item.replace(`${projectRoot}/`, ''))
      .join(' -> ');
    throw new Error(`Circular include detected: ${chain}`);
  }

  const source = readFileSync(filePath, 'utf8');

  return source.replace(includePattern, (_match, includeTarget) => {
    const normalizedTarget = includeTarget.trim();
    const childPath = resolve(projectRoot, normalizedTarget);

    if (childPath !== projectRoot && !childPath.startsWith(`${projectRoot}${sep}`)) {
      throw new Error(`Include is outside project root: ${normalizedTarget}`);
    }

    return renderFile(childPath, [...stack, filePath]);
  });
}

const output = renderFile(templatePath);

if (process.argv.includes('--stdout')) {
  process.stdout.write(output);
} else {
  writeFileSync(indexPath, output);
}
