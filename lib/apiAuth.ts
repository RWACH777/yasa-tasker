/**
 * apiAuth.ts
 * Shared server-side authentication helper for API routes.
 * Validates the Bearer token from the Authorization header against Supabase.
 */

import { createClient, User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Extracts and validates the Bearer token from the request.
 * Returns the authenticated Supabase User or null if invalid/missing.
 */
export async function getAuthenticatedUser(req: Request): Promise<User | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
}

/** Returns a standard 401 Unauthorized response. */
export function unauthorized(msg = "Unauthorized") {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
