"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ui } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

function describeAuthError(error: { message: string; status?: number; code?: string }) {
  if (error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message)) {
    return "That email and password don't match an owner account.";
  }
  if (error.code === "email_not_confirmed") {
    return "This account's email address hasn't been confirmed yet. See the README for how to confirm it in Supabase.";
  }
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return "Too many sign-in attempts. Please wait a few minutes and try again.";
  }
  return error.message;
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!email || !password) {
      setError("Enter your email address and password.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(describeAuthError(signInError));
        setPending(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Couldn't reach the sign-in service. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="email" className={ui.label}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={`${ui.input} mt-2`}
        />
      </div>
      <div>
        <label htmlFor="password" className={ui.label}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={`${ui.input} mt-2`}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${ui.buttonPrimary} w-full`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
