

export default function CuratorStorefrontLoading() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-7 w-28 animate-pulse rounded-full bg-muted" />
            <div className="h-7 w-36 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      </header>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1fr_360px] md:py-14">
          <div className="space-y-6">
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 w-20 animate-pulse rounded-full bg-muted" />
              ))}
            </div>
            <div className="space-y-4">
              <div className="h-14 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-6 w-full animate-pulse rounded bg-muted" />
            </div>
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-5 w-32 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
          <aside className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="space-y-4">
              <div className="h-16 w-16 animate-pulse rounded-lg bg-muted" />
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-16 w-full animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="aspect-[4/3] animate-pulse bg-muted" />
              <div className="space-y-3 p-4">
                <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                <div className="flex gap-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-6 w-16 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                <div className="flex gap-2">
                  <div className="h-11 flex-1 animate-pulse rounded-md bg-muted" />
                  <div className="h-11 flex-1 animate-pulse rounded-md bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
