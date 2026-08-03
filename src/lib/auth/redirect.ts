export function getSafeAuthRedirect(value?: string) {
  if (!value || !/^\/(?!\/)/.test(value)) {
    return "/";
  }

  return value;
}
