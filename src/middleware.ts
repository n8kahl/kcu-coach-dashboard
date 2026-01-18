import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/auth', '/api/health', '/api/economic'];

// Check if a path is public (doesn't require auth)
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => pathname.startsWith(route));
}

// Verify JWT token - must use same secret as jwt.ts (SESSION_SECRET)
async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      // In development, use the same default as jwt.ts
      if (process.env.NODE_ENV === 'development') {
        const devSecret = new TextEncoder().encode('development-secret-key-change-in-production-32chars');
        await jwtVerify(token, devSecret);
        return true;
      }
      console.error('SESSION_SECRET environment variable is required');
      return false;
    }

    if (secret.length < 32) {
      console.error('SESSION_SECRET must be at least 32 characters');
      return false;
    }

    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

// Rate limiting store (in-memory for single server, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration per route pattern
const rateLimitConfig: Record<string, { requests: number; windowMs: number }> = {
  '/api/auth': { requests: 10, windowMs: 60000 }, // 10 requests per minute for auth
  '/api/chat': { requests: 30, windowMs: 60000 }, // 30 requests per minute for chat
  '/api/coach': { requests: 30, windowMs: 60000 }, // 30 requests per minute for coach
  '/api': { requests: 100, windowMs: 60000 }, // 100 requests per minute for other APIs
};

/**
 * Get rate limit config for a path
 */
function getRateLimitConfig(path: string): { requests: number; windowMs: number } {
  for (const [pattern, config] of Object.entries(rateLimitConfig)) {
    if (path.startsWith(pattern)) {
      return config;
    }
  }
  return { requests: 100, windowMs: 60000 };
}

/**
 * Check rate limit for a request
 */
function checkRateLimit(identifier: string, config: { requests: number; windowMs: number }): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
    return { allowed: true, remaining: config.requests - 1, resetTime: now + config.windowMs };
  }

  if (entry.count >= config.requests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  entry.count++;
  return { allowed: true, remaining: config.requests - entry.count, resetTime: entry.resetTime };
}

/**
 * Clean up expired rate limit entries periodically
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.entries());
  for (const [key, entry] of entries) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every minute
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 60000);
}

/**
 * Add security headers to response
 *
 * CSP Notes:
 * - Next.js App Router requires 'unsafe-inline' for styles due to CSS-in-JS
 * - 'unsafe-eval' is needed for development hot reload, but should be removed in production
 * - For stricter CSP, consider implementing nonce-based script loading
 * - See: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  const isDev = process.env.NODE_ENV === 'development';

  // Content Security Policy - stricter in production
  const cspDirectives = [
    "default-src 'self'",
    // Scripts: 'unsafe-eval' only in dev for hot reload
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'", // TODO: Implement nonce-based CSP for stricter policy
    "style-src 'self' 'unsafe-inline'", // Required for CSS-in-JS / Tailwind
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://discord.com https://api.anthropic.com https://cdn.discordapp.com",
    "frame-src 'self' https://www.youtube.com https://player.vimeo.com",
    "media-src 'self' https:",
    "object-src 'none'", // Prevent Flash/plugin exploits
    "base-uri 'self'", // Prevent base tag hijacking
    "form-action 'self'", // Restrict form submissions
    "frame-ancestors 'self'", // Prevent clickjacking (supplement to X-Frame-Options)
    isDev ? '' : "upgrade-insecure-requests", // Force HTTPS in production
  ].filter(Boolean).join('; ');

  response.headers.set('Content-Security-Policy', cspDirectives);

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  return response;
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Use X-Forwarded-For in production (behind proxy), fallback to IP
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';

  // Include path prefix for per-route limiting
  const pathPrefix = request.nextUrl.pathname.split('/').slice(0, 3).join('/');

  return `${ip}:${pathPrefix}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // Static files
  ) {
    return NextResponse.next();
  }

  // Check authentication for protected routes
  if (!isPublicRoute(pathname)) {
    const sessionToken = request.cookies.get('kcu_session')?.value;

    if (!sessionToken) {
      // No session cookie, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify the token is valid
    const isValid = await verifyToken(sessionToken);
    if (!isValid) {
      // Invalid token, clear cookie and redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('kcu_session');
      return response;
    }
  }

  // If user is logged in and tries to access login page, redirect to dashboard
  if (pathname === '/login') {
    const sessionToken = request.cookies.get('kcu_session')?.value;
    if (sessionToken) {
      const isValid = await verifyToken(sessionToken);
      if (isValid) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // Redirect root to dashboard (which will redirect to login if not authenticated)
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api')) {
    const identifier = getClientIdentifier(request);
    const config = getRateLimitConfig(pathname);
    const rateLimitResult = checkRateLimit(identifier, config);

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Please slow down and try again later',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        { status: 429 }
      );

      response.headers.set('Retry-After', String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)));
      response.headers.set('X-RateLimit-Limit', String(config.requests));
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', String(rateLimitResult.resetTime));

      return addSecurityHeaders(response);
    }

    // Continue with rate limit headers
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(config.requests));
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
    response.headers.set('X-RateLimit-Reset', String(rateLimitResult.resetTime));

    return addSecurityHeaders(response);
  }

  // Add security headers to all responses
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
