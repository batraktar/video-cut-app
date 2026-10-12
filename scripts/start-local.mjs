import { spawn } from 'node:child_process';
import http from 'node:http';
import process from 'node:process';
import { getStartupPlan } from './startupPlan.js';

const APP_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:7071/health';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const isUrlReady = url =>
  new Promise(resolve => {
    const request = http.get(url, response => {
      response.resume();
      resolve((response.statusCode ?? 500) < 500);
    });
    request.setTimeout(1_000, () => request.destroy());
    request.on('error', () => resolve(false));
  });

const waitForUrl = (url, timeoutMs) =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      const request = http.get(url, response => {
        response.resume();
        if ((response.statusCode ?? 500) < 500) {
          resolve();
          return;
        }
        retry();
      });
      request.setTimeout(1_000, () => request.destroy());
      request.on('error', retry);
    };

    const retry = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Не вдалося запустити ${url}`));
        return;
      }
      setTimeout(check, 500);
    };

    check();
  });

const openBrowser = url => {
  const command =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  const opener = spawn(command[0], command[1], { detached: true, stdio: 'ignore' });
  opener.unref();
};

const [appAlreadyRunning, apiAlreadyRunning] = await Promise.all([
  isUrlReady(APP_URL),
  isUrlReady(API_URL)
]);

if (appAlreadyRunning && apiAlreadyRunning) {
  console.log(`Редактор уже запущений: ${APP_URL}`);
  if (process.env.VIDEO_CUT_NO_BROWSER !== '1') openBrowser(APP_URL);
  process.exit(0);
}

const { missingServices, runArgs } = getStartupPlan({ appAlreadyRunning, apiAlreadyRunning });

if (missingServices.length === 1) {
  console.log(`Редактор частково запущений. Додатково запускаю: ${missingServices[0] === 'api' ? 'локальний сервер' : 'вебредактор'}.`);
}

const child = spawn(npmCommand, runArgs, {
  stdio: 'inherit',
  env: process.env
});
const childExit = new Promise(resolve => child.once('exit', code => resolve(code ?? 1)));

const stop = signal => {
  if (!child.killed) child.kill(signal);
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

try {
  await Promise.race([
    Promise.all([
      ...(!appAlreadyRunning ? [waitForUrl(APP_URL, 30_000)] : []),
      ...(!apiAlreadyRunning ? [waitForUrl(API_URL, 30_000)] : [])
    ]),
    childExit.then(code => {
      throw new Error(`Процес завершився з кодом ${code}`);
    })
  ]);
  console.log(`\nГотово. Відкриваю ${APP_URL}`);
  console.log('Не закривайте це вікно, поки працюєте у редакторі.\n');
  if (process.env.VIDEO_CUT_NO_BROWSER !== '1') openBrowser(APP_URL);
} catch (error) {
  console.error(`\nПомилка запуску: ${error instanceof Error ? error.message : String(error)}`);
  stop('SIGTERM');
  process.exitCode = 1;
}

const exitCode = await childExit;
process.exitCode = exitCode;
