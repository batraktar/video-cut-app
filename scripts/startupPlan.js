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
