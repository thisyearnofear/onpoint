"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Pin, RotateCcw, Heart } from "lucide-react";
import {
  STUDIO_ITEMS,
  STUDIO_GARMENTS,
  studioItemById,
  readStudioSaved,
  writeStudioSaved,
  type StudioItem,
} from "../../lib/wardrobe-studio";
import { useStyleHearts } from "../../lib/stores/style-board-hearts";
import { LiveLooks } from "./LiveLooks";
import { FreshDrops } from "../social/FreshDrops";
import { RunwayWinners } from "../social/RunwayWinners";
import { FirstBadge } from "../social/FirstBadge";
import { RemixBanner } from "../social/RemixBanner";
import { ClosetSection } from "./ClosetSection";
import {
  DEFAULT_LIVE_LOOKS_FILTERS,
  readLiveLooksFilters,
  type LiveLooksFilters,
} from "../../lib/looks/params";
import styles from "./WardrobeWorkspace.module.css";

type StudioTab = "all" | "clothes" | "outfits" | "saved";
type Occasion = "all" | "everyday" | "work" | "going-out" | "layers";

const TABS: { id: StudioTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "clothes", label: "Clothes" },
  { id: "outfits", label: "Outfit ideas" },
  { id: "saved", label: "Saved" },
];

const OCCASIONS: { id: Occasion; label: string; tags: string[] }[] = [
  { id: "all", label: "All occasions", tags: [] },
  { id: "everyday", label: "Everyday", tags: ["casual", "weekend", "relaxed"] },
  { id: "work", label: "Work", tags: ["business", "office", "work"] },
  { id: "going-out", label: "Going out", tags: ["date", "dinner", "night-out", "party", "event", "formal", "wedding"] },
  { id: "layers", label: "Layers", tags: ["fall", "winter"] },
];

const PAGE = 12;
const COMPACT_VIEW = "(max-width: 1023px)";

