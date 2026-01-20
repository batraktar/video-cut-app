import { clamp, normalizeCropPx } from '../editorUtils';

const resolveDuration = duration =>
  Number.isFinite(duration) && duration > 0 ? duration : null;

const clampTime = (value, duration) => {
  const safeDuration = resolveDuration(duration);
  const num = Number.isFinite(value) ? value : 0;
  return safeDuration ? clamp(num, 0, safeDuration) : Math.max(0, num);
};

export const buildFilterGraph = ({ meta, crop, elements, segments }) => {
  if (!meta?.width || !meta?.height) return { error: 'missingMeta' };
  if (!Array.isArray(segments) || segments.length === 0) return { error: 'missingSegments' };

  const duration = meta.duration;
  const filters = [];

  (elements || []).forEach(el => {
    const elStart = clampTime(el?.startTime, duration);
    const elEnd = clampTime(el?.endTime, duration);
    if (elEnd <= elStart) return;

    const elRealX = ((el?.x ?? 0) / 100) * meta.width;
    const elRealY = ((el?.y ?? 0) / 100) * meta.height;
    const elRealW = ((el?.w ?? 0) / 100) * meta.width;
    const elRealH = ((el?.h ?? 0) / 100) * meta.height;

    const rawX = Math.round(elRealX);
    const rawY = Math.round(elRealY);
    const rawW = Math.round(elRealW);
    const rawH = Math.round(elRealH);

    const maxW = meta.width;
    const maxH = meta.height;
    const x = clamp(rawX, 0, Math.max(0, maxW - 1));
    const y = clamp(rawY, 0, Math.max(0, maxH - 1));
    const w = clamp(rawW, 1, Math.max(1, maxW - x));
    const h = clamp(rawH, 1, Math.max(1, maxH - y));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;

    const color =
      typeof el?.color === 'string' && el.color.startsWith('#')
        ? `0x${el.color.slice(1)}`
        : '0x000000';
    const thickness = el?.isOutline ? Math.max(1, Math.round(el?.thickness || 1)) : 'fill';

    filters.push(
      `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}@1:t=${thickness}:enable='between(t,${elStart.toFixed(
        3
      )},${elEnd.toFixed(3)})'`
    );
  });

  const hasCrop = !!(crop?.t || crop?.b || crop?.l || crop?.r);
  if (hasCrop) {
    const cropPx = normalizeCropPx(crop, meta);
    if (!cropPx?.w || !cropPx?.h) return { error: 'invalidCrop' };
    filters.push(`crop=${cropPx.w}:${cropPx.h}:${cropPx.x}:${cropPx.y}`);
  }

  const filterLines = [];
  if (filters.length > 0) filterLines.push(`[0:v]${filters.join(',')}[vbase]`);
  else filterLines.push('[0:v]null[vbase]');

  const splitLabels =
    segments.length > 1 ? segments.map((_, index) => `vs${index}`) : ['vbase'];
  if (segments.length > 1) {
    filterLines.push(
      `[vbase]split=${segments.length}${splitLabels.map(label => `[${label}]`).join('')}`
    );
  }

  const segmentLabels = segments.map((seg, index) => {
    const label = `v${index}`;
    const source = splitLabels[index] || 'vbase';
    filterLines.push(
      `[${source}]trim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(
        3
      )},setpts=PTS-STARTPTS[${label}]`
    );
    return label;
  });

  let outputLabel = segmentLabels[0];
  if (segmentLabels.length > 1) {
    outputLabel = 'vout';
    filterLines.push(
      `${segmentLabels.map(label => `[${label}]`).join('')}concat=n=${segmentLabels.length}:v=1:a=0[${outputLabel}]`
    );
  }

  return { graph: filterLines.join(';'), outputLabel };
};

