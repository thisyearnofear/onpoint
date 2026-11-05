import { OnPointHeader, OnPointFooter } from "./OnPointHeader";
import { CartMount } from "./Shop/CartMount";

interface OnPointLayoutProps {
  children: React.ReactNode;
  /** Show the footer (default: true) */
  footer?: boolean;
  /** Additional className for the main wrapper */
  className?: string;
}

/**
 * Shared page shell — OnPointHeader + main content + OnPointFooter.
 *
 * Usage in a server component:
 *   import { OnPointLayout } from "@/components/OnPointLayout";
 *   export default function Page() {
 *     return (
 *       <OnPointLayout>
 *         {/* page content *\/}
 *       </OnPointLayout>
 *     );
 *   }
 *
 * Usage with footer disabled:
 *   <OnPointLayout footer={false}>
 */
export function OnPointLayout({ children, footer = true, className }: OnPointLayoutProps) {
  return (
    <main
      className={`min-h-screen bg-background text-foreground selection:bg-primary/30${
        className ? ` ${className}` : ""
      }`}
    >
      <OnPointHeader />
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
      {footer && <OnPointFooter />}
      <CartMount />
    </main>
  );
}
