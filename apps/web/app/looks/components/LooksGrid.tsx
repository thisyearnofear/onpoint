import { LookCard, type LookCardData } from "../../../components/LookCard";

interface LooksGridProps {
  looks: LookCardData[];
}

export function LooksGrid({ looks }: LooksGridProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {looks.map((look) => (
        <LookCard key={look.id} look={look} />
      ))}
    </div>
  );
}
