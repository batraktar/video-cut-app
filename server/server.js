import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { google } from 'googleapis';
import Papa from 'papaparse';
import fs from 'fs';
import { spawn, execFile } from 'child_process';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  buildLinkFilenameMap,
  buildTelegramSheetSyncPlan,
  buildSheetRows,
  resolveSheetRangeByGid,
  resolveSheetFilenames
} from './sheetRows.js';
import { classifyGoogleCredentialError } from './googleCredentialError.js';

const PORT = process.env.PORT || 7071;
const DB_PATH = process.env.DB_PATH || new URL('./metadata.sqlite', import.meta.url).pathname;
const ENV_SHEET_ID = process.env.SHEET_ID || '';
const ENV_SHEET_GID = process.env.SHEET_GID || '';
const ENV_SHEET_NAME = process.env.SHEET_NAME || '';
const ENV_SHEET_RANGE = process.env.SHEET_RANGE || '';
const DEFAULT_SHEET_ID =
  ENV_SHEET_ID || '1hyGuwwz_x6gkvt587yox4EPsK00Mtk_cvtNoX6hU6bQ';
const DEFAULT_SHEET_GID = ENV_SHEET_GID || '1651996986';
const DEFAULT_SHEET_NAME = ENV_SHEET_NAME || 'pre-final';
const DEFAULT_SHEET_RANGE = ENV_SHEET_RANGE || `${DEFAULT_SHEET_NAME}!A:K`;
const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || '';
const DEFAULT_BASE_DIR = process.env.VIDEO_BASE_DIR || '';
const DEFAULT_SHELL = process.env.JOB_SHELL || '/bin/bash';
const DEFAULT_CLIPCHAMP_DRIVE_REMOTE =
  process.env.CLIPCHAMP_DRIVE_REMOTE || 'lqd-kotyk-helper';
const DEFAULT_CLIPCHAMP_DRIVE_FOLDER_ID =
  process.env.CLIPCHAMP_DRIVE_FOLDER_ID || '1_bNIOZBZfbHQU9oEC2e_5Xqu5lSC4D2H';
const DEFAULT_CLIPCHAMP_FOLDER_PREFIX = process.env.CLIPCHAMP_FOLDER_PREFIX || 'Clipchamp';
const AI_SCRIPT_PATH =
  process.env.AI_SCRIPT_PATH ||
  path.resolve(process.cwd(), '..', '..', 'ml', 'batch_predict_segments.py');
const LOGO_SCRIPT_PATH =
  process.env.LOGO_SCRIPT_PATH ||
  path.resolve(process.cwd(), '..', '..', 'ml', 'detect_logo.py');
const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.webm',
  '.m4v',
  '.mts',
  '.m2ts',
  '.3gp'
]);
const IGNORED_DIRS = new Set(['cutted', 'done', '.git', '__MACOSX']);
const VIDEO_MIME = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.webm': 'video/webm',
  '.m4v': 'video/x-m4v',
  '.mts': 'video/mp2t',
  '.m2ts': 'video/mp2t',
  '.3gp': 'video/3gpp'
};

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));

let db;
let sheetsClient;
const isLoopbackAddress = address =>
  ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
const runningJobs = new Map();
const jobQueue = [];
let jobRunnerBusy = false;

