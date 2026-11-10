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
import https from 'https';
import { fileURLToPath } from 'url';
import {
  buildAiChannelSheetValues,
  buildLinkFilenameMap,
  buildTelegramSheetSyncPlan,
  buildSheetRows,
  resolveSheetRangeByGid,
  resolveSheetFilenames
} from './sheetRows.js';
import { classifyGoogleCredentialError } from './googleCredentialError.js';
import { parseRcloneProgressLine } from './rcloneProgress.js';
import { buildClipchampRetryCommand } from './clipchampRetry.js';

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
  process.env.CLIPCHAMP_DRIVE_FOLDER_ID || '1p7uEPZ8WIWWvzbAmy9sV3-L4hWLj-ieb';
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
const driveUploadProgress = new Map();
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
      aiDriveRemote: '',
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
      aiDriveRemote: typeof payload.aiDriveRemote === 'string' ? payload.aiDriveRemote : '',
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
      aiDriveRemote: '',
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
    aiDriveRemote: typeof updates.aiDriveRemote === 'string' ? updates.aiDriveRemote : current.aiDriveRemote,
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
    const { onStderrLine, ...spawnOptions } = options;
    const child = spawn(command, args, { shell: false, ...spawnOptions });
    let stdout = '';
    let stderr = '';
    let stderrLineBuffer = '';
    let settled = false;
    child.stdout?.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', chunk => {
      const text = chunk.toString();
      stderr += text;
      if (onStderrLine) {
        stderrLineBuffer += text;
        const lines = stderrLineBuffer.split(/\r?\n/);
        stderrLineBuffer = lines.pop() || '';
        lines.forEach(line => onStderrLine(line));
      }
    });
    child.on('close', code => {
      if (settled) return;
      settled = true;
      if (stderrLineBuffer && onStderrLine) onStderrLine(stderrLineBuffer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || `exit ${code}`));
    });
    child.on('error', error => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });

const requestAbortSignal = (req, res) => {
  const controller = new AbortController();
  req.once('aborted', () => controller.abort());
  res.once('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller.signal;
};

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
      env: process.env,
      detached: true
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
    running.status = 'canceled';
    runningJobs.set(id, running);
    try {
      if (running.pid) process.kill(-running.pid, 'SIGTERM');
      else running.child?.kill('SIGTERM');
    } catch (e) {
      if (e?.code !== 'ESRCH') console.error('Failed to stop job', e);
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
  res.json({ ok: true, app: 'video-cut-app' });
});

