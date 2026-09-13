const origin = "http://localhost:3000";

export function httpRequest(
  app: { fetch(request: Request): Response | Promise<Response> },
  path: string,
  {
    method = "GET",
    headers = {},
    body,
    cookie,
  }: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    cookie?: string;
  } = {},
) {
  return app.fetch(
    new Request(`${origin}${path}`, {
      method,
      headers: { ...headers, ...(cookie ? { cookie } : {}) },
      ...(body === undefined ? {} : { body }),
    }),
  );
}