const initDb = async () => {
  db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_secrets (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      service_account_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      command TEXT NOT NULL,
      log TEXT NOT NULL,
      exit_code INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_runs (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
};

const loadServiceAccount = async () => {
  if (SERVICE_ACCOUNT_JSON) {
    return JSON.parse(SERVICE_ACCOUNT_JSON);
  }
  if (SERVICE_ACCOUNT_PATH) {
    return JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  }
  const row = await db.get('SELECT service_account_json FROM app_secrets WHERE id = 1');
  if (row?.service_account_json) return JSON.parse(row.service_account_json);
  return null;
};

const initSheetsClient = async credentials => {
  const creds = credentials || await loadServiceAccount();
  if (!creds?.client_email || !creds?.private_key) return null;
  const auth = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
};

const loadLinkFilenameMap = async baseDir => {
  const appDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    baseDir && path.join(baseDir, 'links_map.csv'),
    baseDir && path.join(path.dirname(baseDir), 'links_map.csv'),
    path.resolve(appDirectory, '..', 'tools', 'telegram-downloader', 'Telegram Uploads', 'links_map.csv')
  ].filter(Boolean);
  const existingFiles = [];
  for (const candidate of new Set(candidates)) {
    try {
      const stat = await fs.promises.stat(candidate);
      if (stat.isFile()) existingFiles.push({ candidate, modifiedAt: stat.mtimeMs });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  existingFiles.sort((left, right) => right.modifiedAt - left.modifiedAt);
  for (const { candidate } of existingFiles) {
    try {
      const csvText = await fs.promises.readFile(candidate, 'utf8');
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      const records = parsed.data || [];
      return { map: buildLinkFilenameMap(records), records, sourcePath: candidate };
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return { map: new Map(), records: [], sourcePath: '' };
};

const fetchSheetRows = async () => {
  const config = await getConfig();
  const sheetId = config.sheetId || DEFAULT_SHEET_ID;
  const sheetGid = config.sheetGid || DEFAULT_SHEET_GID;
  const sheetRange = config.sheetRange || DEFAULT_SHEET_RANGE;
  let values;
  if (sheetsClient) {
    const metadata = await sheetsClient.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'sheets.properties(sheetId,title)'
    });
    const resolvedRange = resolveSheetRangeByGid(
      metadata.data.sheets,
      sheetGid,
      sheetRange
    );
    const result = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: resolvedRange
    });
    values = result.data.values || [];
  } else {
    if (!sheetId) return { rows: [], totalRows: 0, resolvedFromLinksMap: 0, unresolvedRows: 0 };
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${sheetGid}`;
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error('csv_fetch_failed');
    const csvText = await res.text();
    const parsed = Papa.parse(csvText, { skipEmptyLines: true });
    values = parsed.data || [];
  }

  const sheetRows = buildSheetRows(values);
  const linkMap = await loadLinkFilenameMap(config.baseDir || DEFAULT_BASE_DIR);
  return {
    ...resolveSheetFilenames(sheetRows, linkMap.map),
    linksMapPath: linkMap.sourcePath
  };
};

const getConfig = async () => {
  const row = await db.get('SELECT payload FROM config WHERE id = 1');
  const savedCredentials = Boolean(await db.get('SELECT id FROM app_secrets WHERE id = 1'));
  const googleCredentialsConfigured = Boolean(SERVICE_ACCOUNT_JSON || SERVICE_ACCOUNT_PATH || savedCredentials);
  if (!row) {
    return {
      baseDir: DEFAULT_BASE_DIR,
      shell: DEFAULT_SHELL,
      sheetId: DEFAULT_SHEET_ID,
      sheetGid: DEFAULT_SHEET_GID,
      sheetName: DEFAULT_SHEET_NAME,
      sheetRange: DEFAULT_SHEET_RANGE,
      googleCredentialsConfigured,
      clipchampDriveRemote: DEFAULT_CLIPCHAMP_DRIVE_REMOTE,
      clipchampDriveFolderId: DEFAULT_CLIPCHAMP_DRIVE_FOLDER_ID,
      clipchampFolderPrefix: DEFAULT_CLIPCHAMP_FOLDER_PREFIX,
      clipchampUploadToDrive: true
    };
  }
  try {
    const payload = JSON.parse(row.payload);
    return {
      baseDir: payload.baseDir ?? DEFAULT_BASE_DIR,
      shell: payload.shell ?? DEFAULT_SHELL,
      aiModelPath: payload.aiModelPath ?? '',
      aiPythonPath: payload.aiPythonPath ?? '',
      aiFps: typeof payload.aiFps === 'number' ? payload.aiFps : 1,
      aiMinDuration: typeof payload.aiMinDuration === 'number' ? payload.aiMinDuration : 2,
      aiRemoteUrl: typeof payload.aiRemoteUrl === 'string' ? payload.aiRemoteUrl : '',
      logoTemplatePath: payload.logoTemplatePath ?? '',
      logoFps: typeof payload.logoFps === 'number' ? payload.logoFps : 2,
      logoSize: typeof payload.logoSize === 'number' ? payload.logoSize : 640,
      logoThreshold: typeof payload.logoThreshold === 'number' ? payload.logoThreshold : 0.55,
      logoMinDuration: typeof payload.logoMinDuration === 'number' ? payload.logoMinDuration : 0.5,
      logoMaxMatches: typeof payload.logoMaxMatches === 'number' ? payload.logoMaxMatches : 5,
      logoMaxGap: typeof payload.logoMaxGap === 'number' ? payload.logoMaxGap : 0.5,
      logoScales: typeof payload.logoScales === 'string' ? payload.logoScales : '0.9,1.0,1.1',
      clipchampDriveRemote:
        typeof payload.clipchampDriveRemote === 'string'
          ? payload.clipchampDriveRemote
          : DEFAULT_CLIPCHAMP_DRIVE_REMOTE,
      clipchampDriveFolderId:
        typeof payload.clipchampDriveFolderId === 'string'
          ? payload.clipchampDriveFolderId
          : DEFAULT_CLIPCHAMP_DRIVE_FOLDER_ID,
      clipchampFolderPrefix:
        typeof payload.clipchampFolderPrefix === 'string'
          ? payload.clipchampFolderPrefix
          : DEFAULT_CLIPCHAMP_FOLDER_PREFIX,
      clipchampUploadToDrive: payload.clipchampUploadToDrive !== false,
      sheetId:
        ENV_SHEET_ID || (typeof payload.sheetId === 'string' ? payload.sheetId : DEFAULT_SHEET_ID),
      sheetGid:
        ENV_SHEET_GID ||
        (typeof payload.sheetGid === 'string' ? payload.sheetGid : DEFAULT_SHEET_GID),
      sheetName:
        ENV_SHEET_NAME ||
        (typeof payload.sheetName === 'string' ? payload.sheetName : DEFAULT_SHEET_NAME),
      sheetRange:
        ENV_SHEET_RANGE ||
        (typeof payload.sheetRange === 'string' ? payload.sheetRange : DEFAULT_SHEET_RANGE),
      googleCredentialsConfigured
    };
  } catch (e) {
    return {
      baseDir: DEFAULT_BASE_DIR,
      shell: DEFAULT_SHELL,
      aiModelPath: '',
      aiPythonPath: '',
      aiFps: 1,
      aiMinDuration: 2,
      aiRemoteUrl: '',
      logoTemplatePath: '',
      logoFps: 2,
      logoSize: 640,
      logoThreshold: 0.55,
      logoMinDuration: 0.5,
      logoMaxMatches: 5,
      logoMaxGap: 0.5,
      logoScales: '0.9,1.0,1.1',
      clipchampDriveRemote: DEFAULT_CLIPCHAMP_DRIVE_REMOTE,
      clipchampDriveFolderId: DEFAULT_CLIPCHAMP_DRIVE_FOLDER_ID,
      clipchampFolderPrefix: DEFAULT_CLIPCHAMP_FOLDER_PREFIX,
      clipchampUploadToDrive: true,
      sheetId: DEFAULT_SHEET_ID,
      sheetGid: DEFAULT_SHEET_GID,
      sheetName: DEFAULT_SHEET_NAME,
      sheetRange: DEFAULT_SHEET_RANGE,
      googleCredentialsConfigured
    };
  }
};

const saveConfig = async updates => {
  const current = await getConfig();
  const next = {
    baseDir: typeof updates.baseDir === 'string' ? updates.baseDir : current.baseDir,
    shell: typeof updates.shell === 'string' ? updates.shell : current.shell,
    aiModelPath: typeof updates.aiModelPath === 'string' ? updates.aiModelPath : current.aiModelPath,
    aiPythonPath:
      typeof updates.aiPythonPath === 'string' ? updates.aiPythonPath : current.aiPythonPath,
    aiFps: typeof updates.aiFps === 'number' ? updates.aiFps : current.aiFps,
    aiMinDuration:
      typeof updates.aiMinDuration === 'number' ? updates.aiMinDuration : current.aiMinDuration,
    aiRemoteUrl:
      typeof updates.aiRemoteUrl === 'string' ? updates.aiRemoteUrl : current.aiRemoteUrl,
    logoTemplatePath:
      typeof updates.logoTemplatePath === 'string'
        ? updates.logoTemplatePath
        : current.logoTemplatePath,
    logoFps: typeof updates.logoFps === 'number' ? updates.logoFps : current.logoFps,
    logoSize: typeof updates.logoSize === 'number' ? updates.logoSize : current.logoSize,
    logoThreshold:
      typeof updates.logoThreshold === 'number' ? updates.logoThreshold : current.logoThreshold,
    logoMinDuration:
      typeof updates.logoMinDuration === 'number'
        ? updates.logoMinDuration
        : current.logoMinDuration,
    logoMaxMatches:
      typeof updates.logoMaxMatches === 'number'
        ? updates.logoMaxMatches
        : current.logoMaxMatches,
    logoMaxGap:
      typeof updates.logoMaxGap === 'number' ? updates.logoMaxGap : current.logoMaxGap,
    logoScales: typeof updates.logoScales === 'string' ? updates.logoScales : current.logoScales,
    clipchampDriveRemote:
      typeof updates.clipchampDriveRemote === 'string'
        ? updates.clipchampDriveRemote
        : current.clipchampDriveRemote,
    clipchampDriveFolderId:
      typeof updates.clipchampDriveFolderId === 'string'
        ? updates.clipchampDriveFolderId
        : current.clipchampDriveFolderId,
    clipchampFolderPrefix:
      typeof updates.clipchampFolderPrefix === 'string'
        ? updates.clipchampFolderPrefix
        : current.clipchampFolderPrefix,
    clipchampUploadToDrive:
      typeof updates.clipchampUploadToDrive === 'boolean'
        ? updates.clipchampUploadToDrive
        : current.clipchampUploadToDrive,
    sheetId: typeof updates.sheetId === 'string' ? updates.sheetId : current.sheetId,
    sheetGid: typeof updates.sheetGid === 'string' ? updates.sheetGid : current.sheetGid,
    sheetName: typeof updates.sheetName === 'string' ? updates.sheetName : current.sheetName,
    sheetRange: typeof updates.sheetRange === 'string' ? updates.sheetRange : current.sheetRange
  };
  const updatedAt = new Date().toISOString();
  await db.run(
    `INSERT INTO config (id, payload, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at;`,
    [JSON.stringify(next), updatedAt]
  );
  return next;
};

const saveAiRun = async payload => {
  const id = String(Date.now());
  const createdAt = new Date().toISOString();
  await db.run(
    `INSERT INTO ai_runs (id, payload, created_at)
     VALUES (?, ?, ?)`,
    [id, JSON.stringify(payload), createdAt]
  );
  return { id, createdAt };
};

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || `exit ${code}`));
    });
  });

const saveJob = async job => {
  await db.run(
    `INSERT INTO jobs (id, status, command, log, exit_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status,
       command = excluded.command,
       log = excluded.log,
       exit_code = excluded.exit_code,
       updated_at = excluded.updated_at;`,
    [
      job.id,
      job.status,
      job.command,
      job.log || '',
      job.exitCode ?? null,
      job.createdAt,
      job.updatedAt
    ]
  );
};

const trimLog = log => {
  const maxSize = 200_000;
  if (log.length <= maxSize) return log;
  return log.slice(log.length - maxSize);
};

const pickFolder = () =>
  new Promise((resolve, reject) => {
    if (process.platform !== 'darwin') {
      reject(new Error('not_supported'));
      return;
    }
    const script = 'POSIX path of (choose folder with prompt "Оберіть папку з відео")';
    execFile('osascript', ['-e', script], (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(String(stdout || '').trim());
    });
  });

const runJob = async job => {
  const config = await getConfig();
  const cwd = config.baseDir || process.cwd();
  const shell = config.shell || DEFAULT_SHELL;
  job.status = 'running';
  job.updatedAt = new Date().toISOString();
  await saveJob(job);

  let child;
  try {
    child = spawn(shell, ['-lc', job.command], {
      cwd,
      env: process.env
    });
  } catch (err) {
    const updatedAt = new Date().toISOString();
    await saveJob({
      ...job,
      status: 'error',
      log: trimLog(`${job.log || ''}\n${err.message || String(err)}`),
      exitCode: null,
      updatedAt
    });
    return;
  }

  runningJobs.set(job.id, { ...job, pid: child.pid, log: job.log || '', child, canceled: false });

  const handleChunk = chunk => {
    const active = runningJobs.get(job.id);
    if (!active) return;
    active.log = trimLog(`${active.log}${chunk}`);
    runningJobs.set(job.id, active);
  };

  await new Promise(resolve => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };

    child.stdout.on('data', data => handleChunk(data.toString()));
    child.stderr.on('data', data => handleChunk(data.toString()));
    child.on('error', async err => {
      const failed = runningJobs.get(job.id);
      runningJobs.delete(job.id);
      const log = trimLog(`${failed?.log || ''}\n${err.message || String(err)}`);
      const updatedAt = new Date().toISOString();
      await saveJob({
        ...job,
        status: failed?.canceled ? 'canceled' : 'error',
        log,
        exitCode: null,
        updatedAt
      });
      finish();
    });

    child.on('close', async code => {
      const ended = runningJobs.get(job.id);
      runningJobs.delete(job.id);
      const log = ended?.log || job.log || '';
      const updatedAt = new Date().toISOString();
      const exitCode = Number.isFinite(code) ? code : null;
      const status = ended?.canceled ? 'canceled' : exitCode === 0 ? 'done' : 'error';
      await saveJob({
        ...job,
        status,
        log,
        exitCode,
        updatedAt
      });
      finish();
    });
  });
};

const processJobQueue = async () => {
  if (jobRunnerBusy) return;
  const next = jobQueue.shift();
  if (!next) return;
  jobRunnerBusy = true;
  try {
    await runJob(next);
  } finally {
    jobRunnerBusy = false;
    processJobQueue();
  }
};

const stopJobById = async id => {
  if (!id) return null;
  const running = runningJobs.get(id);
  if (running) {
    running.canceled = true;
    runningJobs.set(id, running);
    try {
      running.child?.kill('SIGTERM');
    } catch (e) {
      console.error('Failed to stop job', e);
    }
    return { ok: true, status: 'canceled', mode: 'running' };
  }
  const queuedIndex = jobQueue.findIndex(job => job.id === id);
  if (queuedIndex !== -1) {
    const [queued] = jobQueue.splice(queuedIndex, 1);
    const updatedAt = new Date().toISOString();
    await saveJob({ ...queued, status: 'canceled', updatedAt });
    return { ok: true, status: 'canceled', mode: 'queued' };
  }
  const row = await db.get(
    'SELECT id, status, command, log, exit_code as exitCode, created_at as createdAt, updated_at as updatedAt FROM jobs WHERE id = ?',
    [id]
  );
  if (!row) return null;
  if (row.status === 'queued') {
    const updatedAt = new Date().toISOString();
    await saveJob({ ...row, status: 'canceled', updatedAt });
    return { ok: true, status: 'canceled', mode: 'queued' };
  }
  return { ok: false, status: row.status };
};

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/google-credentials', async (req, res) => {
  const remoteAddress = req.socket.remoteAddress || '';
  if (!isLoopbackAddress(remoteAddress)) {
    return res.status(403).json({ ok: false, error: 'local_only' });
  }
  try {
    if (SERVICE_ACCOUNT_JSON || SERVICE_ACCOUNT_PATH) {
      return res.status(409).json({ ok: false, error: 'credentials_from_environment' });
    }
    const raw = req.body?.serviceAccountJson;
    if (typeof raw !== 'string' || !raw.trim()) {
      return res.status(400).json({ ok: false, error: 'credentials_required' });
    }
    let credentials;
    try {
      credentials = JSON.parse(raw);
    } catch {
      return res.status(400).json({ ok: false, error: 'credentials_json_invalid' });
    }
    if (!credentials?.client_email || !credentials?.private_key) {
      return res.status(400).json({ ok: false, error: 'credentials_fields_missing' });
    }
    const candidate = await initSheetsClient(credentials);
    const config = await getConfig();
    await candidate.spreadsheets.get({
      spreadsheetId: config.sheetId || DEFAULT_SHEET_ID,
      fields: 'spreadsheetId'
    });
    await db.run(
      `INSERT INTO app_secrets (id, service_account_json, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET service_account_json = excluded.service_account_json,
       updated_at = excluded.updated_at`,
      [raw, new Date().toISOString()]
    );
    sheetsClient = candidate;
    res.json({ ok: true });
  } catch (error) {
    sheetsClient = await initSheetsClient();
    res.status(400).json({ ok: false, error: classifyGoogleCredentialError(error) });
  }
});

app.get('/config', async (req, res) => {
  try {
    const config = await getConfig();
    res.json({ ok: true, config });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'config_read_failed' });
  }
});

app.post('/config', async (req, res) => {
  try {
    const config = await saveConfig(req.body || {});
    res.json({ ok: true, config });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'config_write_failed' });
  }
});

app.post('/config/pick-folder', async (req, res) => {
  try {
    const selected = await pickFolder();
    if (!selected) {
      return res.status(400).json({ ok: false, error: 'cancelled' });
    }
    let config = null;
    if (req.body?.save) {
      config = await saveConfig({ baseDir: selected });
    }
    res.json({ ok: true, path: selected, config });
  } catch (e) {
    const message = String(e?.message || '').toLowerCase();
    if (message.includes('user canceled')) {
      return res.status(400).json({ ok: false, error: 'cancelled' });
    }
    if (message.includes('not_supported')) {
      return res.status(400).json({ ok: false, error: 'not_supported' });
    }
    res.status(500).json({ ok: false, error: 'pick_folder_failed' });
  }
});

app.get('/files', async (req, res) => {
  try {
    const config = await getConfig();
    if (!config.baseDir) {
      return res.status(400).json({ ok: false, error: 'base_dir_missing' });
    }
    const baseDir = path.resolve(config.baseDir);
    const files = [];
    const stack = [baseDir];
    while (stack.length > 0) {
      const currentDir = stack.pop();
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name)) continue;
          stack.push(path.join(currentDir, entry.name));
          continue;
        }
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!VIDEO_EXTENSIONS.has(ext)) continue;
        const fullPath = path.join(currentDir, entry.name);
        const stat = await fs.promises.stat(fullPath);
        const relativePath = path.relative(baseDir, fullPath);
        files.push({
          name: entry.name,
          relativePath,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          type: VIDEO_MIME[ext] || 'application/octet-stream'
        });
      }
    }
    res.json({ ok: true, baseDir, files });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'files_list_failed' });
  }
});

app.post('/ai/segments', async (req, res) => {
  try {
    const payload = req.body || {};
    const files = Array.isArray(payload.files) ? payload.files : [];
    if (files.length === 0) {
      res.status(400).json({ ok: false, error: 'no_files' });
      return;
    }
    const config = await getConfig();
    const baseDir = config.baseDir ? path.resolve(config.baseDir) : '';
    if (!baseDir) {
      res.status(400).json({ ok: false, error: 'missing_base_dir' });
      return;
    }
    const modelPath = payload.modelPath || config.aiModelPath;
    if (!modelPath) {
      res.status(400).json({ ok: false, error: 'missing_model_path' });
      return;
    }
    if (!fs.existsSync(AI_SCRIPT_PATH)) {
      res.status(500).json({ ok: false, error: 'missing_ai_script' });
      return;
    }
    const pythonPath = payload.pythonPath || config.aiPythonPath || 'python3';
    const fps = Number.isFinite(payload.fps) ? payload.fps : config.aiFps;
    const minDuration = Number.isFinite(payload.minDuration)
      ? payload.minDuration
      : config.aiMinDuration;
    const writeFfmpeg = payload.writeFfmpeg !== false;
    const overwrite = !!payload.overwrite;

    const resolved = [];
    const metaByPath = new Map();
    files.forEach(item => {
      if (!item) return;
      const sourcePath = item.sourcePath || '';
      const fileKey = item.fileKey || '';
      const id = item.id || '';
      const absPath = path.isAbsolute(sourcePath)
        ? sourcePath
        : path.resolve(baseDir, sourcePath);
      if (baseDir && !absPath.startsWith(baseDir)) return;
      if (!fs.existsSync(absPath)) return;
      resolved.push(absPath);
      metaByPath.set(absPath, {
        sourcePath,
        fileKey,
        id,
        allowedModes: Array.isArray(item.allowedModes)
          ? item.allowedModes.filter(mode => typeof mode === 'string' && mode)
          : []
      });
    });

    if (resolved.length === 0) {
      res.status(400).json({ ok: false, error: 'no_valid_files' });
      return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-segments-'));
    const listPath = path.join(tmpDir, 'files.txt');
    fs.writeFileSync(listPath, resolved.join('\n'));
    const outDir = path.join(tmpDir, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const summaryPath = path.join(tmpDir, 'summary.json');

    const args = [
      AI_SCRIPT_PATH,
      '--list',
      listPath,
      '--model',
      modelPath,
      '--fps',
      String(fps),
      '--min-duration',
      String(minDuration),
      '--out',
      outDir,
      '--summary',
      summaryPath
    ];
    if (writeFfmpeg) args.push('--write-ffmpeg');
    if (overwrite) args.push('--overwrite');

    await runCommand(pythonPath, args, { cwd: path.dirname(AI_SCRIPT_PATH) });

    const summaryRaw = fs.readFileSync(summaryPath, 'utf8');
    const summary = JSON.parse(summaryRaw);
    const items = Array.isArray(summary.items) ? summary.items : [];
    const mergedItems = items.map(item => {
      const meta = metaByPath.get(item.video) || {};
      const allowedModes = Array.isArray(meta.allowedModes) ? meta.allowedModes : [];
      let segments = item.segments || {};
      if (allowedModes.length > 0) {
        const filtered = {};
        allowedModes.forEach(mode => {
          if (segments[mode]) filtered[mode] = segments[mode];
        });
        segments = filtered;
      }
      return {
        ...item,
        segments,
        sourcePath: meta.sourcePath || '',
        fileKey: meta.fileKey || '',
        id: meta.id || '',
        allowedModes
      };
    });
    let ffmpegScript = '';
    const ffmpegPath = path.join(outDir, 'ffmpeg_batch.sh');
    if (fs.existsSync(ffmpegPath)) {
      ffmpegScript = fs.readFileSync(ffmpegPath, 'utf8');
    }
    const runPayload = {
      items: mergedItems,
      ffmpegScript,
      options: { fps, minDuration, writeFfmpeg, overwrite },
      createdAt: new Date().toISOString()
    };
    const runMeta = await saveAiRun(runPayload);
    res.json({ ok: true, runId: runMeta.id, payload: runPayload });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'ai_failed', detail: String(e.message || e) });
  }
});

app.post('/ai/logo', async (req, res) => {
  try {
    const payload = req.body || {};
    const files = Array.isArray(payload.files) ? payload.files : [];
    if (files.length === 0) {
      res.status(400).json({ ok: false, error: 'no_files' });
      return;
    }
    const config = await getConfig();
    const baseDir = config.baseDir ? path.resolve(config.baseDir) : '';
    if (!baseDir) {
      res.status(400).json({ ok: false, error: 'missing_base_dir' });
      return;
    }
    if (!fs.existsSync(LOGO_SCRIPT_PATH)) {
      res.status(500).json({ ok: false, error: 'missing_logo_script' });
      return;
    }
    const templatePathRaw = payload.templatePath || config.logoTemplatePath || 'image.png';
    const templatePath = path.isAbsolute(templatePathRaw)
      ? templatePathRaw
      : path.resolve(path.dirname(LOGO_SCRIPT_PATH), templatePathRaw);
    if (!templatePath) {
      res.status(400).json({ ok: false, error: 'missing_template_path' });
      return;
    }
    if (!fs.existsSync(templatePath)) {
      res.status(400).json({ ok: false, error: 'template_not_found' });
      return;
    }
    const pythonPath = payload.pythonPath || config.aiPythonPath || 'python3';
    const fps = Number.isFinite(payload.fps) ? payload.fps : config.logoFps;
    const size = Number.isFinite(payload.size) ? payload.size : config.logoSize;
    const threshold = Number.isFinite(payload.threshold)
      ? payload.threshold
      : config.logoThreshold;
    const minDuration = Number.isFinite(payload.minDuration)
      ? payload.minDuration
      : config.logoMinDuration;
    const maxMatches = Number.isFinite(payload.maxMatches)
      ? payload.maxMatches
      : config.logoMaxMatches;
    const maxGap = Number.isFinite(payload.maxGap) ? payload.maxGap : config.logoMaxGap;
    const scales =
      typeof payload.scales === 'string'
        ? payload.scales
        : typeof config.logoScales === 'string'
        ? config.logoScales
        : '';

    const resolved = [];
    const metaByPath = new Map();
    files.forEach(item => {
      if (!item) return;
      const sourcePath = item.sourcePath || '';
      const fileKey = item.fileKey || '';
      const id = item.id || '';
      const absPath = path.isAbsolute(sourcePath)
        ? sourcePath
        : path.resolve(baseDir, sourcePath);
      if (baseDir && !absPath.startsWith(baseDir)) return;
      if (!fs.existsSync(absPath)) return;
      resolved.push(absPath);
      metaByPath.set(absPath, { sourcePath, fileKey, id });
    });

    if (resolved.length === 0) {
      res.status(400).json({ ok: false, error: 'no_valid_files' });
      return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-logo-'));
    const items = [];
    for (const absPath of resolved) {
      const outPath = path.join(
        tmpDir,
        `${path.basename(absPath).replace(/\W+/g, '_')}_logo.json`
      );
      const args = [
        LOGO_SCRIPT_PATH,
        '--video',
        absPath,
        '--template',
        templatePath,
        '--fps',
        String(fps),
        '--size',
        String(size),
      '--threshold',
      String(threshold),
      '--min-duration',
      String(minDuration),
      '--max-matches',
      String(maxMatches),
      '--max-gap',
      String(maxGap),
      '--out',
      outPath
    ];
      if (scales) {
        args.push('--scales', scales);
      }
      await runCommand(pythonPath, args, { cwd: path.dirname(LOGO_SCRIPT_PATH) });
      const raw = fs.readFileSync(outPath, 'utf8');
      const data = JSON.parse(raw);
      const meta = metaByPath.get(absPath) || {};
      items.push({
        ...data,
        sourcePath: meta.sourcePath || '',
        fileKey: meta.fileKey || '',
        id: meta.id || ''
      });
    }
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'logo_failed', detail: String(e.message || e) });
  }
});

app.get('/file', async (req, res) => {
  try {
    const requested = String(req.query.path || '');
    if (!requested) return res.status(400).json({ ok: false, error: 'missing_path' });
    const config = await getConfig();
    if (!config.baseDir) {
      return res.status(400).json({ ok: false, error: 'base_dir_missing' });
    }
    const baseDir = path.resolve(config.baseDir);
    const target = path.resolve(baseDir, requested);
    if (!target.startsWith(baseDir + path.sep)) {
      return res.status(403).json({ ok: false, error: 'invalid_path' });
    }
    const stat = await fs.promises.stat(target);
    if (!stat.isFile()) return res.status(404).json({ ok: false, error: 'not_found' });
    const ext = path.extname(target).toLowerCase();
    const contentType = VIDEO_MIME[ext] || 'application/octet-stream';
    const range = req.headers.range;
    if (!range) {
      res.status(200);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      fs.createReadStream(target).pipe(res);
      return;
    }
    const [startRaw, endRaw] = range.replace(/bytes=/, '').split('-');
    const start = Number.parseInt(startRaw, 10);
    const end = endRaw ? Number.parseInt(endRaw, 10) : stat.size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      res.end();
      return;
    }
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', chunkSize);
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(target, { start, end }).pipe(res);
  } catch (e) {
    res.status(500).json({ ok: false, error: 'file_read_failed' });
  }
});

app.get('/sheet-map', async (req, res) => {
  try {
    const result = await fetchSheetRows();
    res.json({ ok: true, ...result, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Sheet read failed', e?.response?.data?.error || e?.message || e);
    res.status(500).json({ ok: false, error: 'sheet_read_failed' });
  }
});

app.post('/sheet/status', async (req, res) => {
  try {
    if (!sheetsClient) {
      return res.status(400).json({ ok: false, error: 'sheet_write_not_configured' });
    }
    const { rowIndex, status } = req.body || {};
    if (!rowIndex) return res.status(400).json({ ok: false, error: 'missing_row' });
    const value = status || 'done';
    const config = await getConfig();
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: config.sheetId || DEFAULT_SHEET_ID,
      range: `${config.sheetName || DEFAULT_SHEET_NAME}!B${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[value]] }
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'sheet_write_failed' });
  }
});