const proxyAiRemote = (req, res, remotePath) => {
  if (!isLoopbackAddress(req.socket.remoteAddress || '')) {
    return res.status(403).json({ ok: false, error: 'local_only' });
  }
  let target;
  try {
    const base = new URL(req.params.remote);
    const host = base.hostname.toLowerCase();
    if (base.protocol !== 'https:' || base.username || base.password || base.port ||
        !(/(^|\.)trycloudflare\.com$|(^|\.)ngrok-free\.app$|(^|\.)batraktar\.pp\.ua$/.test(host))) {
      return res.status(400).json({ ok: false, error: 'unsupported_ai_tunnel_url' });
    }
    const baseHref = base.href.endsWith('/') ? base.href : `${base.href}/`;
    target = new URL(remotePath.replace(/^\//, ''), baseHref);
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_ai_tunnel_url' });
  }
  const headers = { 'ngrok-skip-browser-warning': 'true' };
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  if (req.headers['content-length']) headers['content-length'] = req.headers['content-length'];
  const upstream = https.request(target, { method: req.method, headers, timeout: req.method === 'POST' ? 30 * 60 * 1000 : 15000 }, remote => {
    res.status(remote.statusCode || 502);
    res.setHeader('Content-Type', remote.headers['content-type'] || 'application/json');
    remote.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('ai_tunnel_timeout')));
  upstream.on('error', error => {
    if (!res.headersSent) res.status(502).json({ ok: false, error: 'ai_tunnel_unreachable', detail: error.message });
    else res.destroy(error);
  });
  req.on('aborted', () => upstream.destroy());
  if (req.method === 'POST') req.pipe(upstream);
  else upstream.end();
};

app.get('/ai/remote-proxy/:remote/health', (req, res) => proxyAiRemote(req, res, '/health'));
app.post('/ai/remote-proxy/:remote/predict', (req, res) => proxyAiRemote(req, res, '/predict'));
app.get('/ai/remote-proxy/:remote/result/:taskId', (req, res) =>
  proxyAiRemote(req, res, `/result/${encodeURIComponent(req.params.taskId)}`));

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
      const filtered = {};
      allowedModes.forEach(mode => {
        if (segments[mode]) filtered[mode] = segments[mode];
      });
      segments = filtered;
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

const safeDriveBatchId = value => {
  const id = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{8,96}$/.test(id) ? id : '';
};

const getColabBatchRemotePath = (remote, batchId) =>
  `${String(remote || '').trim().replace(/:+$/, '')}:best2_training/colab_jobs/${batchId}`;

app.post('/ai/drive-batch/start', async (req, res) => {
  const batchId = safeDriveBatchId(req.body?.batchId);
  if (!batchId) return res.status(400).json({ ok: false, error: 'invalid_batch_id' });
  try {
    const config = await getConfig();
    const remote = String(config.aiDriveRemote || '').trim().replace(/:+$/, '');
    if (!remote) return res.status(400).json({ ok: false, error: 'drive_remote_missing' });
    const batchPath = getColabBatchRemotePath(remote, batchId);
    const signal = requestAbortSignal(req, res);
    await runCommand('rclone', ['mkdir', `${batchPath}/inputs`], { signal });
    await runCommand('rclone', ['mkdir', `${batchPath}/jobs`], { signal });
    res.json({ ok: true, batchId, drivePath: `best2_training/colab_jobs/${batchId}` });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'drive_batch_start_failed', detail: String(error.message || error) });
  }
});

app.post('/ai/drive-batch/check', async (req, res) => {
  const remote = String(req.body?.remote || '').trim().replace(/:+$/, '');
  if (!remote) return res.status(400).json({ ok: false, error: 'drive_remote_missing' });
  try {
    const { stdout } = await runCommand('rclone', ['lsd', `${remote}:best2_training`]);
    res.json({ ok: true, remote, drivePath: 'best2_training', folders: stdout.split('\n').filter(Boolean).length });
  } catch (error) {
    res.status(502).json({ ok: false, error: 'drive_check_failed', detail: String(error.message || error) });
  }
});

