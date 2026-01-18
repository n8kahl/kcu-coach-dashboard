/**
 * Server-side Supabase client for API routes and server components
 *
 * Uses @supabase/auth-helpers-nextjs for authenticated access
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * Create a Supabase client for use in API route handlers
 * This client can access the authenticated user's session via cookies
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createRouteHandlerClient({ cookies: () => cookieStore });
}

/**
 * Create a Supabase client for server components
 * Re-exports the route handler client for consistency
 */
export { createClient as createServerClient };
