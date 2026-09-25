const appPathBase = "http://localhost";
const defaultAuthRedirect = "/";

export function getSafeAuthRedirect(value?: string) {
  if (!value || !/^\/(?!\/)/.test(value)) {
    return defaultAuthRedirect;
  }

  try {
    const url = new URL(value, appPathBase);

    if (url.origin !== appPathBase) {
      return defaultAuthRedirect;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return defaultAuthRedirect;
  }
}

export function getLoginRedirectPath(callbackURL?: string) {
  return `/login?${new URLSearchParams({
    callbackURL: getSafeAuthRedirect(callbackURL),
  })}`;
}