app.post('/ai/drive-batch/:batchId/files', async (req, res) => {
  const batchId = safeDriveBatchId(req.params.batchId);
  const taskId = safeDriveBatchId(req.body?.taskId);
  const requested = String(req.body?.sourcePath || '');
  if (!batchId || !taskId || !requested) return res.status(400).json({ ok: false, error: 'invalid_job' });
  try {
    const config = await getConfig();
    const baseDir = config.baseDir ? path.resolve(config.baseDir) : '';
    if (!baseDir) return res.status(400).json({ ok: false, error: 'base_dir_missing' });
    const sourcePath = path.resolve(baseDir, requested);
    if (!sourcePath.startsWith(baseDir + path.sep)) return res.status(403).json({ ok: false, error: 'invalid_source_path' });
    const sourceStat = await fs.promises.stat(sourcePath);
    if (!sourceStat.isFile()) return res.status(404).json({ ok: false, error: 'source_not_found' });
    const remote = String(config.aiDriveRemote || '').trim().replace(/:+$/, '');
    if (!remote) return res.status(400).json({ ok: false, error: 'drive_remote_missing' });
    const batchPath = getColabBatchRemotePath(remote, batchId);
    const signal = requestAbortSignal(req, res);
    const ext = VIDEO_EXTENSIONS.has(path.extname(sourcePath).toLowerCase()) ? path.extname(sourcePath).toLowerCase() : '.mp4';
    const relativeInput = `inputs/${taskId}${ext}`;
    const remoteVideoPath = `${batchPath}/${relativeInput}`;
    const progressKey = `${batchId}:${taskId}`;
    const progressState = {
      batchId,
      taskId,
      fileName: path.basename(sourcePath),
      phase: 'uploading',
      bytesTransferred: 0,
      totalBytes: sourceStat.size,
      percent: 0,
      speed: '',
      eta: '',
      updatedAt: new Date().toISOString()
    };
    driveUploadProgress.set(progressKey, progressState);
    const job = {
      task_id: taskId,
      batch_id: batchId,
      file_name: path.basename(sourcePath),
      source_video: path.basename(sourcePath),
      input_relpath: relativeInput,
      allowed_modes: Array.isArray(req.body?.allowedModes)
        ? req.body.allowedModes.filter(mode => ['digital', 'analog', 'thermal_digital', 'thermal_analog'].includes(mode))
        : [],
      status: 'accepted',
      created_at: new Date().toISOString(),
      fps: Math.max(0.1, Math.min(Number(req.body?.fps) || 1, 10)),
      image_size: Math.max(160, Math.min(Number(req.body?.imageSize) || 320, 1280)),
      min_duration: Math.max(0, Math.min(Number(req.body?.minDuration) || 2, 600)),
      smooth_window: Math.max(1, Math.min(Number(req.body?.smoothWindow) || 3, 15))
    };
    try {
      await runCommand('rclone', [
        'copyto', sourcePath, remoteVideoPath,
        '--stats=500ms', '--stats-one-line', '--stats-log-level=NOTICE'
      ], {
        signal,
        onStderrLine: line => {
          const stats = parseRcloneProgressLine(line);
          if (!stats) return;
          driveUploadProgress.set(progressKey, {
            ...progressState,
            ...stats,
            phase: stats.percent >= 100 ? 'uploaded' : 'uploading',
            updatedAt: new Date().toISOString()
          });
        }
      });
      driveUploadProgress.set(progressKey, {
        ...progressState,
        bytesTransferred: sourceStat.size,
        percent: 100,
        phase: 'uploaded',
        updatedAt: new Date().toISOString()
      });
    } catch (uploadError) {
      driveUploadProgress.set(progressKey, {
        ...progressState,
        phase: signal.aborted ? 'cancelled' : 'error',
        error: String(uploadError.message || uploadError),
        updatedAt: new Date().toISOString()
      });
      if (signal.aborted) {
        runCommand('rclone', ['deletefile', remoteVideoPath]).catch(() => {});
        return;
      }
      job.status = 'error';
      job.error = `video_upload_failed: ${String(uploadError.message || uploadError)}`;
    }
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-cut-drive-job-'));
    try {
      const jobFile = path.join(tempDir, `${taskId}.json`);
      await fs.promises.writeFile(jobFile, JSON.stringify(job, null, 2), 'utf8');
      await runCommand('rclone', ['copyto', jobFile, `${batchPath}/jobs/${taskId}.json`]);
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
    res.json({ ok: true, ...job, drivePath: `best2_training/colab_jobs/${batchId}` });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'drive_upload_failed', detail: String(error.message || error) });
  }
});

app.get('/ai/drive-batch/:batchId/progress', (req, res) => {
  const batchId = safeDriveBatchId(req.params.batchId);
  if (!batchId) return res.status(400).json({ ok: false, error: 'invalid_batch_id' });
  const now = Date.now();
  for (const [key, value] of driveUploadProgress) {
    if (now - Date.parse(value.updatedAt) > 60 * 60 * 1000) driveUploadProgress.delete(key);
  }
  const items = [...driveUploadProgress.values()].filter(item => item.batchId === batchId);
  res.json({ ok: true, batchId, items });
});

