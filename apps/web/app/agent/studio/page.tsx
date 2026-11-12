import { OnPointLayout } from "@/components/OnPointLayout";
import { StudioLoader } from "@/components/studio/StudioLoader";

export default function AgentStudioPage() {
  return (
    <OnPointLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <p className="text-xs uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          Agent commerce · Studio
        </p>
        <h1 className="font-display text-2xl">Ask the ledger</h1>
        <p className="mt-1 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
          Every paid try-on, listing and signed receipt — explorable. The
          assistant is the same metered AI that reads fit on /pay, driving
          this dashboard through AG Studio&apos;s Agent Framework.
        </p>
        <div className="mt-4">
          <StudioLoader />
        </div>
      </div>
    </OnPointLayout>
  );
}
