import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import "./mobile.css";
import { Providers } from "./providers";
import '@rainbow-me/rainbowkit/styles.css';
import { auth0 } from "@/lib/auth0";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

const appBaseUrl =
  process.env.NEXT_PUBLIC_URL ||
  process.env.APP_BASE_URL ||
  process.env.AUTH0_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
  "https://onpoint.style";

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  title: "BeOnPoint - AI Fashion Studio",
  description: "Multiplatform ecosystem for personalized fashion discovery & digital ownership",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth0.getSession();
  const user = session?.user;
  const baseUrl = appBaseUrl;
  const embed = {
    version: "1",
    imageUrl: `${baseUrl}/assets/1Product.png`,
    button: {
      title: "Start BeOnPoint",
      action: {
        type: "launch_frame",
        name: "BeOnPoint",
        url: baseUrl || undefined,
        splashImageUrl: `${baseUrl}/assets/1Product.png`,
        splashBackgroundColor: "#0F0F13",
      },
    },
  };
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const storageKey = 'onpoint-theme';
    const stored = localStorage.getItem(storageKey);
    const resolved = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', resolved === 'dark');

    // Adaptive performance: detect low-end devices
    // Check for low memory, low CPU cores, or small viewport + reduced motion
    const deviceMemory = navigator.deviceMemory;
    const isLowEnd = (
      deviceMemory !== undefined && deviceMemory <= 4 ||
      navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.matchMedia('(prefers-reduced-data: reduce)').matches
    );
    if (isLowEnd) {
      document.documentElement.classList.add('low-end-device');
    }
  } catch {}
})();`,
          }}
        />
        {/* PWA manifest for installable app */}
        <link rel="manifest" href="/manifest.json" />
        {/* Talent App project verification for Proof of Ship */}
        <meta name="talentapp:project_verification" content="9ab8365123e2b2e45a707fb428501d3926a635b801d5921735e29fe97c149af1862bfc4c2c9bbb2121c2230dd9d81aae9fd8eeecab6b2221cb535567329e0591" />
        {/* Farcaster Mini App embed for discovery in casts */}
        <meta name="fc:miniapp" content={JSON.stringify(embed)} />
        {/* Backward compatibility with legacy Frames */}
        <meta name="fc:frame" content={JSON.stringify(embed)} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers user={user}>
          {children}
        </Providers>
        <Script
          src="https://s.skimresources.com/js/304047X1792196.skimlinks.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
