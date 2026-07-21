"use client";

import * as React from "react";
import { X, Plus } from "lucide-react";

interface TagEditorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
  maxTags?: number;
  /** When true, tags are normalized to lowercase on commit. */
  lowercase?: boolean;
  className?: string;
}

/**
 * Chip-based tag editor. Tags commit on Enter or comma, dedup case-insensitively,
 * and strip a leading `#`. Adapted from the Wardrobe (tandpfun/wardrobe) TagEditor
 * pattern, translated to OnPoint conventions (lucide-react, Tailwind design tokens).
 */
export function TagEditor({
  value,
  onChange,
  placeholder = "Add a tag",
  ariaLabel = "Add tag",
  maxTags,
  lowercase = true,
  className = "",
}: TagEditorProps) {
  const [input, setInput] = React.useState("");

  const atLimit = maxTags != null && value.length >= maxTags;

  function commit() {
    const next = input.trim().replace(/^#/, "");
    if (!next) return;
    const normalized = lowercase ? next.toLowerCase() : next;
    if (value.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) {
      setInput("");
      return;
    }
    if (atLimit) return;
    onChange([...value, normalized]);
    setInput("");
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium capitalize text-foreground/70"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`Remove ${tag}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder={atLimit ? `Max ${maxTags} tags` : placeholder}
          aria-label={ariaLabel}
          disabled={atLimit}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!input.trim() || atLimit}
          aria-label="Add tag"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-muted disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
