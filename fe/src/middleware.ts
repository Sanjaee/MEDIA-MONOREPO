import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Apply CSRF validation only for non-GET NextAuth routes
  if (
    request.nextUrl.pathname.startsWith("/api/auth") &&
    request.method !== "GET"
  ) {
    const csrfToken = request.headers.get("x-csrf-token");
    if (!csrfToken) {
      return NextResponse.json(
        { error: "CSRF token missing" },
        { status: 403 }
      );
    }
    
    const storedCsrfToken = request.cookies.get("csrf_token")?.value;
    if (storedCsrfToken !== csrfToken) {
      return NextResponse.json(
        { error: "Invalid CSRF token" },
        { status: 403 }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/api/auth/:path*",
  ],
};
