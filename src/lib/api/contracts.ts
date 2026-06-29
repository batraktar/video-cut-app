export type AdminConfig = {
  baseDir: string;
  shell: string;
  aiModelPath: string;
  aiPythonPath: string;
  aiFps: number;
  aiMinDuration: number;
  logoTemplatePath: string;
  logoFps: number;
  logoSize: number;
  logoThreshold: number;
  logoMinDuration: number;
  logoMaxMatches: number;
  logoMaxGap: number;
  logoScales: string;
  clipchampDriveRemote: string;
  clipchampDriveFolderId: string;
  clipchampFolderPrefix: string;
  sheetId: string;
  sheetGid: string;
  sheetName: string;
  sheetRange: string;
};

export type ApiOk<T> = { ok: true } & T;
export type ApiErr = { ok: false; error: string };
export type ApiResult<T> = ApiOk<T> | ApiErr;

export type VideoFile = {
  name: string;
  relativePath: string;
  size: number;
  mtimeMs: number;
  type: string;
};

export type SheetRow = {
  rowIndex: number;
  link: string;
  fileName: string;
  analogDigital: string;
  status: string;
  cameraType: string;
  labels: string;
};

export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'canceled';

export type Job = {
  id: string;
  status: JobStatus;
  command: string;
  log: string;
  exitCode: number | null;
  createdAt: string;
  updatedAt: string;
};
