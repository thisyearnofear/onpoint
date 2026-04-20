"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect } from "react";
import { Button } from "@repo/ui/button";
import { LogIn, LogOut, User } from "lucide-react";

export function Auth0LoginButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full"
      asChild
    >
      <a href="/auth/login">
        <LogIn className="w-4 h-4 mr-1.5" />
        Sign In
      </a>
    </Button>
  );
}

export function Auth0LogoutButton() {
  return (
    <Button variant="ghost" size="sm" className="rounded-full" asChild>
      <a href="/auth/logout">
        <LogOut className="w-4 h-4 mr-1.5" />
        Sign Out
      </a>
    </Button>
  );
}

/** Compact header button — shows avatar when signed in, Sign In when not */
export function Auth0HeaderButton() {
  const { user, isLoading } = useUser();

  // Identify user in PostHog + send welcome email on first sign-in
  useEffect(() => {
    if (user?.sub) {
      import("posthog-js").then((ph) => {
        if (ph.default.__loaded) {
          ph.default.identify(user.sub!, {
            email: user.email,
            name: user.name,
          });
        }
      }).catch(() => {});

      // Fire-and-forget welcome email (idempotent)
      fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});
    }
  }, [user?.sub]);

  if (isLoading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="rounded-full gap-2" asChild>
          <a href="/auth/logout">
            {user.picture ? (
              <img
                src={user.picture}
                alt=""
                className="w-5 h-5 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-4 h-4" />
            )}
            <span className="hidden sm:inline text-sm">
              {user.name || user.email}
            </span>
          </a>
        </Button>
      </div>
    );
  }

  return <Auth0LoginButton />;
}

export function Auth0Profile() {
  const { user, isLoading } = useUser();

  if (isLoading)
    return <div className="animate-pulse h-8 bg-gray-200 rounded"></div>;
  if (!user) return null;

  return (
    <div className="flex items-center space-x-3">
      {user.picture && (
        <img
          src={user.picture}
          alt={user.name || "User"}
          className="w-8 h-8 rounded-full"
          referrerPolicy="no-referrer"
        />
      )}
      <div>
        <p className="font-medium">{user.name}</p>
        <p className="text-sm text-gray-600">{user.email}</p>
      </div>
    </div>
  );
}
