import type { ApiResult, AdminConfig, Job, SheetRow, VideoFile } from './contracts';

type RequestOptions = {
  method?: string;
  json?: unknown;
  signal?: AbortSignal;
};

export type ApiClient = ReturnType<typeof createApiClient>;

const joinUrl = (baseUrl: string, path: string) => {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
};

const requestJson = async <T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {}
): Promise<T> => {
  const res = await fetch(joinUrl(baseUrl, path), {
    method: options.method || 'GET',
    headers: options.json ? { 'Content-Type': 'application/json' } : undefined,
    body: options.json ? JSON.stringify(options.json) : undefined,
    signal: options.signal
  });
  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      try {
        payload = await res.text();
      } catch {
        payload = null;
      }
    }
    const err = new Error(`HTTP ${res.status}`);
    // @ts-expect-error attach details for UI error handling
    err.status = res.status;
    // @ts-expect-error attach details for UI error handling
    err.payload = payload;
    throw err;
  }
  return (await res.json()) as T;
};

export const createApiClient = (baseUrl: string) => {
  return {
    baseUrl,

    requestJson: <T>(path: string, options?: RequestOptions) => requestJson<T>(baseUrl, path, options),

    health: () => requestJson<ApiResult<Record<string, unknown>>>(baseUrl, '/health'),

    getConfig: () => requestJson<ApiResult<{ config: AdminConfig }>>(baseUrl, '/config'),
    saveConfig: (configPatch: Partial<AdminConfig>) =>
      requestJson<ApiResult<{ config: AdminConfig }>>(baseUrl, '/config', {
        method: 'POST',
        json: configPatch
      }),
    pickFolder: (save: boolean) =>
      requestJson<ApiResult<{ path: string; config?: AdminConfig }>>(baseUrl, '/config/pick-folder', {
        method: 'POST',
        json: { save }
      }),

    listFiles: () => requestJson<ApiResult<{ baseDir: string; files: VideoFile[] }>>(baseUrl, '/files'),

    sheetMap: () =>
      requestJson<
        ApiResult<{
          rows: SheetRow[];
          totalRows: number;
          resolvedFromLinksMap: number;
          unresolvedRows: number;
          linksMapPath: string;
          updatedAt: string;
        }>
      >(baseUrl, '/sheet-map'),
    sheetStatus: (rowIndex: number, status: string) =>
      requestJson<ApiResult<Record<string, unknown>>>(baseUrl, '/sheet/status', {
        method: 'POST',
        json: { rowIndex, status }
      }),

    createJob: (command: string) =>
      requestJson<ApiResult<{ id: string }>>(baseUrl, '/jobs', { method: 'POST', json: { command } }),
    listJobs: () => requestJson<ApiResult<{ jobs: Job[] }>>(baseUrl, '/jobs'),
    getJob: (id: string) => requestJson<ApiResult<{ job: Job }>>(baseUrl, `/jobs/${id}`),
    stopJob: (id: string) => requestJson<ApiResult<Record<string, unknown>>>(baseUrl, `/jobs/${id}/stop`, { method: 'POST' }),

    syncSnapshot: (payload: unknown) =>
      requestJson<ApiResult<{ updatedAt: string }>>(baseUrl, '/sync', { method: 'POST', json: payload }),
    getSnapshot: () =>
      requestJson<ApiResult<{ updatedAt: string; payload: unknown }>>(baseUrl, '/snapshot'),

    aiSegments: (payload: unknown) =>
      requestJson<ApiResult<Record<string, unknown>>>(baseUrl, '/ai/segments', { method: 'POST', json: payload }),
    aiLogo: (payload: unknown) =>
      requestJson<ApiResult<Record<string, unknown>>>(baseUrl, '/ai/logo', { method: 'POST', json: payload })
  };
};
