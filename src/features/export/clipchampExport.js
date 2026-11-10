const sanitizePart = value =>
  String(value || '')
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

export const extractDriveFolderId = value => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/\/folders\/([A-Za-z0-9_-]+)/);
  return match?.[1] || raw.replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '');
};

export const formatClipchampFolderName = (date = new Date(), prefix = 'Clipchamp') => {
  const pad = value => String(value).padStart(2, '0');
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-');
  const time = [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('-');
  return `${sanitizePart(prefix) || 'Clipchamp'}_${stamp}_${time}`;
};

const csvCell = value => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildLinksMapCsv = rows => {
  const lines = ['link,filename'];
  for (const row of Array.isArray(rows) ? rows : []) {
    lines.push(`${csvCell(row?.link)},${csvCell(row?.filename)}`);
  }
  return `${lines.join('\n')}\n`;
};

export const buildVideosMarkdown = (rows, folderName) => {
  const lines = [`# ${folderName}`, ''];
  for (const row of Array.isArray(rows) ? rows : []) {
    const filename = String(row?.filename || '').trim();
    const link = String(row?.link || '').trim();
    lines.push(link ? `- [${filename}](${link})` : `- ${filename}`);
  }
  return `${lines.join('\n')}\n`;
};

export const shellQuote = value => `'${String(value ?? '').replace(/'/g, `'"'"'`)}'`;

export const buildClipchampExportCommand = ({
  localDir,
  remoteName,
  rootFolderId,
  uploadToDrive = true,
  folderName,
  processingLines,
  linksRows,
  manifest
}) => {
  const cleanRemote = String(remoteName || '').trim().replace(/:+$/, '');
  const remoteTarget = `${cleanRemote}:`;
  const linksCsv = buildLinksMapCsv(linksRows);
  const videosMarkdown = buildVideosMarkdown(linksRows, folderName);
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  const linksPath = `${localDir}/links_map.csv`;
  const markdownPath = `${localDir}/videos.md`;
  const manifestPath = `${localDir}/export_manifest.json`;
  const logPath = `${localDir}/upload.log`;
  const rcloneRoot = ['--drive-root-folder-id', shellQuote(rootFolderId)].join(' ');
  const parentUrl = `https://drive.google.com/drive/folders/${rootFolderId}`;
  const uploadLines = (Array.isArray(manifest?.files) ? manifest.files : [])
    .filter(file => String(file?.filename || '').trim())
    .flatMap(file => {
      const filename = String(file.filename).trim();
      const sourcePath = `${localDir}/${filename}`;
      const destinationPath = `${remoteTarget}${filename}`;
      return [
        `printf 'CLIPCHAMP_UPLOAD_START %s\\n' ${shellQuote(filename)}`,
        `if rclone copyto ${shellQuote(sourcePath)} ${shellQuote(destinationPath)} ${rcloneRoot} --stats 1s --stats-one-line --stats-log-level NOTICE --progress 2>&1 | tee -a ${shellQuote(logPath)}; then`,
        `  printf 'CLIPCHAMP_UPLOAD_DONE %s\\n' ${shellQuote(filename)}`,
        'else',
        `  printf 'CLIPCHAMP_UPLOAD_FAILED %s\\n' ${shellQuote(filename)}`,
        '  CLIPCHAMP_EXPORT_FAILED=1',
        'fi'
      ];
    });

  return [
    `# CLIPCHAMP_EXPORT ${folderName}`,
    'set -o pipefail',
    `mkdir -p ${shellQuote(localDir)}`,
    `mkdir -p ${shellQuote(`${localDir}/_tmp`)}`,
    'CLIPCHAMP_EXPORT_FAILED=0',
    ...(processingLines || []),
    `printf %s ${shellQuote(linksCsv)} > ${shellQuote(linksPath)}`,
    `printf %s ${shellQuote(videosMarkdown)} > ${shellQuote(markdownPath)}`,
    `printf %s ${shellQuote(manifestJson)} > ${shellQuote(manifestPath)}`,
    ...(uploadToDrive
      ? [
          ...uploadLines,
          'if [ "$CLIPCHAMP_EXPORT_FAILED" -ne 0 ]; then',
          "  printf 'CLIPCHAMP_EXPORT_FAILED\\n'",
          '  exit 1',
          'fi',
          `printf '\\nDrive folder: %s\\n' ${shellQuote(parentUrl)} | tee -a ${shellQuote(logPath)}`,
          `printf 'CLIPCHAMP_EXPORT_DONE\\n%s\\n' ${shellQuote(parentUrl)}`
        ]
      : [
          'if [ "$CLIPCHAMP_EXPORT_FAILED" -ne 0 ]; then',
          "  printf 'CLIPCHAMP_EXPORT_FAILED\\n'",
          '  exit 1',
          'fi',
          `printf 'CLIPCHAMP_EXPORT_DONE\\nLocal folder: %s\\n' ${shellQuote(localDir)}`
        ])
  ].join('\n');
};
