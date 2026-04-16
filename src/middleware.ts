import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

export async function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get("user-agent") || "";
  const isHeadlessBuild = userAgent.includes("HeadlessChrome");

  // Define public routes
  const publicRoutes = [
    "/auth",
    "/api/auth/session",
    "/api/auth/verify-captcha",
    "/api/auth/forgot-password",
  ];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  let isAuthenticated = false;

  if (session) {
    try {
      await adminAuth.verifySessionCookie(session, true);
      isAuthenticated = true;
    } catch {
      const response = NextResponse.redirect(new URL("/auth", request.url));
      response.cookies.delete("session");
      return response;
    }
  }

  // 1. If user is authenticated and tries to access /auth, redirect to home
  if (isAuthenticated && pathname === "/auth") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 2. If user is NOT authenticated and tries to access protected route, redirect to /auth
  if (!isAuthenticated && !isPublicRoute && pathname !== "/") {
    // Allow the root path for now or redirect specifically
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  // Special case for root path: if not authenticated, redirect to /auth
  if (!isAuthenticated && pathname === "/") {
    // Let Boneyard's headless Chromium snapshot the public home shell without auth.
    if (isHeadlessBuild) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - any file with an extension (public assets like .svg, .png, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};

export const runtime = "nodejs";
