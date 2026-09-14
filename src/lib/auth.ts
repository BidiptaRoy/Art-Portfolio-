import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient, type ServerClient } from "@/lib/supabase/server";

export type AdminSession =
  | { status: "not-configured" }
  | { status: "signed-out" }
  | { status: "setup-incomplete"; email: string | null; detail: string }
  | { status: "not-admin"; email: string | null }
  | {
      status: "admin";
      supabase: ServerClient;
      userId: string;
      email: string | null;
    };

/**
 * Works out who is making the request. The signed-in user must also be listed
 * in the public.admins table; being signed in is not enough.
 */
export async function getAdminSession(): Promise<AdminSession> {
  // Always decide at request time; never bake a login state into a static page.
  await connection();
  if (!isSupabaseConfigured()) return { status: "not-configured" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return { status: "signed-out" };

  const email = typeof claims.email === "string" ? claims.email : null;

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) {
    return { status: "setup-incomplete", email, detail: adminError.message };
  }
  if (isAdmin !== true) return { status: "not-admin", email };

  return { status: "admin", supabase, userId: claims.sub, email };
}

/** For admin pages: returns the owner's session, or sends the visitor to the login page. */
export async function requireAdminPage() {
  const session = await getAdminSession();
  if (session.status !== "admin") redirect("/admin/login");
  return session;
}
