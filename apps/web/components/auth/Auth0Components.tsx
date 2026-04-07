"use client";

import { useUser } from "@auth0/nextjs-auth0/client";

export function Auth0LoginButton() {
  return (
    <a
      href="/auth/login"
      className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
    >
      Sign in with Auth0
    </a>
  );
}

export function Auth0LogoutButton() {
  return (
    <a
      href="/auth/logout"
      className="inline-flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
    >
      Sign out
    </a>
  );
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
