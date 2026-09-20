import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSafeAuthRedirect } from "@/features/auth/redirect";
import { auth } from "@/server/db/services/auth/better-auth";

const authRoutes = new Set(["/login", "/register"]);
const protectedRoutePrefixes = ["/account", "/admin"];

function isProtectedRoute(pathname: string) {
  return protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function redirectTo(pathname: string, request: NextRequest) {
  const redirectURL = new URL(pathname, request.url);

  if (pathname === "/login") {
    const callbackURL = getSafeAuthRedirect(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    redirectURL.searchParams.set("callbackURL", callbackURL);
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
    return redirectTo("/account", request);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/login", "/register"],
};