app.get('/ai/drive-batch/:batchId', async (req, res) => {
  const batchId = safeDriveBatchId(req.params.batchId);
  if (!batchId) return res.status(400).json({ ok: false, error: 'invalid_batch_id' });
  let tempDir = '';
  try {
    const config = await getConfig();
    const remote = String(config.aiDriveRemote || '').trim().replace(/:+$/, '');
    if (!remote) return res.status(400).json({ ok: false, error: 'drive_remote_missing' });
    const batchPath = getColabBatchRemotePath(remote, batchId);
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-cut-drive-status-'));
    await runCommand('rclone', ['copy', `${batchPath}/jobs`, tempDir]);
    const jobDir = tempDir;
    const jobFiles = await fs.promises.readdir(jobDir).catch(() => []);
    const items = [];
    for (const fileName of jobFiles.filter(name => name.endsWith('.json'))) {
      try {
        items.push(JSON.parse(await fs.promises.readFile(path.join(jobDir, fileName), 'utf8')));
      } catch {
        // Ignore an incomplete or malformed state file and report the others.
      }
    }
    items.sort((left, right) => String(left.file_name).localeCompare(String(right.file_name)));
    res.json({ ok: true, batchId, drivePath: `best2_training/colab_jobs/${batchId}`, items });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'drive_batch_read_failed', detail: String(error.message || error) });
  } finally {
    if (tempDir) await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
});

app.post('/ai/drive-batch/:batchId/stop', async (req, res) => {
  const batchId = safeDriveBatchId(req.params.batchId);
  if (!batchId) return res.status(400).json({ ok: false, error: 'invalid_batch_id' });
  let tempDir = '';
  try {
    const config = await getConfig();
    const remote = String(config.aiDriveRemote || '').trim().replace(/:+$/, '');
    if (!remote) return res.status(400).json({ ok: false, error: 'drive_remote_missing' });
    const batchPath = getColabBatchRemotePath(remote, batchId);
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-cut-drive-stop-'));
    await runCommand('rclone', ['copy', `${batchPath}/jobs`, tempDir]);
    const jobFiles = await fs.promises.readdir(tempDir).catch(() => []);
    let cancelled = 0;
    let cancelRequested = 0;
    const changedJobs = [];
    for (const fileName of jobFiles.filter(name => name.endsWith('.json'))) {
      const jobPath = path.join(tempDir, fileName);
      let job;
      try {
        job = JSON.parse(await fs.promises.readFile(jobPath, 'utf8'));
      } catch {
        continue;
      }
      if (['done', 'error', 'cancelled'].includes(job.status)) continue;
      if (job.status === 'processing') {
        job.cancel_requested = true;
        cancelRequested += 1;
      } else {
        job.status = 'cancelled';
        job.cancelled_at = new Date().toISOString();
        cancelled += 1;
      }
      await fs.promises.writeFile(jobPath, JSON.stringify(job, null, 2), 'utf8');
      await runCommand('rclone', ['copyto', jobPath, `${batchPath}/jobs/${fileName}`]);
      changedJobs.push(job);
    }
    if (changedJobs.length) {
      const manifestPath = path.join(tempDir, 'result_manifest.json');
      let manifest = { batch_id: batchId, items: [] };
      try {
        await runCommand('rclone', ['copyto', `${batchPath}/result_manifest.json`, manifestPath]);
        manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
      } catch {
        // A batch without a manifest is valid until its first worker update.
      }
      const byTask = new Map((manifest.items || []).map(item => [item.task_id, item]));
      changedJobs.forEach(job => byTask.set(job.task_id, job));
      await fs.promises.writeFile(manifestPath, JSON.stringify({
        ...manifest,
        batch_id: batchId,
        updated_at: Date.now() / 1000,
        items: [...byTask.values()]
      }, null, 2), 'utf8');
      await runCommand('rclone', ['copyto', manifestPath, `${batchPath}/result_manifest.json`]);
    }
    res.json({ ok: true, batchId, cancelled, cancelRequested });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'drive_batch_stop_failed', detail: String(error.message || error) });
  } finally {
    if (tempDir) await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
});

