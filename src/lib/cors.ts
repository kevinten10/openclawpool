import { NextRequest, NextResponse } from "next/server";

// Allowed origins from environment or defaults
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:3000",
  "https://openclawpool.vercel.app",
  "https://openclawpool.com",
];

// CORS headers configuration
export const CORS_HEADERS = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": [
    "Authorization",
    "Content-Type",
    "X-Requested-With",
    "Accept",
    "Origin",
    "X-API-Key",
  ].join(", "),
  "Access-Control-Expose-Headers": [
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
    "Retry-After",
  ].join(", "),
};

// Security headers
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // Allow requests without origin (e.g., curl, server-to-server)
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowedOrigin = isOriginAllowed(origin) ? origin || "*" : ALLOWED_ORIGINS[0];

  return {
    ...CORS_HEADERS,
    "Access-Control-Allow-Origin": allowedOrigin,
  };
}

/**
 * Handle CORS preflight (OPTIONS) request
 */
export function handleCorsPreflight(request: NextRequest): NextResponse {
  const headers = getCorsHeaders(request);
  
  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

/**
 * Apply CORS and security headers to a response
 */
export function applyCorsHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const corsHeaders = getCorsHeaders(request);
  
  // Apply CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Apply security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * CORS middleware wrapper for API routes
 * Usage: export const GET = withCors(async (request) => { ... })
 */
export function withCors<T extends (request: NextRequest) => Promise<NextResponse>>(
  handler: T
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Handle preflight
    if (request.method === "OPTIONS") {
      return handleCorsPreflight(request);
    }

    // Check origin for non-preflight requests
    const origin = request.headers.get("origin");
    if (origin && !isOriginAllowed(origin)) {
      return new NextResponse(
        JSON.stringify({ error: "Origin not allowed" }),
        { 
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Call handler
    const response = await handler(request);
    
    // Apply CORS and security headers
    return applyCorsHeaders(response, request);
  };
}
