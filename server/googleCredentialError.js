const getGoogleErrorDetails = error => {
  const responseError = error?.response?.data?.error;
  const reasons = Array.isArray(responseError?.errors)
    ? responseError.errors.map(item => String(item?.reason || '').toLowerCase())
    : [];
  return {
    status: Number(error?.response?.status || error?.code || responseError?.code || 0),
    reasons,
    message: String(responseError?.message || error?.message || '').toLowerCase()
  };
};

export const classifyGoogleCredentialError = error => {
  const { status, reasons, message } = getGoogleErrorDetails(error);
  if (reasons.some(reason => ['accessnotconfigured', 'servicedisabled', 'service_disabled'].includes(reason)) ||
      message.includes('has not been used') || message.includes('is disabled')) {
    return 'sheets_api_disabled';
  }
  if (message.includes('invalid_grant') || message.includes('invalid jwt') ||
      message.includes('invalid signature') || status === 401) {
    return 'credentials_key_invalid';
  }
  if (status === 403) return 'sheet_access_denied';
  if (status === 404) return 'spreadsheet_not_found_or_unshared';
  return 'google_validation_failed';
};
