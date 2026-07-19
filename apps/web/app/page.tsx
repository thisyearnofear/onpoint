import { OnPointLayout } from "../components/OnPointLayout";
import { HeroView } from "../components/home/HeroView";

export default function Home() {
  return (
    <OnPointLayout footer={false}>
      <HeroView />
    </OnPointLayout>
  );
}
