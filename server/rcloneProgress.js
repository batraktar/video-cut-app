const BYTE_UNITS = new Map([
  ['B', 1], ['kB', 1e3], ['MB', 1e6], ['GB', 1e9], ['TB', 1e12],
  ['KiB', 1024], ['MiB', 1024 ** 2], ['GiB', 1024 ** 3], ['TiB', 1024 ** 4]
]);

const parseSize = (value, unit) => {
  const multiplier = BYTE_UNITS.get(unit) ?? BYTE_UNITS.get(unit.toUpperCase()) ?? BYTE_UNITS.get(`${unit[0].toUpperCase()}${unit.slice(1)}`);
  return multiplier ? Math.round(Number(value) * multiplier) : null;
};

export const parseRcloneProgressLine = line => {
  const match = String(line || '').match(/([\d.]+)\s+(B|kB|MB|GB|TB|KiB|MiB|GiB|TiB)\s*\/\s*([\d.]+)\s+(B|kB|MB|GB|TB|KiB|MiB|GiB|TiB),\s*(\d+)%?,\s*([^,]+),\s*ETA\s+(.+)$/i);
  if (!match) return null;
  const transferred = parseSize(match[1], match[2]);
  const total = parseSize(match[3], match[4]);
  if (!Number.isFinite(transferred) || !Number.isFinite(total)) return null;
  return {
    bytesTransferred: transferred,
    totalBytes: total,
    percent: Math.max(0, Math.min(100, Number(match[5]))),
    speed: match[6].trim(),
    eta: match[7].trim()
  };
};
