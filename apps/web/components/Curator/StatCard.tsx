import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="pl-5 border-l-2 border-primary/20">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}
