export default function ConsumerLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <span className="text-sm font-semibold text-muted-foreground">Opening your workspace…</span>
    </div>
  );
}
