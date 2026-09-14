import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Client for public pages. It never reads cookies, so it always acts as an
 * anonymous visitor and can only see published designs, even when the owner
 * is signed in.
 */
export function createPublicClient() {
  const env = getSupabaseEnv();
  if (!env) return null;

  return createClient(env.url, env.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
