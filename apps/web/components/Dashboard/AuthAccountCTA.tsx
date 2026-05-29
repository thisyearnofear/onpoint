"use client";

import { useUser } from "@auth0/nextjs-auth0/client";

export function AuthAccountCTA() {
  const { user, isLoading } = useUser();
  if (isLoading || user) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <a href="/auth/login" className="underline underline-offset-2 text-primary">
        Sign in
      </a>{" "}
      to save looks, track orders, and connect external accounts.
    </p>
  );
}
