type AuthErrorLike = {
  message?: string;
  code?: string;
};

const authErrorMessages: Record<string, string> = {
  INVALID_TOKEN: "This link is invalid or expired. Request a new one.",
  TOKEN_EXPIRED: "This link has expired. Request a new one.",
};

function getAuthErrorMessage(error: AuthErrorLike | null | undefined) {
  if (error?.code && authErrorMessages[error.code]) {
    return authErrorMessages[error.code];
  }

  return error?.message || "Something went wrong. Please try again.";
}

function getUnexpectedAuthErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    return getAuthErrorMessage(error as AuthErrorLike);
  }

  return "Something went wrong. Check your connection and try again.";
}

export { getAuthErrorMessage, getUnexpectedAuthErrorMessage };
