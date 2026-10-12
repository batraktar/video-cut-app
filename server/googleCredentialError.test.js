import { describe, expect, it } from 'vitest';
import { classifyGoogleCredentialError } from './googleCredentialError.js';

describe('Google credential validation errors', () => {
  it('identifies a disabled Sheets API without exposing provider details', () => {
    const error = {
      response: {
        status: 403,
        data: { error: { errors: [{ reason: 'SERVICE_DISABLED' }] } }
      }
    };

    expect(classifyGoogleCredentialError(error)).toBe('sheets_api_disabled');
  });

  it('identifies missing spreadsheet permission', () => {
    expect(classifyGoogleCredentialError({
      response: { status: 403, data: { error: { errors: [{ reason: 'PERMISSION_DENIED' }] } } }
    })).toBe('sheet_access_denied');
  });

  it('identifies a revoked or malformed signing key', () => {
    expect(classifyGoogleCredentialError({ message: 'invalid_grant: Invalid JWT Signature' }))
      .toBe('credentials_key_invalid');
  });

  it('keeps unknown Google failures actionable but generic', () => {
    expect(classifyGoogleCredentialError(new Error('network failure')))
      .toBe('google_validation_failed');
  });
});
