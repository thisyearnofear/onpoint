import { Reveal } from "../ui/Reveal";
import { Accordion } from "../ui/Accordion";

/**
 * The one detail-sections wrapper for guides — hairline border around the
 * accordion. Guides supply <AccordionItem> children only.
 */
export function GuideAccordion({ children }: { children: React.ReactNode }) {
  return (
    <Reveal>
      <div className="border border-border p-5 md:p-6">
        <Accordion>{children}</Accordion>
      </div>
    </Reveal>
  );
}
