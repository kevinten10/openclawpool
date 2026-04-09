import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, isOriginAllowed, SECURITY_HEADERS } from "@/lib/cors";

// Paths that don't require rate limiting
const PUBLIC_PATHS = [
  "/api/health",
  "/_next",
  "/static",
  "/favicon.ico",
];

// Check if path is public
function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    const headers = getCorsHeaders(request);
    return new NextResponse(null, { status: 204, headers });
  }

  // Check origin for API routes
  if (pathname.startsWith("/api/") && origin && !isOriginAllowed(origin)) {
    return new NextResponse(
      JSON.stringify({ error: "Origin not allowed" }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(request),
        },
      }
    );
  }

  // Continue to handler
  const response = NextResponse.next();

  // Apply CORS headers to API routes
  if (pathname.startsWith("/api/")) {
    const corsHeaders = getCorsHeaders(request);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  // Apply security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

// Configure middleware matcher
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
