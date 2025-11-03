import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./mobile.css";
import { Providers } from "./providers";
import '@rainbow-me/rainbowkit/styles.css';

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "BeOnPoint - AI Fashion Studio",
  description: "Multiplatform ecosystem for personalized fashion discovery & digital ownership",
  viewport: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = process.env.NEXT_PUBLIC_URL ?? "";
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
    <html lang="en">
      <head>
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
