const getCell = (row, index) => {
  if (index < 0 || !Array.isArray(row)) return '';
  return String(row[index] ?? '').trim();
};

export const normalizeSheetHeader = value =>
  String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();

export const normalizeTelegramLink = value => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = url.pathname.replace(/\/+$/, '');
    return `${host}${pathname}`.toLowerCase();
  } catch {
    return raw
      .split(/[?#]/, 1)[0]
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }
};

export const buildSheetRows = rows => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const headers = rows[0].map(normalizeSheetHeader);
  const idxLink = headers.indexOf('link');
  const idxFile = headers.indexOf('tg_file_name');
  const idxMode = headers.indexOf('analog_digital');
  const idxStatus = headers.indexOf('status');
  const idxCamera = headers.indexOf('camera_type');
  const idxLabels = headers.indexOf('labels');

  if (idxLink < 0 && idxFile < 0) {
    throw new Error('sheet_match_column_missing');
  }

  const output = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const link = getCell(row, idxLink);
    const fileName = getCell(row, idxFile);
    if (!link && !fileName) continue;
    output.push({
      rowIndex: i + 1,
      link,
      fileName,
      analogDigital: getCell(row, idxMode),
      status: getCell(row, idxStatus),
      cameraType: getCell(row, idxCamera),
      labels: getCell(row, idxLabels)
    });
  }
  return output;
};

export const buildLinkFilenameMap = rows => {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const link = normalizeTelegramLink(row?.link);
    const fileName = String(row?.filename ?? '').trim();
    if (link && fileName && !map.has(link)) map.set(link, fileName);
  }
  return map;
};

export const resolveSheetFilenames = (rows, linkFilenameMap) => {
  let resolvedFromLinksMap = 0;
  let unresolvedRows = 0;
  const resolvedRows = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    let fileName = String(row?.fileName ?? '').trim();
    if (!fileName) {
      const link = normalizeTelegramLink(row?.link);
      fileName = link ? linkFilenameMap?.get(link) || '' : '';
      if (fileName) resolvedFromLinksMap += 1;
    }
    if (!fileName) {
      unresolvedRows += 1;
      continue;
    }
    resolvedRows.push({ ...row, fileName });
  }

  return {
    rows: resolvedRows,
    totalRows: Array.isArray(rows) ? rows.length : 0,
    resolvedFromLinksMap,
    unresolvedRows
  };
};
