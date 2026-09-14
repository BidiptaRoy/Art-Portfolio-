import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "@/components/icons";
import { ui } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { getAdminSession } from "@/lib/auth";
import { signOut } from "../actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getAdminSession();
  if (session.status === "admin") redirect("/admin");

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 self-start text-sm text-ink-soft transition hover:text-ink"
      >
        <ArrowLeftIcon /> {siteConfig.name}
      </Link>
      <h1 className="mt-4 font-display text-4xl tracking-tight">Owner sign in</h1>

      <div className="mt-8 rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
        {session.status === "signed-out" && <LoginForm />}

        {session.status === "not-configured" && (
          <Notice title="Supabase isn't connected yet">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>{" "}
            (or to your Vercel environment variables), then restart or redeploy. The README
            walks through it step by step.
          </Notice>
        )}

        {session.status === "not-admin" && (
          <Notice title="This account isn't an owner account" signOutAction>
            You&apos;re signed in{session.email ? ` as ${session.email}` : ""}, but this
            account hasn&apos;t been added as an owner. Follow &ldquo;Create your owner
            account&rdquo; in the README, then sign in again.
          </Notice>
        )}

        {session.status === "setup-incomplete" && (
          <Notice title="The database isn't set up yet" signOutAction>
            You&apos;re signed in, but the site couldn&apos;t check your permissions. Run the
            SQL migration described in the README, then reload this page.
            <span className="mt-2 block text-xs text-ink-faint">Details: {session.detail}</span>
          </Notice>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-ink-soft">
        There is no public sign-up. Owner accounts are created in Supabase.
      </p>
    </main>
  );
}

function Notice({
  title,
  children,
  signOutAction = false,
}: {
  title: string;
  children: React.ReactNode;
  signOutAction?: boolean;
}) {
  return (
    <div>
      <h2 className="font-medium">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</p>
      {signOutAction && (
        <form action={signOut} className="mt-5">
          <button type="submit" className={ui.buttonSecondary}>
            Sign out
          </button>
        </form>
      )}
    </div>
  );
}
