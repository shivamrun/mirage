const appPathBase = "http://localhost";

export function getSafeAuthRedirect(value?: string) {
  if (!value || !/^\/(?!\/)/.test(value)) {
    return "/";
  }

  try {
    const url = new URL(value, appPathBase);

    if (url.origin !== appPathBase) {
      return "/";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function getLoginRedirectPath(callbackURL?: string) {
  return `/login?${new URLSearchParams({
    callbackURL: getSafeAuthRedirect(callbackURL),
  })}`;
}
