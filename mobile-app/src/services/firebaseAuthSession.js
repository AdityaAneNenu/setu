import { getCurrentUser } from "./authService";
import {
  getStoredAuthToken,
  saveAuthToken,
} from "./authTokenStorage";

const AUTH_ERROR_CODES = new Set([
  "auth/id-token-expired",
  "auth/user-token-expired",
  "auth/invalid-user-token",
  "auth/user-disabled",
  "auth/requires-recent-login",
]);

export class AuthSessionError extends Error {
  constructor(message, { code = "AUTH_REQUIRED", cause = null, status = null } = {}) {
    super(message);
    this.name = "AuthSessionError";
    this.code = code;
    this.cause = cause;
    this.status = status;
  }
}

const normalizeAuthErrorMessage = (error) => {
  const code = String(error?.code || "").trim().toLowerCase();
  if (AUTH_ERROR_CODES.has(code)) {
    return "Session expired, please login again";
  }
  if (code === "auth/network-request-failed") {
    return "Unable to validate your sign-in session. Check internet and retry.";
  }
  return error?.message || "Session expired, please login again";
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getTokenPreview = (token) => {
  const safeToken = String(token || "").trim();
  if (!safeToken) return "<none>";
  if (safeToken.length <= 16) return `${safeToken.slice(0, 4)}...`;
  return `${safeToken.slice(0, 12)}...${safeToken.slice(-8)}`;
};

const waitForCurrentUser = async (timeoutMs = 3000) => {
  const start = Date.now();
  let user = getCurrentUser();
  while (!user && Date.now() - start < timeoutMs) {
    await sleep(100);
    user = getCurrentUser();
  }
  return user;
};

const readTokenFromUser = async (user, forceRefresh) => {
  const token = String(await user.getIdToken(!!forceRefresh)).trim();
  return token || null;
};

const persistTokenBestEffort = async (token) => {
  try {
    await saveAuthToken(token);
  } catch (storageError) {
    console.warn("[auth] Failed to persist Firebase token locally:", storageError?.message || storageError);
  }
};

export const getFirebaseAccessToken = async ({ forceRefresh = false, required = true } = {}) => {
  const user = getCurrentUser() || (required ? await waitForCurrentUser() : getCurrentUser());
  try {
    if (user) {
      let token = await readTokenFromUser(user, forceRefresh);
      if (!token && !forceRefresh) {
        token = await readTokenFromUser(user, true);
      }
      if (token) {
        await persistTokenBestEffort(token);
        return token;
      }
      if (required) {
        throw new AuthSessionError("Session expired, please login again", {
          code: "AUTH_TOKEN_EMPTY",
        });
      }
      console.warn("[auth] Firebase token missing for optional auth request.");
      return null;
    }

    const storedToken = await getStoredAuthToken();
    if (storedToken) {
      return storedToken;
    }

    if (required) {
      throw new AuthSessionError("Session expired, please login again", {
        code: "AUTH_REQUIRED",
      });
    }
    console.warn("[auth] No Firebase user/session for optional auth request.");
    return null;
  } catch (error) {
    if (user && !forceRefresh) {
      try {
        const refreshedToken = await readTokenFromUser(user, true);
        if (refreshedToken) {
          await persistTokenBestEffort(refreshedToken);
          return refreshedToken;
        }
      } catch (refreshError) {
        error = refreshError;
      }
    }
    if (!required) {
      console.warn("[auth] Optional auth token fetch failed:", error?.message || error);
      return null;
    }
    throw new AuthSessionError(normalizeAuthErrorMessage(error), {
      code: String(error?.code || "AUTH_TOKEN_ERROR"),
      cause: error,
    });
  }
};

export const getFirebaseAuthHeaders = async ({
  includeContentType = true,
  forceRefresh = false,
  required = true,
} = {}) => {
  const headers = {};
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  const token = await getFirebaseAccessToken({ forceRefresh, required });
  console.info("[auth-debug] getFirebaseAuthHeaders token state:", {
    required,
    forceRefresh,
    includeContentType,
    tokenExists: Boolean(token),
    tokenPreview: getTokenPreview(token),
  });
  if (!token) {
    if (required) {
      throw new AuthSessionError("Session expired, please login again", {
        code: "AUTH_TOKEN_EMPTY",
      });
    }
    console.warn("[auth] No token returned while building optional auth headers.");
    return headers;
  }
  headers.Authorization = `Bearer ${token}`;
  return headers;
};

export const isAuthDeniedStatus = (statusCode) => {
  const code = Number(statusCode);
  return code === 401;
};
