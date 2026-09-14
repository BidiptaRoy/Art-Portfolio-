import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/** Supabase client for the browser. Used only for signing in. */
export function createClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error("Supabase is not configured.");
  }
  return createBrowserClient(env.url, env.publishableKey);
}
