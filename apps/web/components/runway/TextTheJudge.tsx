"use client";

import React, { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

/**
 * "Text the judge" — sms: link to the Linq line with a prefilled command,
 * plus a locally generated QR on md+ (same qrcode usage as
 * LinqMissionHandoff).
 */
export function TextTheJudge({
  phoneNumber,
  body,
  className = "",
  buttonClassName = "",
  showQr = true,
}: {
  phoneNumber: string;
  body: string;
  className?: string;
  buttonClassName?: string;
  showQr?: boolean;
}) {
  const href = `sms:${phoneNumber}?&body=${encodeURIComponent(body)}`;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!showQr) return;
    let active = true;
    import("qrcode")
      .then(({ toDataURL }) =>
        toDataURL(href, { errorCorrectionLevel: "M", margin: 1, width: 160, color: { dark: "#fafafa", light: "#18181b" } }),
      )
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [href, showQr]);

  return (
    <div className={className}>
      <a
        href={href}
        className={
          buttonClassName ||
          "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-zinc-700 px-6 text-sm font-bold text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
        }
      >
        <MessageCircle className="h-4 w-4" />
        Text the judge
      </a>
      {showQr && qrDataUrl && (
        <div className="mt-4 hidden flex-col items-center gap-2 md:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR code to text the judge`} className="h-40 w-40 rounded-xl border border-zinc-800" />
          <p className="text-xs text-zinc-500">Scan to text the judge</p>
        </div>
      )}
    </div>
  );
}
