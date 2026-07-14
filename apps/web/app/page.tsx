import { OnPointHeader } from "../components/OnPointHeader";
import { HeroView } from "../components/home/HeroView";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <OnPointHeader />
      <HeroView />
    </div>
  );
}
