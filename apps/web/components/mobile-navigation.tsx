"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { CTA_SHOP } from "../lib/brand";
import { PRIMARY_NAV, SECONDARY_NAV, isNavActive } from "../lib/navigation";
import { NavigationLink } from "./NavigationLink";

const itemCls =
  "flex min-h-[44px] items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-foreground hover:bg-muted/60 active:bg-muted transition-colors";

/**
 * Mobile-only hamburger menu. Rendered inside the mobile header in
 * OnPointHeader (hidden on lg+ via the header's own `lg:hidden` wrapper).
 * Opens a native <dialog> portaled to <body> so it is not clipped by the
 * header's containing block; mirrors the shared desktop nav model.
 */
export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname() || "/";
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const close = () => setOpen(false);
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-dialog"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 active:scale-[0.98] transition-[background-color,transform]"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mounted &&
        createPortal(
          <dialog
            ref={dialogRef}
            id="mobile-nav-dialog"
            aria-label="Navigation"
            className="fixed left-0 top-14 z-40 m-0 h-[calc(100dvh-56px)] w-full max-w-none overflow-y-auto border-0 bg-background p-0 backdrop:bg-black/30"
            onCancel={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            onClose={() => {
              if (open) setOpen(false);
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <nav className="flex flex-col gap-1 p-4" aria-label="Primary mobile">
              {PRIMARY_NAV.map((item) => (
                <NavigationLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  onClick={() => setOpen(false)}
                  aria-current={isNavActive(item.href, pathname) ? "page" : undefined}
                  className={`${itemCls}${isNavActive(item.href, pathname) ? " font-bold underline underline-offset-8 decoration-2 decoration-primary" : ""}`}
                >
                  {item.label}
                </NavigationLink>
              ))}
              <div className="my-2 border-t border-border/60" aria-hidden="true" />
              {SECONDARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`${itemCls} text-muted-foreground`}
                >
                  {item.label}
                </Link>
              ))}
              <Link href={CTA_SHOP.href} onClick={() => setOpen(false)} className={`${itemCls} text-muted-foreground`}>
                Live agent
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`${itemCls} mt-2 justify-center border border-border/60`}
              >
                Close menu
              </button>
            </nav>
          </dialog>,
          document.body,
        )}
    </>
  );
}
