import fs from 'fs';
import path from 'path';

const quote = value => `'${String(value).replace(/'/g, `'"'"'`)}'`;
const completed = (log, stage) => new Set(
  [...String(log || '').matchAll(new RegExp(`^CLIPCHAMP_${stage}_DONE (.+)$`, 'gm'))]
    .map(match => match[1].trim())
);

export const buildClipchampRetryCommand = (command, log, cwd) => {
  if (!String(command).startsWith('# CLIPCHAMP_EXPORT ')) return null;
  const lines = command.split('\n');
  const dir = lines.find(line => line.startsWith('mkdir -p '))?.match(/^mkdir -p '([^']+)'$/)?.[1];
  const rendered = completed(log, 'RENDER');
  const uploaded = completed(log, 'UPLOAD');
  const output = [];
  const names = [];
  let uploadIndex = 0;
  const pendingNames = new Set();

  for (let index = 0; index < lines.length;) {
    const render = lines[index].match(/^# .+ → (.+)$/);
    if (render && lines[index + 1]?.includes('CLIPCHAMP_RENDER_START')) {
      const name = render[1];
      names.push(name);
      let end = index + 1;
      while (end < lines.length && !/^# .+ → |^printf %s /.test(lines[end])) end += 1;
      const localExists = dir && fs.existsSync(path.resolve(cwd, dir, name));
      if (uploaded.has(name) || (rendered.has(name) && localExists)) {
        output.push(`printf 'CLIPCHAMP_RENDER_DONE %s\\n' ${quote(name)}`);
      } else {
        output.push(...lines.slice(index, end));
        pendingNames.add(name);
      }
      index = end;
      continue;
    }
    if (lines[index].includes('CLIPCHAMP_UPLOAD_START')) {
      const name = names[uploadIndex++];
      let end = index + 1;
      while (end < lines.length && lines[end] !== 'fi') end += 1;
      if (end >= lines.length || !name) return null;
      end += 1;
      if (uploaded.has(name)) output.push(`printf 'CLIPCHAMP_UPLOAD_DONE %s\\n' ${quote(name)}`);
      else {
        output.push(...lines.slice(index, end));
        pendingNames.add(name);
      }
      index = end;
      continue;
    }
    output.push(lines[index]);
    index += 1;
  }
  if (!names.length || !pendingNames.size) return null;
  return { command: output.join('\n'), remaining: pendingNames.size };
};
