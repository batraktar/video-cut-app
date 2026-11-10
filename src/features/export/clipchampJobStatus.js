const parseBytes = (amount, unit) => {
  const scales = {
    B: 1,
    kB: 1_000,
    MB: 1_000_000,
    GB: 1_000_000_000,
    KiB: 1_024,
    MiB: 1_048_576,
    GiB: 1_073_741_824
  };
  const scale = scales[unit];
  return scale ? Number(amount) * scale : null;
};

const latestMatch = (text, pattern) => {
  const matches = [...String(text || '').matchAll(pattern)];
  return matches.at(-1) || null;
};

const parseEta = value => {
  const parts = [...String(value || '').matchAll(/(\d+)(w|d|h|m|s)/g)];
  if (parts.length === 0) return '';
  const labels = { w: 'тиж.', d: 'дн.', h: 'год', m: 'хв', s: 'с' };
  return parts.map(([, amount, unit]) => `${amount} ${labels[unit]}`).join(' ');
};

const humanizeSpeed = value => String(value || '').replace(/\bB\/s\b/g, 'Б/с').replace(/\bKiB\/s\b/g, 'КіБ/с').replace(/\bMiB\/s\b/g, 'МіБ/с').replace(/\bGiB\/s\b/g, 'ГіБ/с');

