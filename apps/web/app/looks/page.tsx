import { OnPointLayout } from "../../components/OnPointLayout";
import { loadLooks } from "./api";
import { LooksHeader } from "./components/LooksHeader";
import { LooksFilters } from "./components/LooksFilters";
import { LooksEmptyState } from "./components/LooksEmptyState";
import { LooksGrid } from "./components/LooksGrid";
import type { LooksFilters as LooksFiltersType } from "./utils";

export const dynamic = "force-dynamic";

interface SearchParams {
  tag?: string;
  category?: string;
  occasion?: string;
  season?: string;
  sort?: string;
}

export async function generateMetadata() {
  return {
    title: "Looks | OnPoint",
    description:
      "Browse real outfits from OnPoint curators. Try any look on with AI and shop the pieces.",
  };
}

export default async function LooksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tag, category, occasion, season, sort } = await searchParams;
  const looks = await loadLooks({ tag, category, occasion, season, sort });

  const currentFilters: LooksFiltersType = {
    category,
    occasion,
    season,
    sort,
  };
  const hasActiveFilters = Boolean(category || occasion || season);

  return (
    <OnPointLayout footer={false}>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <LooksHeader />

        <LooksFilters currentFilters={currentFilters} />

        <div className="mt-8">
          {looks.length === 0 ? (
            <LooksEmptyState hasActiveFilters={hasActiveFilters} />
          ) : (
            <LooksGrid looks={looks} />
          )}
        </div>
      </div>
    </OnPointLayout>
  );
}
