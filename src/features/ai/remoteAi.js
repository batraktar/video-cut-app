import { SEGMENT_MODES } from '../../lib/editorConstants';
import { resolveSegmentModeFromSuffix } from '../../lib/editorUtils';

const AI_MODE_IDS = new Set(SEGMENT_MODES.map(mode => mode.id));

const resolveMode = label => {
  const value = String(label || '').trim().toLowerCase();
  if (AI_MODE_IDS.has(value)) return value;
  return resolveSegmentModeFromSuffix(value);
};

const normalizeSegment = segment => {
  if (!segment || typeof segment !== 'object') return segment;
  const start = segment.start ?? segment.start_time ?? segment.start_sec ?? segment.from;
  const end = segment.end ?? segment.end_time ?? segment.end_sec ?? segment.to;
  return {
    ...segment,
    ...(start !== undefined ? { start: Number(start) } : null),
    ...(end !== undefined ? { end: Number(end) } : null)
  };
};

const addSegments = (output, label, segments) => {
  const mode = resolveMode(label);
  if (!mode || !Array.isArray(segments)) return;
  if (!output[mode]) output[mode] = [];
  output[mode].push(...segments.map(normalizeSegment));
};

const getRemoteSegmentPayload = response => {
  const result = response?.result;
  const candidates = [
    response?.segments,
    result?.segments,
    result?.predictions,
    result?.output,
    result?.data,
    response?.predictions,
    response?.output,
    result
  ];
  return (
    candidates.find(
      value =>
        (Array.isArray(value) && value.length > 0) ||
        (value && typeof value === 'object' && Object.keys(value).length > 0)
    ) ||
    candidates.find(value => Array.isArray(value) || (value && typeof value === 'object')) ||
    {}
  );
};

export const normalizeRemoteAiSegments = response => {
  const raw = getRemoteSegmentPayload(response);
  const output = {};

  if (Array.isArray(raw)) {
    raw.forEach(segment => {
      const label =
        segment?.mode ||
        segment?.label ||
        segment?.class_name ||
        segment?.class ||
        segment?.category ||
        segment?.channel ||
        segment?.type;
      addSegments(
        output,
        label,
        Array.isArray(segment?.segments) ? segment.segments : segment ? [segment] : []
      );
    });
    return output;
  }

  if (!raw || typeof raw !== 'object') return output;
  Object.entries(raw).forEach(([label, value]) => {
    const segments = Array.isArray(value)
      ? value
      : Array.isArray(value?.segments)
        ? value.segments
        : Array.isArray(value?.intervals)
          ? value.intervals
        : [];
    addSegments(output, label, segments);
  });
  return output;
};

const describeKeys = value => {
  if (!value || typeof value !== 'object') return String(value ?? 'відсутнє');
  const keys = Object.keys(value);
  return keys.length > 0 ? keys.join(', ') : 'порожньо';
};

export const describeRemoteAiResponse = response => {
  const parsed = normalizeRemoteAiSegments(response);
  const parsedModes = Object.keys(parsed);
  const details = [
    `root: ${describeKeys(response)}`,
    `result: ${describeKeys(response?.result)}`,
    `розпізнані канали: ${parsedModes.length > 0 ? parsedModes.join(', ') : 'немає'}`
  ];
  if (Number.isFinite(response?.frame_count)) {
    details.push(`кадрів: ${response.frame_count}`);
  }
  if (response?.label_counts && typeof response.label_counts === 'object') {
    const labels = Object.entries(response.label_counts)
      .map(([label, count]) => `${label}=${count}`)
      .join(', ');
    if (labels) details.push(`класи моделі: ${labels}`);
  }
  if (Number.isFinite(response?.average_confidence)) {
    details.push(`confidence: ${Math.round(response.average_confidence * 100)}%`);
  }
  if (Number.isFinite(response?.dropped_runs)) {
    details.push(`відкинуто коротких серій: ${response.dropped_runs}`);
  }
  return details.join('; ');
};

export const countAiSegments = segments =>
  Object.values(segments || {}).reduce(
    (total, list) => total + (Array.isArray(list) ? list.length : 0),
    0
  );

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }
    let timer;
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export const pollRemoteAiTask = async ({
  baseUrl,
  taskId,
  headers,
  signal,
  fetchImpl = fetch,
  intervalMs = 1000,
  timeoutMs = 30 * 60 * 1000
}) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) throw new Error('aborted');
    const res = await fetchImpl(`${baseUrl}/result/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers,
      signal
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    const status = String(data.status || '').toLowerCase();
    if (status === 'done' || status === 'completed') return data;
    if (status === 'error' || status === 'failed') {
      throw new Error(data.error || 'remote_failed');
    }
    await wait(intervalMs, signal);
  }
  throw new Error('remote_timeout');
};
