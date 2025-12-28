import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { google } from 'googleapis';
import Papa from 'papaparse';
import fs from 'fs';

const PORT = process.env.PORT || 7071;
const DB_PATH = process.env.DB_PATH || new URL('./metadata.sqlite', import.meta.url).pathname;
const SHEET_ID = process.env.SHEET_ID || '1hyGuwwz_x6gkvt587yox4EPsK00Mtk_cvtNoX6hU6bQ';
const SHEET_GID = process.env.SHEET_GID || '1651996986';
const SHEET_NAME = process.env.SHEET_NAME || 'pre-final';
const SHEET_RANGE = process.env.SHEET_RANGE || `${SHEET_NAME}!A:E`;
const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || '';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));

let db;
let sheetsClient;

const initDb = async () => {
  db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
};

const loadServiceAccount = () => {
  if (SERVICE_ACCOUNT_JSON) {
    return JSON.parse(SERVICE_ACCOUNT_JSON);
  }
  if (SERVICE_ACCOUNT_PATH) {
    return JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  }
  return null;
};

const initSheetsClient = () => {
  if (!SHEET_ID) return null;
  const creds = loadServiceAccount();
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

const normalizeHeader = header => header.trim().toLowerCase();

const buildRowMap = rows => {
  if (!rows || rows.length === 0) return [];
  const headers = rows[0].map(normalizeHeader);
  const idxFile = headers.indexOf('tg_file_name');
  const idxMode = headers.indexOf('analog_digital');
  const idxStatus = headers.indexOf('status');
  const output = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const fileName = row[idxFile];
    if (!fileName) continue;
    output.push({
      rowIndex: i + 1,
      fileName: String(fileName).trim(),
      analogDigital: row[idxMode] ? String(row[idxMode]).trim() : '',
      status: row[idxStatus] ? String(row[idxStatus]).trim() : ''
    });
  }
  return output;
};

const fetchSheetRows = async () => {
  if (sheetsClient) {
    const result = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE
    });
    return buildRowMap(result.data.values || []);
  }
  if (!SHEET_ID) return [];
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error('csv_fetch_failed');
  const csvText = await res.text();
  const parsed = Papa.parse(csvText, { skipEmptyLines: true });
  return buildRowMap(parsed.data || []);
};

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/sheet-map', async (req, res) => {
  try {
    const rows = await fetchSheetRows();
    res.json({ ok: true, rows, updatedAt: new Date().toISOString() });
  } catch (e) {
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
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!B${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[value]] }
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'sheet_write_failed' });
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
    sheetsClient = initSheetsClient();
    app.listen(PORT, () => {
      console.log(`Local DB server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to init DB', err);
    process.exit(1);
  });