app.post('/ai/cover-example', async (req, res) => {
  const payload = req.body || {};
  const dataUrl = String(payload.image || '');
  const match = dataUrl.match(/^data:image\/(jpeg|jpg|png);base64,([\s\S]+)$/);
  if (!match) return res.status(400).json({ ok: false, error: 'invalid_image' });
  const box = ['x', 'y', 'w', 'h'].map(key => Number(payload[key]));
  const [x, y, width, height] = box;
  if (box.some(value => !Number.isFinite(value)) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
    return res.status(400).json({ ok: false, error: 'invalid_box' });
  }
  let tempDir = '';
  try {
    const config = await getConfig();
    const remote = String(config.aiDriveRemote || '').trim().replace(/:+$/, '');
    if (!remote) return res.status(400).json({ ok: false, error: 'drive_remote_missing' });
    const sampleId = `cover_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const root = `${remote}:best2_training/cover_region_dataset/inbox`;
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-cut-cover-sample-'));
    await runCommand('rclone', ['mkdir', `${root}/images`]);
    await runCommand('rclone', ['mkdir', `${root}/labels`]);
    await runCommand('rclone', ['mkdir', `${root}/metadata`]);
    const imagePath = path.join(tempDir, `${sampleId}.jpg`);
    const labelPath = path.join(tempDir, `${sampleId}.txt`);
    const metadataPath = path.join(tempDir, `${sampleId}.json`);
    await fs.promises.writeFile(imagePath, Buffer.from(match[2], 'base64'));
    await fs.promises.writeFile(labelPath, `0 ${(x + width / 2).toFixed(8)} ${(y + height / 2).toFixed(8)} ${width.toFixed(8)} ${height.toFixed(8)}\n`);
    const metadata = {
      id: sampleId,
      class: 'cover_region',
      kind: String(payload.kind || 'cover_region'),
      source_video: String(payload.sourceVideo || ''),
      timestamp: Number(payload.timestamp) || 0,
      box: { x, y, w: width, h: height },
      reviewed: true,
      image_width: Number(payload.imageWidth) || null,
      image_height: Number(payload.imageHeight) || null,
      created_at: new Date().toISOString()
    };
    await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    await runCommand('rclone', ['copyto', imagePath, `${root}/images/${sampleId}.jpg`]);
    await runCommand('rclone', ['copyto', labelPath, `${root}/labels/${sampleId}.txt`]);
    await runCommand('rclone', ['copyto', metadataPath, `${root}/metadata/${sampleId}.json`]);
    res.json({ ok: true, sampleId, drivePath: 'best2_training/cover_region_dataset/inbox' });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'cover_example_upload_failed', detail: String(error.message || error) });
  } finally {
    if (tempDir) await fs.promises.rm(tempDir, { recursive: true, force: true });
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

const AI_SHEET_ADDITIONS_ENABLED = false;
app.post('/sheet/append-ai-channel-row', async (req, res) => {
  if (!AI_SHEET_ADDITIONS_ENABLED) {
    return res.status(410).json({ ok: false, error: 'ai_sheet_additions_disabled' });
  }
  if (!isLoopbackAddress(req.socket.remoteAddress || '')) {
    return res.status(403).json({ ok: false, error: 'local_only' });
  }
  if (!sheetsClient) {
    return res.status(400).json({ ok: false, error: 'sheet_write_not_configured' });
  }
  try {
    const row = req.body?.row || {};
    const fileName = String(row.fileName || '').trim();
    const mode = String(row.mode || '').trim();
    const modeLabels = {
      digital: 'Digital',
      analog: 'Analog',
      thermal_digital: 'Digital',
      thermal_analog: 'Analog'
    };
    if (!fileName || !modeLabels[mode]) {
      return res.status(400).json({ ok: false, error: 'invalid_ai_channel_row' });
    }

    const config = await getConfig();
    const spreadsheetId = config.sheetId || DEFAULT_SHEET_ID;
    const metadata = await sheetsClient.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties(sheetId,title)'
    });
    const gid = Number.parseInt(String(config.sheetGid || DEFAULT_SHEET_GID), 10);
    const title = metadata.data.sheets?.find(sheet => sheet.properties?.sheetId === gid)
      ?.properties?.title || config.sheetName || DEFAULT_SHEET_NAME;
    const quotedTitle = `'${String(title).replaceAll("'", "''")}'`;
    const current = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `${quotedTitle}!A:K`
    });
    const sheetRows = buildSheetRows(current.data.values || []);
    const normalize = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const resolveMode = item => {
      const camera = normalize(item.cameraType);
      const kind = normalize(item.analogDigital);
      const thermal = camera.includes('thermal') || camera.includes('infrared') || kind.includes('thermal');
      const analog = kind.includes('analog');
      if (thermal) return analog ? 'thermal_analog' : 'thermal_digital';
      return analog ? 'analog' : kind.includes('digital') ? 'digital' : '';
    };
    const duplicate = sheetRows.find(item =>
      normalize(item.fileName) === normalize(fileName) && resolveMode(item) === mode
    );
    if (duplicate) {
      return res.json({ ok: true, duplicate: true, rowIndex: duplicate.rowIndex });
    }

    const values = [buildAiChannelSheetValues(current.data.values?.[0], {
      ...row,
      fileName,
      cameraType: row.cameraType || (mode.startsWith('thermal_') ? 'Thermal' : 'Optical')
    }, modeLabels[mode])];
    const appended = await sheetsClient.spreadsheets.values.append({
      spreadsheetId,
      range: `${quotedTitle}!A:K`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values }
    });
    const updatedRange = appended.data.updates?.updatedRange || '';
    const rowIndex = Number(updatedRange.match(/[A-Z]+(\d+)/i)?.[1]) || null;
    res.json({ ok: true, duplicate: false, rowIndex });
  } catch (error) {
    console.error('AI channel row append failed', error?.response?.data?.error || error?.message || error);
    res.status(500).json({ ok: false, error: 'sheet_ai_row_append_failed' });
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
      sheetsClient.spreadsheets.values.get({ spreadsheetId, range: "'pre-final'!A:K" })
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
      // Колонку з назвами файлів шукаємо за заголовком (file_name/tg_file_name),
      // а не пишемо жорстко в H: H у таблиці — date_video, і затирати дати назвами не можна.
      const pfHeaders = (preFinalResult.data.values?.[0] || []).map(h => String(h ?? '').trim().toLowerCase());
      const fileColIdx = pfHeaders.indexOf('tg_file_name') >= 0 ? pfHeaders.indexOf('tg_file_name') : pfHeaders.indexOf('file_name');
      const fileCol = fileColIdx >= 0 ? String.fromCharCode(65 + fileColIdx) : 'H';
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: `'pre-final'!${fileCol}2:${fileCol}${plan.preFinalNames.length + 1}`,
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

app.post('/jobs/:id/retry-incomplete', async (req, res) => {
  try {
    const original = await db.get(
      'SELECT id, status, command, log FROM jobs WHERE id = ?',
      [req.params.id]
    );
    if (!original) return res.status(404).json({ ok: false, error: 'job_not_found' });
    if (!['canceled', 'error'].includes(original.status)) {
      return res.status(409).json({ ok: false, error: 'job_not_finished' });
    }
    const config = await getConfig();
    const retry = buildClipchampRetryCommand(original.command, original.log, config.baseDir || process.cwd());
    if (!retry) return res.status(409).json({ ok: false, error: 'no_incomplete_files' });
    const createdAt = new Date().toISOString();
    const job = {
      id: Date.now().toString(), status: 'queued', command: retry.command, log: '',
      exitCode: null, createdAt, updatedAt: createdAt
    };
    await saveJob(job);
    jobQueue.push(job);
    processJobQueue().catch(error => console.error('Job retry failed', error));
    res.json({ ok: true, id: job.id, remaining: retry.remaining });
  } catch (error) {
    console.error('Incomplete job retry failed', error);
    res.status(500).json({ ok: false, error: 'job_retry_failed' });
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
