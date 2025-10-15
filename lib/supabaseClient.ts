import { createClient } from "@supabase/supabase-js";

// ✅ These environment variables must already be set in .env.local (for localhost)
// or in your Vercel project settings (for production)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ✅ Create Supabase client with session persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,          // keeps user logged in across refreshes
    autoRefreshToken: true,        // automatically refreshes expired tokens
    detectSessionInUrl: true,      // detects session from magic link or OAuth callback
  },
});