app.post('/sheet/sync-file-names', async (req, res) => {
  if (!isLoopbackAddress(req.socket.remoteAddress || '')) {
    return res.status(403).json({ ok: false, error: 'local_only' });
  }
  try {
    if (!sheetsClient) {
      return res.status(400).json({ ok: false, error: 'sheet_write_not_configured' });
    }
    const config = await getConfig();
    const linkMap = await loadLinkFilenameMap(config.baseDir || DEFAULT_BASE_DIR);
    if (!linkMap.sourcePath) {
      return res.status(404).json({ ok: false, error: 'links_map_not_found' });
    }

    const spreadsheetId = config.sheetId || DEFAULT_SHEET_ID;
    const metadata = await sheetsClient.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties(sheetId,title)'
    });
    const sheetTitles = new Set((metadata.data.sheets || []).map(sheet => sheet.properties?.title));
    if (!sheetTitles.has('parse') || !sheetTitles.has('pre-final')) {
      return res.status(400).json({ ok: false, error: 'sheet_sync_tabs_missing' });
    }

    const [parseResult, preFinalResult] = await Promise.all([
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: "'parse'!A:B" }),
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: "'pre-final'!A:H" })
    ]);
    const plan = buildTelegramSheetSyncPlan(
      parseResult.data.values || [],
      preFinalResult.data.values || [],
      linkMap.records
    );

    if (plan.parseUpdates.length > 0) {
      const data = plan.parseUpdates.map(update => ({
        range: `'parse'!B${update.rowIndex}`,
        values: [[update.filename]]
      }));
      await sheetsClient.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: 'RAW', data }
      });
    }
    if (plan.parseAppends.length > 0) {
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId,
        range: "'parse'!A:B",
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: plan.parseAppends }
      });
    }
    if (plan.preFinalNames.length > 0) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: `'pre-final'!H2:H${plan.preFinalNames.length + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: plan.preFinalNames }
      });
    }

    res.json({
      ok: true,
      parseUpdated: plan.parseUpdates.length,
      parseAdded: plan.parseAppends.length,
      preFinalFilled: plan.preFinalNames.filter(([name]) => name).length,
      sourcePath: linkMap.sourcePath
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'sheet_sync_failed' });
  }
});

app.post('/jobs', async (req, res) => {
  try {
    const { command } = req.body || {};
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ ok: false, error: 'missing_command' });
    }
    const job = {
      id: Date.now().toString(),
      status: 'queued',
      command,
      log: '',
      exitCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveJob(job);
    jobQueue.push(job);
    processJobQueue().catch(err => {
      console.error('Job queue failed', err);
    });
    res.json({ ok: true, id: job.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'job_create_failed' });
  }
});

app.get('/jobs', async (req, res) => {
  try {
    const runningIds = new Set(runningJobs.keys());
    const rows = await db.all(
      'SELECT id, status, command, log, exit_code as exitCode, created_at as createdAt, updated_at as updatedAt FROM jobs ORDER BY created_at DESC LIMIT 25'
    );
    const running = Array.from(runningJobs.values()).map(job => ({
      id: job.id,
      status: job.status,
      command: job.command,
      log: job.log || '',
      exitCode: job.exitCode ?? null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    }));
    const filtered = rows.filter(row => !runningIds.has(row.id));
    res.json({ ok: true, jobs: [...running, ...filtered] });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'job_list_failed' });
  }
});

app.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const running = runningJobs.get(id);
    if (running) {
      return res.json({
        ok: true,
        job: {
          id: running.id,
          status: running.status,
          command: running.command,
          log: running.log || '',
          exitCode: running.exitCode ?? null,
          createdAt: running.createdAt,
          updatedAt: running.updatedAt
        }
      });
    }
    const row = await db.get(
      'SELECT id, status, command, log, exit_code as exitCode, created_at as createdAt, updated_at as updatedAt FROM jobs WHERE id = ?',
      [id]
    );
    if (!row) return res.status(404).json({ ok: false, error: 'job_not_found' });
    res.json({ ok: true, job: row });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'job_read_failed' });
  }
});

app.post('/jobs/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await stopJobById(id);
    if (!result) return res.status(404).json({ ok: false, error: 'job_not_found' });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'job_stop_failed' });
  }
});

app.post('/sync', async (req, res) => {
  try {
    const payload = req.body || {};
    const updatedAt = new Date().toISOString();
    const json = JSON.stringify(payload);
    await db.run(
      `INSERT INTO snapshots (id, payload, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at;`,
      [json, updatedAt]
    );
    res.json({ ok: true, updatedAt });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

app.get('/snapshot', async (req, res) => {
  try {
    const row = await db.get('SELECT payload, updated_at FROM snapshots WHERE id = 1');
    if (!row) return res.status(404).json({ ok: false });
    res.json({ ok: true, updatedAt: row.updated_at, payload: JSON.parse(row.payload) });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

initDb()
  .then(() => {
    return initSheetsClient();
  })
  .then(client => {
    sheetsClient = client;
    app.listen(PORT, () => {
      console.log(`Local DB server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to init DB', err);
    process.exit(1);
  });
