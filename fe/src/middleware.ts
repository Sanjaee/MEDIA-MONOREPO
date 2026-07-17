import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  
  // Try checking role property in auth object
  const role = (req.auth?.user as any)?.role || (req.auth?.user as any)?.Role;

  if (isAdminRoute) {
    if (role !== "owner") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // NextAuth automatically handles CSRF protection for its own routes natively.
  // There is no need to manually validate CSRF tokens on /api/auth routes,
  // as it interferes with NextAuth's built-in token submission.
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/api/auth/:path*",
    "/admin/:path*",
  ],
};
