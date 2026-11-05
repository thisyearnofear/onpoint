import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getBaseUrl } from "@/lib/base-url";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { META_DESCRIPTION, PRODUCT_NAME, TAGLINE } from "@/lib/brand";
import "./globals.css";
import "./mobile.css";
import "./view-transitions.css";
import { Providers } from "./providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

const appBaseUrl = getBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  title: `${PRODUCT_NAME} — ${TAGLINE}`,
  description: META_DESCRIPTION,
  applicationName: PRODUCT_NAME,
  keywords: [
    "AI fashion",
    "virtual try-on",
    "agentic commerce",
    "Prava",
    "payment permissions",
    "fashion agent",
    "WhatsApp fashion",
    "M-Pesa",
    "curator storefront",
    "Celo",
    "x402",
  ],
  authors: [{ name: PRODUCT_NAME }],
  creator: PRODUCT_NAME,
  publisher: PRODUCT_NAME,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: appBaseUrl,
    siteName: PRODUCT_NAME,
    title: `${PRODUCT_NAME} — ${TAGLINE}`,
    description: META_DESCRIPTION,
    images: [
      {
        // Resolved against metadataBase (apps/web/app/opengraph-image.png).
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: `${PRODUCT_NAME} — ${TAGLINE}`,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${PRODUCT_NAME} — ${TAGLINE}`,
    description: META_DESCRIPTION,
    images: ["/opengraph-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0F13" },
  ],
};

// Session is resolved client-side by Auth0Provider (useUser → /auth/profile).
// Awaiting auth0.getSession() here forced every page — including public
// surfaces like /, /looks, /curators — into per-request dynamic rendering.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = appBaseUrl;
  const embed = {
    version: "1",
    imageUrl: `${baseUrl}/opengraph-image.png`,
    button: {
      title: `Start ${PRODUCT_NAME}`,
      action: {
        type: "launch_frame",
        name: PRODUCT_NAME,
        url: baseUrl || undefined,
        splashImageUrl: `${baseUrl}/opengraph-image.png`,
        splashBackgroundColor: "#0F0F13",
      },
    },
  };
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_INIT_SCRIPT,
          }}
        />
        {/* PWA manifest for installable app */}
        <link rel="manifest" href="/manifest.json" />
        {/* Talent App project verification for Proof of Ship */}
        <meta name="talentapp:project_verification" content="9ab8365123e2b2e45a707fb428501d3926a635b801d5921735e29fe97c149af1862bfc4c2c9bbb2121c2230dd9d81aae9fd8eeecab6b2221cb535567329e0591" />
        {/* Google Search Console site verification */}
        <meta name="google-site-verification" content="oyeHqq2d4cjDZkSMquH4YBuoOV3npBoyJNpMN0rM9wU" />
        {/* Farcaster Mini App embed for discovery in casts */}
        <meta name="fc:miniapp" content={JSON.stringify(embed)} />
        {/* Backward compatibility with legacy Frames */}
        <meta name="fc:frame" content={JSON.stringify(embed)} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
