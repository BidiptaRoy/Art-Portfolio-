export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

/**
 * Reads the public Supabase settings. Returns null until real values are set,
 * so the site can show setup guidance instead of crashing.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  // Written out in full so Next.js can include them in browser code.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) return null;
  if (url.includes("your-project-ref") || publishableKey.includes("your-publishable-key")) {
    return null;
  }
  try {
    new URL(url);
  } catch {
    return null;
  }
  return { url: url.replace(/\/+$/, ""), publishableKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}
