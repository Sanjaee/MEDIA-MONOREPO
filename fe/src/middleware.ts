import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // NextAuth automatically handles CSRF protection for its own routes natively.
  // There is no need to manually validate CSRF tokens on /api/auth routes,
  // as it interferes with NextAuth's built-in token submission.

  return response;
}

export const config = {
  matcher: [
    "/api/auth/:path*",
  ],
};
