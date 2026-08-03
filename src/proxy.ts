import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

const authRoutes = new Set(["/login", "/register"]);

function redirectTo(pathname: string, request: NextRequest) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (pathname.startsWith("/account") && !session) {
    return redirectTo("/login", request);
  }

  if (authRoutes.has(pathname) && session) {
    return redirectTo("/", request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/login", "/register"],
};
