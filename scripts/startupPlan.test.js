import { describe, expect, it } from 'vitest';
import { getStartupPlan } from './startupPlan.js';

describe('local startup plan', () => {
  it('starts only the API when the editor is already running', () => {
    expect(getStartupPlan({ appAlreadyRunning: true, apiAlreadyRunning: false })).toEqual({
      missingServices: ['api'],
      runArgs: ['run', 'server']
    });
  });

  it('starts only the editor when the API is already running', () => {
    expect(getStartupPlan({ appAlreadyRunning: false, apiAlreadyRunning: true })).toEqual({
      missingServices: ['web'],
      runArgs: ['run', 'dev']
    });
  });

  it('starts both services when neither is running', () => {
    expect(getStartupPlan({ appAlreadyRunning: false, apiAlreadyRunning: false })).toEqual({
      missingServices: ['web', 'api'],
      runArgs: ['run', 'dev:all']
    });
  });
});
