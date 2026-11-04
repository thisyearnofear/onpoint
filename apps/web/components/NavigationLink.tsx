"use client";

import React from "react";
import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

function PendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span className="inline-flex h-3 w-3 items-center justify-center" aria-hidden="true">
      {pending && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
    </span>
  );
}

function PendingStatus({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {pending ? `Opening ${label}…` : ""}
    </span>
  );
}

interface NavigationLinkProps extends React.ComponentProps<typeof Link> {
  label: string;
}

export function NavigationLink({ label, href, ...rest }: NavigationLinkProps) {
  const pathname = usePathname();
  const target = typeof href === "string" ? href : href.pathname || "";
  const targetPath = target.split(/[?#]/)[0] || "/";

  if (targetPath === pathname && target.includes("#")) {
    return (
      <a href={target} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {rest.children}
        <span className="inline-flex h-3 w-3" aria-hidden="true" />
      </a>
    );
  }
  return (
    <Link href={href} {...rest}>
      {rest.children}
      <PendingHint />
      <PendingStatus label={label} />
    </Link>
  );
}
