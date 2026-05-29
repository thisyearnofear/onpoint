import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminSidebar, AdminMobileTabs } from "./AdminNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to OnPoint
            </Link>
            <span className="text-sm font-bold tracking-tight">Admin</span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <AdminSidebar />
        <AdminMobileTabs />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
