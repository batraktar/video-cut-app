import { createApiClient } from './client';

export const createAdminApi = (baseUrl: string) => {
  const client = createApiClient(baseUrl);
  return {
    requestJson: client.requestJson,

    ping: client.health,

    getConfig: client.getConfig,
    saveConfig: client.saveConfig,
    pickFolder: client.pickFolder,

    listFiles: client.listFiles,

    sheetMap: client.sheetMap,
    sheetStatus: client.sheetStatus,

    createJob: client.createJob,
    listJobs: client.listJobs,
    getJob: client.getJob,
    stopJob: client.stopJob,

    syncSnapshot: client.syncSnapshot,
    getSnapshot: client.getSnapshot,

    aiSegments: client.aiSegments,
    aiLogo: client.aiLogo
  };
};

