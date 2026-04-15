const MAX_MESSAGE_LENGTH = 280;

const GENERIC_ERROR_PATTERN = /^(error|failed|failure|unknown|exception|null|undefined)$/i;

export const extractErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error.trim();
  if (typeof error.message === 'string') return error.message.trim();
  if (typeof error.error === 'string') return error.error.trim();
  if (typeof error.detail === 'string') return error.detail.trim();
  return '';
};

const isGenericOrTooShort = (message) => {
  if (!message) return true;
  const clean = message.trim();
  if (!clean) return true;
  if (GENERIC_ERROR_PATTERN.test(clean)) return true;
  return clean.split(/\s+/).length < 3;
};

const shortenMessage = (message) => {
  if (!message) return '';
  const clean = String(message).replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_MESSAGE_LENGTH) return clean;
  return `${clean.slice(0, MAX_MESSAGE_LENGTH).trim()}...`;
};

export const formatErrorForDisplay = (error, options = {}) => {
  const {
    fallback = 'Something went wrong. Please try again.',
    action = 'complete this action',
  } = options;

  const rawMessage = extractErrorMessage(error);
  const normalized = rawMessage.toLowerCase();

  let message = fallback;

  if (
    normalized.includes('application not found') ||
    normalized.includes('backend deployment not found')
  ) {
    message = 'The backend service is currently unavailable. Please verify the production API URL and try again in a moment.';
  } else if (
    normalized.includes('network request failed') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('cannot reach backend') ||
    normalized.includes('network error')
  ) {
    message = 'Unable to connect to the server. Check your internet connection and confirm the backend is online.';
  } else if (
    normalized.includes('timed out') ||
    normalized.includes('timeout') ||
    normalized.includes('aborterror') ||
    normalized.includes('aborted')
  ) {
    message = `The request took too long to ${action}. Please retry.`;
  } else if (
    normalized.includes('quota exceeded') ||
    normalized.includes('rate limit') ||
    normalized.includes('http 429') ||
    normalized.includes(' 429 ')
  ) {
    message = 'The AI service is temporarily busy. Please wait a few seconds and try again.';
  } else if (
    normalized.includes('permission denied') ||
    normalized.includes('permission is needed')
  ) {
    message = 'Required permission is missing. Please grant the permission in device settings and try again.';
  } else if (
    normalized.includes('invalid email') ||
    normalized.includes('invalid email or password') ||
    normalized.includes('wrong-password') ||
    normalized.includes('invalid-credential')
  ) {
    message = 'The email or password is incorrect. Please verify your credentials and try again.';
  } else if (!isGenericOrTooShort(rawMessage)) {
    message = rawMessage;
  }

  const safeMessage = shortenMessage(message);
  return {
    message: safeMessage || fallback,
    rawMessage,
  };
};
