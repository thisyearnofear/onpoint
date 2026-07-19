import { OnPointHeader, OnPointFooter } from "./OnPointHeader";

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
      {children}
      {footer && <OnPointFooter />}
    </main>
  );
}
