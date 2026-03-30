import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-side client with service role for API routes
// Lazily initialized so tests that don't use Supabase can import without env vars
let _supabase: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error(
          "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
        );
      }
      _supabase = createClient(supabaseUrl, supabaseServiceKey);
    }
    return (_supabase as unknown as Record<string | symbol, unknown>)[prop];
  },
});