function StudioClothesRack({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    event.preventDefault();
    const next =
      event.key === "Home" ? 0 :
      event.key === "End" ? buttons.length - 1 :
      event.key === "ArrowRight" ? (index + 1) % buttons.length :
      (index - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <div className={styles.rack} onKeyDown={onKeyDown}>
      <div className={styles.rackHead}>
        <span className={styles.rackBadge}>3 starter pieces</span>
        <span className={styles.rackHint}>Turn a piece. Tap to dress.</span>
      </div>
      <div className={styles.rackRail} aria-hidden="true" />
      <div className={styles.rackItems} role="group" aria-label="Garment rack">
        {STUDIO_GARMENTS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`${styles.hangerItem}${selectedId === g.id ? ` ${styles.active}` : ""}`}
            aria-label={`Dress model in ${g.title}`}
            aria-pressed={selectedId === g.id}
            onClick={() => onSelect(g.id)}
          >
            <span className={styles.turn} aria-hidden="true">
              <svg className={styles.hangerSvg} viewBox="0 0 60 26">
                <path d="M30 1 v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M30 7 L5 25 L55 25 Z" fill="#b98a5a" stroke="#8a6a42" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <span className={styles.hangerBody}>
                <Image src={g.image} alt="" fill sizes="84px" className="object-contain" />
              </span>
            </span>
            <span className={styles.hangerName}>{g.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GalleryItem({ item, selected, onOpen }: { item: StudioItem; selected: boolean; onOpen: (id: string) => void }) {
  const type = item.kind === "garment" ? "Garment demo" : "Outfit reference";
  return (
    <button
      className={`${styles.item}${selected ? ` ${styles.selected}` : ""}`}
      type="button"
      onClick={() => onOpen(item.id)}
      aria-label={`View ${item.title}`}
      aria-pressed={selected}
    >
      <span className={styles.itemMedia}>
        <Image src={item.image} alt="" fill sizes="(min-width: 640px) 170px, 45vw" className="object-contain" loading="lazy" />
      </span>
      <span className={styles.itemCopy}>
        <span className={styles.itemName}>{item.title}</span>
        <span className={styles.itemType}>{type}</span>
      </span>
    </button>
  );
}

export function WardrobeWorkspace() {
  const [tab, setTab] = useState<StudioTab>("all");
  const [query, setQuery] = useState("");
  const [occasion, setOccasion] = useState<Occasion>("all");
  const [limit, setLimit] = useState(PAGE);
  const [selectedId, setSelectedId] = useState(STUDIO_GARMENTS[0]!.id);
  const [history, setHistory] = useState<string[]>([]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [view, setView] = useState<"model" | "piece">("model");
  // Garments (studio-only) live in the studio key; saved outfits live in the shared
  // style-board hearts store so both surfaces show one set of picks.
  const [savedGarmentIds, setSavedGarmentIds] = useState<string[]>([]);
  const hearts = useStyleHearts((s) => s.hearts);
  const toggleHeart = useStyleHearts((s) => s.toggle);
  const addHearts = useStyleHearts((s) => s.addMany);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState("");
  const [storageOk, setStorageOk] = useState(true);
  const [status, setStatus] = useState("");
  const [pickNotice, setPickNotice] = useState<string | null>(null);
  const [liveFilters, setLiveFilters] = useState<LiveLooksFilters>(DEFAULT_LIVE_LOOKS_FILTERS);
  const [hydrated, setHydrated] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const galleryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const { saved, available } = readStudioSaved();
    // One-time migration: outfit ids once saved in the studio key move to the shared store.
    const garmentIds = saved.savedIds.filter((id) => studioItemById(id)?.kind === "garment");
    const legacyOutfits = saved.savedIds.filter((id) => studioItemById(id)?.kind === "outfit");
    if (legacyOutfits.length) {
      addHearts(legacyOutfits);
      if (available) writeStudioSaved({ savedIds: garmentIds, notes: saved.notes });
    }
    setSavedGarmentIds(garmentIds);
    setNotes(saved.notes);
    setNoteDraft(saved.notes[STUDIO_GARMENTS[0]!.id] || "");
    setStorageOk(available);

    // Deep links: ?tab=<tab-id> picks the gallery tab; ?pick=<item-id> selects the
    // item on stage (the /style-board redirect forwards both).
    const params = new URLSearchParams(window.location.search);
    setLiveFilters(readLiveLooksFilters(params));
    const pick = studioItemById(params.get("pick"));
    const requestedTab = params.get("tab");
    if (pick) {
      const pickTab: StudioTab = pick.kind === "outfit" ? "outfits" : "all";
      setTab(pickTab);
      setSelectedId(pick.id);
      setNoteDraft(saved.notes[pick.id] || "");
      setPickNotice(pick.title);
      // Page the gallery far enough to reveal the picked card.
      const gallery = pickTab === "outfits" ? STUDIO_ITEMS.filter((i) => i.kind === "outfit") : STUDIO_ITEMS;
      const idx = gallery.findIndex((i) => i.id === pick.id);
      if (idx >= PAGE) setLimit(Math.ceil((idx + 1) / PAGE) * PAGE);
      setStatus(`${pick.title} selected.`);
    } else if (requestedTab && TABS.some((t) => t.id === requestedTab)) {
      setTab(requestedTab as StudioTab);
    }
    setHydrated(true);
  }, []);

  const savedIds = useMemo(
    () => [...savedGarmentIds, ...(hydrated ? hearts.filter((id) => studioItemById(id)?.kind === "outfit") : [])],
    [savedGarmentIds, hearts, hydrated],
  );

  const selected = studioItemById(selectedId) ?? STUDIO_GARMENTS[0]!;
  const pinned = pinnedId ? studioItemById(pinnedId) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const occ = OCCASIONS.find((o) => o.id === occasion) ?? OCCASIONS[0]!;
    return STUDIO_ITEMS.filter((item) => {
      if (tab === "clothes" && item.kind !== "garment") return false;
      if (tab === "outfits" && item.kind !== "outfit") return false;
      if (tab === "saved" && !savedIds.includes(item.id)) return false;
      if (item.kind === "outfit" && occasion !== "all" && !item.tags.some((t) => occ.tags.includes(t))) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.tags.some((t) => t.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [tab, query, occasion, savedIds]);

  const visible = filtered.slice(0, limit);

  // On the outfits tab the studio references are a labelled sample section under the
  // live looks, so they show the outfit set rather than the shared occasion filter.
  const studioOutfits = useMemo(
    () => STUDIO_ITEMS.filter((item) => item.kind === "outfit"),
    [],
  );

  const resetBrowse = () => setLimit(PAGE);

  const clearFilters = () => {
    setQuery("");
    setOccasion("all");
    setLimit(PAGE);
  };

  const applySelection = (id: string) => {
    setSelectedId(id);
    setComparing(false);
    setView("model");
    setNoteDraft(notes[id] || "");
  };

  const compactScrollTo = (el: HTMLElement | null) => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    if (!window.matchMedia(COMPACT_VIEW).matches) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const choose = (id: string, fromGallery = false) => {
    if (fromGallery) compactScrollTo(stageRef.current);
    if (id === selected.id) return;
    setHistory((h) => [...h, selected.id]);
    applySelection(id);
    const item = studioItemById(id);
    if (item) setStatus(`${item.title} selected.`);
  };

  const chooseTab = (id: StudioTab) => {
    setTab(id);
    resetBrowse();
    compactScrollTo(galleryRef.current);
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    const from = selected.id;
    setHistory((h) => h.slice(0, -1));
    applySelection(prev);
    setTab("all");
    setQuery("");
    setOccasion("all");
    const maxIdx = Math.max(
      STUDIO_ITEMS.findIndex((i) => i.id === prev),
      STUDIO_ITEMS.findIndex((i) => i.id === from),
    );
    setLimit(Math.max(PAGE, Math.ceil((maxIdx + 1) / PAGE) * PAGE));
    const item = studioItemById(prev);
    if (item) setStatus(`Back to ${item.title}.`);
  };

  const pinCurrent = () => {
    setPinnedId(selected.id);
    setComparing(false);
    setStatus(`${selected.title} pinned for comparison.`);
  };

  const clearPin = () => {
    setPinnedId(null);
    setComparing(false);
    setStatus("Pin cleared.");
  };

  const persist = (garmentIds: string[], nextNotes: Record<string, string>) => {
    const ok = writeStudioSaved({ savedIds: garmentIds, notes: nextNotes });
    setStorageOk(ok);
  };

  const toggleSave = () => {
    if (selected.kind === "garment") {
      const next = savedGarmentIds.includes(selected.id)
        ? savedGarmentIds.filter((i) => i !== selected.id)
        : [...savedGarmentIds, selected.id];
      setSavedGarmentIds(next);
      persist(next, notes);
    } else {
      toggleHeart(selected.id);
    }
    setStatus(savedIds.includes(selected.id) ? `${selected.title} removed from saved.` : `${selected.title} saved.`);
  };

  const saveNote = () => {
    const text = noteDraft.trim().slice(0, 240);
    const next = { ...notes };
    if (text) next[selected.id] = text;
    else delete next[selected.id];
    setNotes(next);
    persist(savedGarmentIds, next);
    setStatus(text ? "Note saved." : "Note cleared.");
  };

  const savedItem = savedIds.includes(selected.id);
  const compareReady = pinned && pinned.id !== selected.id;
  const rotation = `${([...selected.id].reduce((t, c) => t + c.charCodeAt(0), 0) % 9) - 4}deg`;
  const savedEmptyFiltered = tab === "saved" && savedIds.length > 0 && filtered.length === 0;

  return (
    <section id="style-studio" className={styles.studio}>
      <div className={styles.wrap}>
        <h1 className={styles.headline}>Your wardrobe, in play.</h1>
        <p className={styles.subcopy}>Pick a piece. Pin a favorite. Find your next look.</p>

        {pickNotice && (
          <div className="mt-4 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
            The judges think you&apos;d score higher in something like <strong>{pickNotice}</strong> — or{" "}
            <Link href="/runway/play" className="font-bold text-primary hover:underline">play with your own photo</Link>.
          </div>
        )}

        <div className={styles.topbar}>
          <nav className={styles.tabs} aria-label="Wardrobe sections" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${styles.tab}${tab === t.id ? ` ${styles.active}` : ""}`}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => chooseTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className={styles.layout}>
          <div className={styles.stageCol}>
            <div className={styles.stage} ref={stageRef} aria-label="Selected piece">
              <h2 className={styles.stageTitle}>{selected.title}</h2>
              <p className={styles.stageTags}>{selected.tags.join(" · ")}</p>
              <span className={styles.badge}>
                {selected.kind === "garment" ? "Prepared on-model demo · not your photo" : "Outfit reference · not items for sale"}
              </span>

              <StudioClothesRack selectedId={selected.id} onSelect={choose} />

              {comparing && compareReady ? (
                <div className={styles.compareGrid} aria-label="Comparison">
                  {[pinned!, selected].map((item) => (
                    <div key={item.id} className={styles.comparePane}>
                      <div className={styles.paneImg}>
                        <Image
                          src={item.kind === "garment" && item.modeledImage ? item.modeledImage : item.image}
                          alt={item.title}
                          fill
                          sizes="(min-width: 1024px) 20vw, 45vw"
                          className="object-contain"
                        />
                      </div>
                      <span className={styles.paneLabel}>
                        {item.title}
                        <span className={styles.paneMode}>{item.kind === "garment" ? " · on model" : " · outfit reference"}</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : selected.kind === "garment" ? (
                <>
                  <div className={styles.heroBox}>
                    <Image
                      src={view === "model" ? selected.modeledImage! : selected.image}
                      alt={view === "model" ? `Model wearing ${selected.title}` : selected.title}
                      fill
                      sizes="(min-width: 1024px) 38vw, 92vw"
                      className="object-contain"
                      priority={selected.id === STUDIO_GARMENTS[0]!.id && view === "model"}
                    />
                    {view === "model" && (
                      <span className={styles.floatTile} style={{ "--piece-rotation": rotation } as React.CSSProperties}>
                        <Image src={selected.image} alt="" fill sizes="88px" className="object-contain" />
                      </span>
                    )}
                  </div>
                  <div className={styles.viewToggle} aria-label="Garment display">
                    {(["model", "piece"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={view === v ? styles.active : ""}
                        aria-pressed={view === v}
                        onClick={() => setView(v)}
                      >
                        {v === "model" ? "On model" : "Piece"}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className={styles.heroBox}>
                  <Image
                    src={selected.image}
                    alt={selected.title}
                    fill
                    sizes="(min-width: 1024px) 38vw, 92vw"
                    className="object-contain"
                  />
                </div>
              )}

              <div className={styles.controls}>
                <button type="button" className={styles.ctrl} onClick={undo} disabled={!history.length}>
                  <RotateCcw className="h-3.5 w-3.5" /> Undo
                </button>
                {pinned ? (
                  <>
                    <button
                      type="button"
                      className={styles.ctrl}
                      onClick={() => compareReady && setComparing((c) => !c)}
                      disabled={!compareReady}
                      aria-pressed={comparing}
                    >
                      {comparing ? "Exit compare" : "Compare"}
                    </button>
                    <button type="button" className={styles.ctrl} onClick={clearPin}>Clear pin</button>
                  </>
                ) : (
                  <button type="button" className={styles.ctrl} onClick={pinCurrent} aria-label="Pin for compare">
                    <Pin className="h-3.5 w-3.5" /> Pin
                  </button>
                )}
                <button type="button" className={styles.ctrl} onClick={toggleSave} aria-pressed={savedItem}>
                  <Heart className={`h-3.5 w-3.5 ${savedItem ? "fill-primary text-primary" : ""}`} />
                  {savedItem ? "Saved" : selected.kind === "garment" ? "Save piece" : "Save look"}
                </button>
              </div>
              {pinned && !compareReady && (
                <p className={styles.hint}>Pinned {pinned.title}. Pick a different piece to compare.</p>
              )}

              <div className={styles.controls}>
                <Link href={`/runway/play?sample=${selected.sampleId}`} className={styles.ctrlPrimary}>
                  Get a verdict <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link href="/lab?tab=try-on" className={styles.ctrlGhost}>Use my photo</Link>
              </div>
              <p className={styles.hint}>Judging opens Runway. Personal try-on starts in the fitting room.</p>

              <details className={styles.note}>
                <summary className={styles.noteSummary}>Styling note</summary>
                <label className={styles.hint} htmlFor="studio-note">Private note for {selected.title} — stays on this device</label>
                <textarea
                  id="studio-note"
                  maxLength={240}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="e.g. Works with the grey cardigan."
                />
                <div className={styles.noteRow}>
                  <span className={styles.hint}>{noteDraft.length}/240</span>
                  <button type="button" className={styles.ctrl} onClick={saveNote}>Save note</button>
                </div>
              </details>

              {!storageOk && hydrated && (
                <p className={styles.status}>Saved for this visit; browser storage is unavailable.</p>
              )}
              <p className={styles.status} role="status" aria-live="polite">{status}</p>
            </div>
          </div>

          <div className={styles.galleryCol} ref={galleryRef}>
            {tab === "outfits" ? (
              <div className="flex flex-col gap-10">
                <FirstBadge />
                <RemixBanner />
                <LiveLooks filters={liveFilters} onFiltersChange={setLiveFilters} />
                <FreshDrops />
                <RunwayWinners />

                <div>
                  <h3 className="text-base font-bold leading-tight">Studio references</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Outfit ideas we prepared on our own models — references, not items for sale.
                  </p>
                  <div className={`${styles.gallery} mt-4`} aria-label="Studio outfit references">
                    {studioOutfits.slice(0, limit).map((item) => (
                      <GalleryItem
                        key={item.id}
                        item={item}
                        selected={selected.id === item.id}
                        onOpen={(id) => choose(id, true)}
                      />
                    ))}
                  </div>
                  {studioOutfits.length > limit && (
                    <button
                      type="button"
                      className={styles.loadMore}
                      onClick={() => setLimit((l) => l + PAGE)}
                    >
                      Load more ({studioOutfits.length - limit} left)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <ClosetSection />
                <div className={styles.searchRow} style={{ marginTop: 20 }}>
                  <label className="sr-only" htmlFor="studio-search">Search pieces</label>
                  <input
                    id="studio-search"
                    className={styles.search}
                    type="search"
                    placeholder="Search pieces and tags"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); resetBrowse(); }}
                  />
                  <span className={styles.count}>
                    {tab === "saved" ? `${savedIds.length} saved` : `Showing ${visible.length} of ${filtered.length}`}
                  </span>
                </div>

                {tab !== "clothes" && (
                  <div className={styles.occasions} aria-label="Occasion filters">
                    {OCCASIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className={`${styles.occasion}${occasion === o.id ? ` ${styles.active}` : ""}`}
                        aria-pressed={occasion === o.id}
                        onClick={() => { setOccasion(o.id); resetBrowse(); }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}

                {tab === "saved" && savedIds.length === 0 ? (
                  <div className={styles.empty}>
                    <p>Nothing saved yet — the pieces you keep will wait for you here.</p>
                    <button type="button" className={`${styles.loadMore} mt-3`} onClick={() => { setTab("all"); clearFilters(); }}>Browse all</button>
                  </div>
                ) : savedEmptyFiltered ? (
                  <div className={styles.empty}>
                    <p>Nothing matches those filters — try widening.</p>
                    <button type="button" className={`${styles.loadMore} mt-3`} onClick={clearFilters}>Clear filters</button>
                  </div>
                ) : filtered.length === 0 ? (
                  <p className={styles.empty}>Nothing matches — try widening.</p>
                ) : (
                  <div className={styles.gallery} aria-label="Wardrobe items">
                    {visible.map((item) => (
                      <GalleryItem key={item.id} item={item} selected={selected.id === item.id} onOpen={(id) => choose(id, true)} />
                    ))}
                  </div>
                )}

                {filtered.length > visible.length && (
                  <button type="button" className={styles.loadMore} onClick={() => setLimit((l) => l + PAGE)}>
                    Load more ({filtered.length - visible.length} left)
                  </button>
                )}
              </>
            )}
          </div>
        </div>


      </div>
    </section>
  );
}
