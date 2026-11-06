import { OnPointLayout } from "../../components/OnPointLayout";
import { ShareAttributionCapture } from "../../components/ShareAttributionCapture";

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Captures ?sid=/?referral= on every consumer surface — referral
          redirects land here with the code in the query, and artifact shares
          deep-link into the wardrobe. */}
      <ShareAttributionCapture />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>
      <OnPointLayout>{children}</OnPointLayout>
    </>
  );
}
