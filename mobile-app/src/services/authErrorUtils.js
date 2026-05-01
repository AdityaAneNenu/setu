export const getErrorStatusCode = (error) => {
  const directStatus = Number(error?.status);
  if (Number.isFinite(directStatus) && directStatus > 0) {
    return directStatus;
  }

  const causeStatus = Number(error?.cause?.status);
  if (Number.isFinite(causeStatus) && causeStatus > 0) {
    return causeStatus;
  }

  return null;
};

export const isFinalAuthFailure = (error) => getErrorStatusCode(error) === 401;

export const isPermissionDeniedError = (error) => getErrorStatusCode(error) === 403;

export const getStatusCodeMessage = (
  error,
  {
    forbiddenMessage = "Not authorized to perform this action.",
    validationMessage = "Please check the submitted details and try again.",
    serverMessage = "Server error. Please try again in a moment.",
  } = {},
) => {
  const status = getErrorStatusCode(error);
  if (status === 403) {
    return forbiddenMessage;
  }
  if (status === 400) {
    return validationMessage;
  }
  if (status >= 500) {
    return serverMessage;
  }
  return null;
};

export const logApiErrorStatus = (scope, error) => {
  console.info("[auth-debug] API error status:", {
    scope,
    status: getErrorStatusCode(error),
    code: error?.code || null,
    name: error?.name || null,
    message: error?.message || null,
  });
};

