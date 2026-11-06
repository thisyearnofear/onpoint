import { Skeleton } from "@/components/state";
export default function CuratorStorefrontLoading() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* Header skeleton */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Skeleton className="h-4 w-16 rounded bg-muted" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-24 rounded-full bg-muted" />
            <Skeleton className="h-7 w-32 rounded-full bg-muted" />
          </div>
        </div>
      </header>

      {/* Hero section skeleton */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <div className="grid gap-8 md:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full bg-muted" />
                <Skeleton className="h-6 w-24 rounded-full bg-muted" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-10 w-3/4 rounded-lg bg-muted" />
                <Skeleton className="h-10 w-1/2 rounded-lg bg-muted" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-full rounded bg-muted/60" />
                <Skeleton className="h-5 w-5/6 rounded bg-muted/60" />
              </div>
              <div className="flex flex-wrap gap-3">
                <Skeleton className="h-5 w-32 rounded bg-muted" />
                <Skeleton className="h-5 w-28 rounded bg-muted" />
                <Skeleton className="h-5 w-36 rounded bg-muted" />
              </div>
            </div>
            <aside className="pl-5 border-l-2 border-border/30">
              <div className="space-y-4">
                <Skeleton className="h-16 w-16 rounded-lg bg-muted" />
                <Skeleton className="h-5 w-1/2 rounded bg-muted" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full rounded bg-muted/60" />
                  <Skeleton className="h-4 w-full rounded bg-muted/60" />
                  <Skeleton className="h-4 w-3/4 rounded bg-muted/60" />
                </div>
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton
                      key={i} className="h-10 w-full rounded-md bg-muted" />
                  ))}
                </div>
                <Skeleton className="h-12 w-full rounded-md bg-muted" />
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Stats bar skeleton */}
      <section className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="pl-5 border-l-2 border-border/30 space-y-2">
                <Skeleton className="h-3 w-24 rounded bg-muted" />
                <Skeleton className="h-4 w-full rounded bg-muted/60" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Listings skeleton */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-3 w-20 rounded bg-muted" />
          <Skeleton className="h-7 w-64 rounded bg-muted" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-border"
            >
              <Skeleton className="aspect-[4/3] bg-muted" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4 rounded bg-muted" />
                <Skeleton className="h-4 w-1/3 rounded bg-muted/60" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-16 rounded-md bg-muted" />
                  <Skeleton className="h-7 w-16 rounded-md bg-muted" />
                  <Skeleton className="h-7 w-20 rounded-md bg-muted" />
                </div>
                <Skeleton className="h-10 w-full rounded-md bg-muted" />
                <div className="flex gap-2">
                  <Skeleton className="h-12 flex-1 rounded-md bg-muted" />
                  <Skeleton className="h-12 flex-1 rounded-md bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
