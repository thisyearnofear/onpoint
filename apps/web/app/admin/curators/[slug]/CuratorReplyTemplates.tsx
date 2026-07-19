"use client";

import { useState } from "react";
import { CheckCircle2, Copy, MessageCircle } from "lucide-react";
import {
  getCuratorReplyTemplates,
  type CuratorReplyTemplate,
} from "../../../../lib/utils/curator-reply-templates";

function categoryLabel(category: CuratorReplyTemplate["category"]) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function CuratorReplyTemplates({
  curatorName,
  verticals,
}: {
  curatorName: string;
  verticals: string[];
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const templates = getCuratorReplyTemplates({ curatorName, verticals });

  const copyTemplate = async (template: CuratorReplyTemplate) => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(template.body);
    setCopiedId(template.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-success" />
        <h2 className="font-bold">Reply templates</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Phone-ready snippets for common customer questions. Templates adapt by curator vertical.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {templates.map((template) => (
          <article
            key={template.id}
            className="rounded-lg border border-border bg-muted/25 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{template.label}</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {categoryLabel(template.category)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyTemplate(template)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium transition-colors hover:bg-background"
              >
                {copiedId === template.id ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedId === template.id ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {template.body}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
