import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth/access";

const handlers = toNextJsHandler(auth.handler);

async function handleAdminRequest(
  request: Request,
  handler: typeof handlers.GET,
) {
  if (new URL(request.url).pathname.startsWith("/api/auth/admin/")) {
    const user = await getCurrentUser({ headers: request.headers });

    if (user?.roles.includes("admin") && !user.emailVerified) {
      return Response.json(
        { message: "Email verification required" },
        { status: 403 },
      );
    }
  }

  return handler(request);
}

export function GET(request: Request) {
  return handleAdminRequest(request, handlers.GET);
}

export function POST(request: Request) {
  return handleAdminRequest(request, handlers.POST);
}
