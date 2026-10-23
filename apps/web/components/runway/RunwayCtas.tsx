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
    <div className="mt-2 hidden items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 md:flex">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="QR code to text the judge" className="h-24 w-24 rounded-lg border border-zinc-800" />
      <p className="text-sm text-zinc-400">
        On your iPhone?
        <span className="block font-bold text-zinc-200">Scan to text the judge.</span>
      </p>
    </div>
  );
}

/**
 * Adaptive CTAs: iPhone/iPad leads with "Text the judge" (native iMessage);
 * everything else leads with "Play in your browser" + compact QR card below.
 */
export function RunwayCtas({ phoneNumber, themeId }: { phoneNumber: string; themeId?: string }) {
  const [order, setOrder] = useState<"sms-first" | "web-first" | null>(null);
  useEffect(() => setOrder(runwayCtaOrder(navigator.userAgent)), []);
  const smsBody = `play ${themeId || ""}`.trim();
  const smsHref = `sms:${phoneNumber}?&body=${encodeURIComponent(smsBody)}`;
  const playHref = themeId ? `/runway/play?theme=${themeId}` : "/runway/play";

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        {order === "sms-first" ? (
          <>
            <TextTheJudge phoneNumber={phoneNumber} body={smsBody} buttonClassName={PRIMARY} showQr={false} />
            <Link href={playHref} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-zinc-700 px-8 text-base font-bold text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-900">
              <Play className="h-5 w-5" />
              {themeId ? "Play today&rsquo;s theme" : "Play in your browser"}
            </Link>
          </>
        ) : (
          <>
            <Link href={playHref} className={PRIMARY}>
              <Play className="h-5 w-5" />
              {themeId ? "Play today&rsquo;s theme" : "Play in your browser"}
            </Link>
            <TextTheJudge phoneNumber={phoneNumber} body={smsBody} showQr={false} />
          </>
        )}
      </div>
      {order === "web-first" && <QrCard href={smsHref} />}
    </div>
  );
}
