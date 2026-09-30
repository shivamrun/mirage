import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/features/auth/better-auth/server";
import { getSafeAuthRedirect } from "@/features/auth/redirect";

const authRoutes = new Set(["/login", "/register"]);
const protectedRoutePrefixes = ["/account", "/admin"];
const inviteAcceptPath = "/invite/accept";

function isProtectedRoute(pathname: string) {
  return protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function redirectTo(
  pathname: string,
  request: NextRequest,
  callbackURL?: string,
) {
  const redirectURL = new URL(pathname, request.url);

  if (pathname === "/login") {
    const safeCallbackURL = getSafeAuthRedirect(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    redirectURL.searchParams.set("callbackURL", safeCallbackURL);
  }

  if (callbackURL) {
    return NextResponse.redirect(
      new URL(getSafeAuthRedirect(callbackURL), request.url),
    );
  }

  return NextResponse.redirect(redirectURL);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-mirage-current-path",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (isProtectedRoute(pathname) && !session) {
    return redirectTo("/login", request);
  }

  if (authRoutes.has(pathname) && session) {
    return redirectTo(
      "/account",
      request,
      request.nextUrl.searchParams.get("callbackURL") ?? undefined,
    );
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (pathname === inviteAcceptPath) {
    response.headers.set("referrer-policy", "no-referrer");
    response.headers.set("cache-control", "no-store");
  }

  return response;
}

export const config = {
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/invite/accept",
    "/login",
    "/register",
  ],
};
