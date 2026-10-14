export const getStartupPlan = ({ appAlreadyRunning, apiAlreadyRunning }) => {
  const missingServices = [
    ...(!appAlreadyRunning ? ['web'] : []),
    ...(!apiAlreadyRunning ? ['api'] : [])
  ];

  const runArgs =
    missingServices.length === 2
      ? ['run', 'dev:all']
      : missingServices[0] === 'web'
        ? ['run', 'dev']
        : ['run', 'server'];

  return { missingServices, runArgs };
};

export const getNpmInvocation = ({ platform, runArgs, comSpec = 'cmd.exe' }) =>
  platform === 'win32'
    ? { command: comSpec, args: ['/d', '/c', `npm.cmd ${runArgs.join(' ')}`] }
    : { command: 'npm', args: runArgs };
