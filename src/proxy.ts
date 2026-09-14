import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Public pages never need a login session, so the proxy only runs for /admin.
  matcher: ["/admin/:path*"],
};
