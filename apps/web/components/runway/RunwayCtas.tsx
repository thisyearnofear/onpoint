"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { TextTheJudge } from "./TextTheJudge";
import { runwayCtaOrder } from "../../lib/utils/runway";

const PRIMARY =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-bold text-white shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90";

/** Compact inline QR card — md+ only, rendered below the CTA row. */
function QrCard({ href }: { href: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    import("qrcode")
      .then(({ toDataURL }) =>
        toDataURL(href, { errorCorrectionLevel: "M", margin: 1, width: 96, color: { dark: "#fafafa", light: "#18181b" } }),
      )
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [href]);
  if (!qr) return null;
  return (
    <div className="mt-2 hidden items-center gap-3 border border-border bg-card px-4 py-3 md:flex">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="QR code to text the judge" className="h-24 w-24 border border-border" />
      <p className="text-sm text-muted-foreground">
        On your iPhone?
        <span className="block font-bold text-foreground">Scan to text the judge.</span>
        <span className="mt-1 flex items-center gap-1.5 text-xs">
          <TypingDots /> an AI judge — instant replies, not a person
        </span>
      </p>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 rounded-full bg-muted-foreground"
          style={{ animation: `runway-typing 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </span>
  );
}

/**
 * Adaptive CTAs: iPhone/iPad leads with "Text the judge" (native iMessage);
 * everything else leads with "Play in your browser" + compact QR card below.
 */
export function RunwayCtas({ phoneNumber, themeId }: { phoneNumber?: string; themeId?: string }) {
  const [order, setOrder] = useState<"sms-first" | "web-first" | null>(null);
  useEffect(() => setOrder(runwayCtaOrder(navigator.userAgent)), []);
  const smsBody = `play ${themeId || ""}`.trim();
  const smsHref = `sms:${phoneNumber}?&body=${encodeURIComponent(smsBody)}`;
  const playHref = themeId ? `/runway/play?theme=${themeId}` : "/runway/play";

  // SMS only renders when the API served a live number for today — no
  // number, no dead channel advertised on the page.
  if (!phoneNumber) {
    return (
      <div className="flex flex-col items-start">
        <Link href={playHref} className={PRIMARY}>
          <Play className="h-5 w-5" />
          {themeId ? "Play today’s theme" : "Play in your browser"}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        {order === "sms-first" ? (
          <>
            <TextTheJudge phoneNumber={phoneNumber} body={smsBody} buttonClassName={PRIMARY} showQr={false} />
            <Link href={playHref} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-border px-8 text-base font-bold text-foreground transition-colors hover:bg-muted">
              <Play className="h-5 w-5" />
              {themeId ? "Play today’s theme" : "Play in your browser"}
            </Link>
          </>
        ) : (
          <>
            <Link href={playHref} className={PRIMARY}>
              <Play className="h-5 w-5" />
              {themeId ? "Play today’s theme" : "Play in your browser"}
            </Link>
            <TextTheJudge phoneNumber={phoneNumber} body={smsBody} showQr={false} />
          </>
        )}
      </div>
      {order === "web-first" && <QrCard href={smsHref} />}
    </div>
  );
}
