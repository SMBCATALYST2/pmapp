/**
 * Next.js middleware for route protection.
 * Uses getToken from next-auth/jwt to avoid importing the full auth() (which requires Prisma/Node.js).
 * This keeps the middleware compatible with Edge Runtime.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that don't require authentication
const publicRoutes = new Set([
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
]);

// Path prefixes that are always public
const publicPrefixes = ["/api/auth", "/api/health", "/invite/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicRoute =
    publicRoutes.has(pathname) ||
    publicPrefixes.some((prefix) => pathname.startsWith(prefix));

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuthenticated = !!token;

  // If the user is not authenticated and the route is protected, redirect to sign-in
  if (!isAuthenticated && !isPublicRoute) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // If the user is authenticated and tries to access auth pages, redirect to home
  if (isAuthenticated && publicRoutes.has(pathname)) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files, images, and Next.js internals
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