const parseFiles = command => String(command || '')
  .split('\n')
  .map(line => line.match(/^#\s+(.+?)\s+→\s+(.+)$/)?.[2]?.trim())
  .filter(Boolean)
  .map(name => ({ name, status: 'waiting' }));

const parseFileEvents = log => {
  const events = new Map();
  const eventPattern = /CLIPCHAMP_(RENDER|UPLOAD)_(START|DONE|FAILED)\s+([^\r\n]+)/g;
  for (const match of String(log || '').matchAll(eventPattern)) {
    const [, stage, event, rawName] = match;
    const name = rawName.trim();
    const status = event === 'START' ? (stage === 'UPLOAD' ? 'uploading' : 'rendering')
      : event === 'DONE' ? (stage === 'UPLOAD' ? 'uploaded' : 'rendered')
        : 'error';
    const previous = events.get(name) || { name, rendered: false, uploaded: false };
    events.set(name, {
      ...previous,
      stage: stage.toLowerCase(),
      status,
      rendered: previous.rendered || (stage === 'RENDER' && event === 'DONE'),
      uploaded: previous.uploaded || (stage === 'UPLOAD' && event === 'DONE')
    });
  }
  return events;
};

export const getClipchampJobStatus = job => {
  if (!String(job?.command || '').includes('# CLIPCHAMP_EXPORT ')) return null;

  const command = String(job.command || '');
  const log = String(job.log || '');
  const uploadsToDrive = command.includes('rclone copyto') || command.includes('rclone copy ');
  const files = parseFiles(command);
  const events = parseFileEvents(log);
  const isUpload = /CLIPCHAMP_UPLOAD_(?:START|DONE|FAILED)/.test(log) || /Transferred:\s+\d+\s*\/\s*\d+,\s*\d+%/.test(log);
  const isDone = job.status === 'done' || log.includes('CLIPCHAMP_EXPORT_DONE');
  const isError = job.status === 'error' || log.includes('CLIPCHAMP_EXPORT_FAILED');
  const isCancelled = job.status === 'canceled' || job.status === 'cancelled';
  const uploadCountMatch = latestMatch(log, /Transferred:\s+(\d+)\s*\/\s*(\d+),\s*(\d+)%/g);
  const byteMatch = latestMatch(
    log,
    /Transferred:\s*([\d.]+)\s+(B|kB|MB|GB|KiB|MiB|GiB)\s*\/\s*([\d.]+)\s+(B|kB|MB|GB|KiB|MiB|GiB),\s*(\d+)%?,\s*([^,]+),\s*ETA\s+([^\s]+)/gi
  );
  const currentMatch = latestMatch(
    log,
    /^\s*\*\s+(.+?):\s+(\d+)%\s*\/\s*([\d.]+)\s+(B|kB|MB|GB|KiB|MiB|GiB),\s*([^,\r\n]+)/gim
  );

  const uploadDone = new Set(
    [...events.values()].filter(event => event.uploaded).map(event => event.name)
  );
  const uploadFailed = new Set(
    [...events.values()].filter(event => event.status === 'error').map(event => event.name)
  );
  const renderDone = new Set(
    [...events.values()].filter(event => event.rendered).map(event => event.name)
  );
  const currentFile = currentMatch?.[1]?.trim() || [...events.values()].reverse().find(event => event.status === 'uploading' || event.status === 'rendering')?.name || '';

  let stage = 'waiting';
  if (isDone) stage = 'done';
  else if (isError) stage = 'error';
  else if (isCancelled) stage = 'cancelled';
  else if (isUpload) stage = 'uploading';
  else if (/CLIPCHAMP_RENDER_(?:START|DONE|FAILED)/.test(log) || /time=[\d:.]+/.test(log)) stage = 'rendering';
  else if (job.status === 'running') stage = 'starting';

  const allFiles = files.map(file => {
    const event = events.get(file.name);
    let status = event?.status || 'waiting';
    if (isDone) status = uploadsToDrive ? 'uploaded' : 'saved';
    else if (isCancelled && (status === 'uploading' || status === 'rendering')) status = 'cancelled';
    else if (uploadFailed.has(file.name)) status = 'error';
    else if (uploadDone.has(file.name)) status = 'uploaded';
    else if (!isCancelled && currentFile && file.name === currentFile) {
      status = stage === 'uploading' ? 'uploading' : stage === 'rendering' ? 'rendering' : status;
    } else if (renderDone.has(file.name)) status = 'rendered';
    if ((stage === 'error' || stage === 'cancelled') && status === 'waiting') status = 'not_started';
    return { ...file, status };
  });

  const hasPerFileEvents = events.size > 0;
  const uploadedCount = hasPerFileEvents
    ? uploadDone.size
    : uploadCountMatch
      ? Number(uploadCountMatch[1])
    : isDone && uploadsToDrive ? files.length : 0;
  const totalCount = hasPerFileEvents || files.length > 0
    ? files.length
    : uploadCountMatch ? Number(uploadCountMatch[2]) : 0;
  const transferredBytes = byteMatch ? parseBytes(byteMatch[1], byteMatch[2]) : null;
  const totalBytes = byteMatch ? parseBytes(byteMatch[3], byteMatch[4]) : null;
  const currentFilePercent = currentMatch ? Number(currentMatch[2]) : byteMatch ? Number(byteMatch[5]) : null;
  const percent = hasPerFileEvents && stage === 'uploading' && totalCount > 0
    ? Math.min(100, ((uploadedCount + (uploadDone.has(currentFile) ? 0 : Math.min(99, Math.max(0, currentFilePercent || 0)) / 100)) / totalCount) * 100)
    : hasPerFileEvents && stage === 'rendering' && totalCount > 0
      ? Math.min(100, (renderDone.size / totalCount) * 100)
      : byteMatch
        ? Number(byteMatch[5])
        : uploadCountMatch
      ? Number(uploadCountMatch[3])
      : totalCount > 0 && (stage === 'done' || renderDone.size > 0)
        ? Math.round((stage === 'done' ? totalCount : renderDone.size) / totalCount * 100)
        : null;
  const speed = byteMatch ? humanizeSpeed(byteMatch[6].trim()) : '';
  const eta = byteMatch ? parseEta(byteMatch[7]) : '';

  const stageText = {
    waiting: 'Завдання очікує запуску.',
    starting: 'Запускаю пакет і готую відео до обробки.',
    rendering: currentFile
      ? `Обробляю відео «${currentFile}» на цьому комп’ютері.`
      : 'Обробляю відео на цьому комп’ютері.',
    uploading: currentFile
      ? `Передаю готові відео в Google Drive. Зараз файл «${currentFile}».`
      : 'Передаю готові відео в Google Drive.',
    done: command.includes('rclone copy')
      ? 'Експорт завершено. Відео передані в Google Drive.'
      : 'Експорт завершено. Відео збережені на цьому комп’ютері.',
    error: 'Експорт не завершився. Відкрий технічний журнал нижче, щоб побачити причину.',
    cancelled: 'Експорт зупинено. Уже створені файли залишилися на комп’ютері; перевір нижче, що встигло потрапити в Drive.'
  }[stage];

  let transferNote = '';
  if (stage === 'uploading' && speed) {
    const speedValue = Number(speed.match(/[\d.]+/)?.[0] || 0);
    if (speedValue > 0 && /Б\/с/.test(speed) && speedValue < 1_000) {
      transferNote = `Швидкість дуже низька — ${speed}. Оцінка часу може різко змінюватися`;
      if (eta) transferNote += `; за поточною швидкістю орієнтовно ${eta}`;
      transferNote += '.';
    } else if (eta) {
      transferNote = `Орієнтовно залишилося ${eta} за поточною швидкістю (${speed}).`;
    } else {
      transferNote = `Поточна швидкість передавання: ${speed}.`;
    }
  }

  return {
    stage,
    stageText,
    workflowText: uploadsToDrive
      ? `Одне завдання обробляє ${files.length || 'пакет'} файлів по черзі, а тоді завантажує кожен готовий файл у Drive.`
      : `Одне завдання обробляє ${files.length || 'пакет'} файлів по черзі й зберігає результат на цьому комп’ютері.`,
    transferNote,
    files: allFiles,
    hasPerFileEvents,
    currentFile,
    currentFilePercent,
    uploadedCount: Math.min(uploadedCount, totalCount || uploadedCount),
    processedCount: isDone ? files.length : renderDone.size,
    uploadsToDrive,
    totalCount,
    transferredBytes,
    totalBytes,
    percent,
    speed,
    eta,
    driveUrl: (log.match(/https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+/) || command.match(/https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+/))?.[0] || '',
    canShowFileList: isDone || hasPerFileEvents,
    isUpload
  };
};

export const formatExportBytes = value => {
  if (!Number.isFinite(value) || value < 0) return '';
  const units = ['Б', 'КіБ', 'МіБ', 'ГіБ'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

export const getExportFileStatusLabel = status => ({
  waiting: 'Чекає обробки',
  rendering: 'Обробляється тут',
  rendered: 'Відео готове, чекає завантаження',
  uploading: 'Завантажується в Drive',
  uploaded: 'Завантажено в Drive',
  saved: 'Збережено на комп’ютері',
  not_started: 'Не почато',
  cancelled: 'Зупинено під час обробки',
  error: 'Помилка'
}[status] || 'Чекає');

export const getJobStatusLabel = status => ({
  queued: 'У черзі',
  running: 'Виконується',
  done: 'Готово',
  error: 'Помилка',
  canceled: 'Зупинено'
}[status] || 'Стан невідомий');
