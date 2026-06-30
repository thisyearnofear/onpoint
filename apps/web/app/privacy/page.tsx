import Link from "next/link";
import type { Metadata } from "next";
import { Palette, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | BeOnPoint",
  description:
    "BeOnPoint privacy policy — how we collect, use, and protect your data. Includes affiliate disclosure, cookie usage, and data handling practices.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1.5 shadow-md">
              <Palette className="h-4 w-4 text-white" />
            </div>
            BeOnPoint
          </Link>
          <Link
            href="/terms"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Terms of Service
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: June 2026</p>
          </div>
        </div>

        <div className="space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-bold text-foreground">1. Information We Collect</h2>
            <p className="mt-2">
              BeOnPoint collects minimal information necessary to provide our AI styling and
              storefront services. This may include:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-1.5">
              <li>Account information (email, name) when you sign in via Auth0</li>
              <li>Style preferences and session data when you use the AI try-on feature</li>
              <li>Photos you upload for virtual try-on (processed temporarily, not stored long-term)</li>
              <li>Usage analytics via PostHog (page views, feature usage, session duration)</li>
              <li>Cookie data as described in Section 3</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">2. How We Use Your Information</h2>
            <ul className="mt-3 list-disc pl-5 space-y-1.5">
              <li>To provide AI-powered fashion analysis and styling recommendations</li>
              <li>To operate and improve curator storefronts and the virtual try-on experience</li>
              <li>To process transactions and facilitate WhatsApp-based checkout</li>
              <li>To send order updates and delivery notifications (with your consent)</li>
              <li>To analyse site usage and improve our services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">3. Cookies &amp; Tracking</h2>
            <p className="mt-2">
              We use essential cookies for authentication and site functionality. We also use
              analytics cookies (PostHog) to understand how visitors use our site. You can
              control cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">4. Affiliate Disclosure</h2>
            <p className="mt-2">
              Some links on BeOnPoint may be affiliate links. If you click an affiliate link
              and make a purchase, we may earn a commission at no additional cost to you.
              We participate in affiliate programs including Skimlinks and ShareASale.
              As an Amazon Associate, we may earn from qualifying purchases.
            </p>
            <p className="mt-3">
              Our style guides and product recommendations are independently written and
              are not influenced by affiliate relationships. We only recommend products
              and curators we believe provide value to our users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">5. Data Sharing</h2>
            <p className="mt-2">
              We do not sell your personal information. We may share data with:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-1.5">
              <li>Auth0 — for authentication and account management</li>
              <li>PostHog — for anonymised analytics</li>
              <li>Cloudflare — for CDN and website security</li>
              <li>Stripe — for payment processing (if applicable)</li>
              <li>Affiliate networks (Skimlinks, ShareASale) — for commission tracking</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">6. Data Retention</h2>
            <p className="mt-2">
              Session data is retained for the duration of your session and anonymised
              after 30 days. Account data is retained until you request deletion.
              Uploaded photos for virtual try-on are processed in memory and not
              persistently stored.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">7. Your Rights</h2>
            <p className="mt-2">
              Depending on your jurisdiction, you may have the right to access, correct,
              or delete your personal data. To exercise these rights, contact us through
              the channels listed in Section 9.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">8. Third-Party Links</h2>
            <p className="mt-2">
              Our site may contain links to third-party websites, including curator
              WhatsApp numbers and external product pages. We are not responsible for
              the privacy practices of these third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">9. Contact</h2>
            <p className="mt-2">
              For privacy-related inquiries, please reach out via the contact information
              available on our About page or through the platforms listed there.
            </p>
          </section>
        </div>
      </article>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1 shadow-md">
              <Palette className="h-3.5 w-3.5 text-white" />
            </div>
            BeOnPoint
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link href="/guides" className="hover:text-foreground transition-colors">Guides</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
          <p className="text-xs">Your privacy matters.</p>
        </div>
      </footer>
    </main>
  );
}
