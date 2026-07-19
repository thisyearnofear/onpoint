"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Plus,
  X,
  Check,
  Loader2,
  Camera,
  Package,
  AlertCircle,
} from "lucide-react";

interface InventoryFormProps {
  curatorSlug: string;
  onCreated?: () => void;
}

interface SizeRow {
  size: string;
  stock: number;
  price: number;
  printingAvailable: boolean;
}

interface KitSku {
  id: string;
  club: string;
  season: string;
  kit_type: string;
}

const KIT_TYPES = [
  { value: "home", label: "Home" },
  { value: "away", label: "Away" },
  { value: "third", label: "Third" },
  { value: "goalkeeper", label: "Goalkeeper" },
];

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "S/M", "L/XL", "OS"];

type FormState = "idle" | "submitting" | "success" | "error";

export function InventoryForm({ curatorSlug, onCreated }: InventoryFormProps) {
  const [club, setClub] = useState("");
  const [kitType, setKitType] = useState("home");
  const [season, setSeason] = useState("2024/25");
  const [sizes, setSizes] = useState<SizeRow[]>([
    { size: "M", stock: 1, price: 2500, printingAvailable: false },
  ]);
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [skuSuggestions, setSkuSuggestions] = useState<KitSku[]>([]);

  // Fetch SKU suggestions for club autocomplete
  useEffect(() => {
    if (club.length < 2) {
      setSkuSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/curator/listings?q=${encodeURIComponent(club)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.skus) setSkuSuggestions(data.skus);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [club]);

  const addSize = useCallback(() => {
    setSizes((prev) => [...prev, { size: "M", stock: 1, price: 2500, printingAvailable: false }]);
  }, []);

  const removeSize = useCallback((index: number) => {
    setSizes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateSize = useCallback((index: number, field: keyof SizeRow, value: string | number | boolean) => {
    setSizes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    setFormState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/curator/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curatorSlug,
          club: club.trim(),
          kitType,
          season: season.trim(),
          sizes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to create listing");
        setFormState("error");
        return;
      }

      setFormState("success");
      // Reset form for next item
      setClub("");
      setSizes([{ size: "M", stock: 1, price: 2500, printingAvailable: false }]);

      if (onCreated) onCreated();

      // Return to idle after 3s so they can add another
      setTimeout(() => setFormState("idle"), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setFormState("error");
    }
  }, [curatorSlug, club, kitType, season, sizes, onCreated]);

  if (formState === "success") {
    return (
      <div className="rounded-2xl border-2 border-success/30 bg-success/5 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <Check className="h-6 w-6 text-success" />
        </div>
        <h3 className="mt-3 text-lg font-bold">Item added!</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your listing is now live on your storefront. Add another item or
          view your storefront to see it.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-primary" />
        <h3 className="font-bold">Add an item</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Fill in the details and your item goes live on your storefront instantly.
        No photo needed — customers can try it on with AI right away.
      </p>

      {formState === "error" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="space-y-4">
        {/* Club */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Club / Brand</label>
          <input
            type="text"
            value={club}
            onChange={(e) => setClub(e.target.value)}
            placeholder="e.g. Arsenal, Chelsea, Real Madrid"
            list="club-suggestions"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <datalist id="club-suggestions">
            {skuSuggestions.map((sku) => (
              <option key={sku.id} value={sku.club}>
                {sku.club} {sku.season} {sku.kit_type}
              </option>
            ))}
          </datalist>
        </div>

        {/* Kit type + Season */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Kit type</label>
            <select
              value={kitType}
              onChange={(e) => setKitType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {KIT_TYPES.map((kt) => (
                <option key={kt.value} value={kt.value}>{kt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Season</label>
            <input
              type="text"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="2024/25"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Sizes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-muted-foreground">Sizes & pricing</label>
            <button
              type="button"
              onClick={addSize}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="h-3 w-3" />
              Add size
            </button>
          </div>

          <div className="space-y-2">
            {sizes.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={s.size}
                  onChange={(e) => updateSize(i, "size", e.target.value)}
                  className="w-20 rounded-lg border border-border bg-background px-2 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  {SIZE_OPTIONS.map((sz) => (
                    <option key={sz} value={sz}>{sz}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={s.stock}
                  onChange={(e) => updateSize(i, "stock", Number(e.target.value))}
                  placeholder="Stock"
                  min={0}
                  className="w-20 rounded-lg border border-border bg-background px-2 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <input
                  type="number"
                  value={s.price}
                  onChange={(e) => updateSize(i, "price", Number(e.target.value))}
                  placeholder="Price"
                  min={0}
                  className="flex-1 rounded-lg border border-border bg-background px-2 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={s.printingAvailable}
                    onChange={(e) => updateSize(i, "printingAvailable", e.target.checked)}
                    className="rounded"
                  />
                  Print
                </label>
                {sizes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSize(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Stock = how many you have. Price in KES. Print = name/number printing available.
          </p>
        </div>

        {/* Photo note */}
        <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Camera className="h-3.5 w-3.5 shrink-0" />
            <span>
              No photo needed — your storefront shows a branded placeholder.
              Add photos later by sending a picture to the OnPoint WhatsApp agent.
            </span>
          </div>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={formState === "submitting" || !club.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {formState === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add to storefront
            </>
          )}
        </button>
      </div>
    </div>
  );
}
