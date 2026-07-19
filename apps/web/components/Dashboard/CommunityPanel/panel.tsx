"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Globe,
  Clock,
  Flame,
  MessageCircle,
  RefreshCw,
  ChevronRight,
  BookHeart,
  HeartHandshake,
  Trash2,
  Hash,
  UserPlus,
  UserCheck,
  Search,
  X,
  Bookmark,
  Sparkles,
  LayoutGrid,
  List,
  Flag,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import type { CommunityLook, SortMode, PanelView, LayoutMode } from "./types";
import { PERSONAS, LAST_SEEN_KEY, BOOKMARKS_KEY, REPORTED_KEY } from "./types";
import { CommunitySkeleton } from "./CommunitySkeleton";
import { CommunityEmpty } from "./CommunityEmpty";
import { TrendingTopics } from "./TrendingTopics";
import { Leaderboard } from "./Leaderboard";
import { TopReactionsCard } from "./TopReactionsCard";
import { EngagementBanner } from "./EngagementBanner";
import { CommunityCard } from "./CommunityCard";
import { CommunityCardGrid } from "./CommunityCardGrid";
import { LookOfTheWeekCard } from "./LookOfTheWeekCard";
import { matchesSearch } from "./SearchHighlight";

// ── Types ──

interface CommunityPanelProps {
  onNavigate: (mode: string) => void;
  onNewLooksStatus?: (hasNew: boolean) => void;
}

// ── Main Panel ──

export function CommunityPanel({ onNavigate, onNewLooksStatus }: CommunityPanelProps) {
  const [looks, setLooks] = useState<CommunityLook[]>([]);
  const [lookOfTheWeek, setLookOfTheWeek] = useState<CommunityLook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [likedLooks, setLikedLooks] = useState<Set<string>>(new Set());
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [reactingIds, setReactingIds] = useState<Set<string>>(new Set());
  const [allLikedIds, setAllLikedIds] = useState<Set<string>>(new Set());
  const [allReactedIds, setAllReactedIds] = useState<Set<string>>(new Set());

  const [allFetchedLooks, setAllFetchedLooks] = useState<CommunityLook[]>([]);

  // Engagement notification state
  const [hasEngagement, setHasEngagement] = useState(false);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  // View toggle
  const [view, setView] = useState<PanelView>("browse");

  // Filter / sort state
  const [personaFilter, setPersonaFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("trending");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  // Followed personas
  const [followedPersonas, setFollowedPersonas] = useState<Set<string>>(new Set());
  const [showFollowedOnly, setShowFollowedOnly] = useState(false);

  // ── Auto-refresh ──
  const [hasNewData, setHasNewData] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLookCountRef = useRef(0);

  // ── Search ──
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Bookmarks ──
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // ── Gallery layout toggle ──
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("list");

  // ── Moderation / Reports ──
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  // Load bookmarks from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BOOKMARKS_KEY);
      if (stored) setBookmarkedIds(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }, []);

  // Load reported looks from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(REPORTED_KEY);
      if (stored) setReportedIds(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }, []);

  // Load followed personas from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("onpoint-followed-personas");
      if (stored) setFollowedPersonas(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }, []);

  const toggleFollowPersona = useCallback((persona: string) => {
    setFollowedPersonas((prev) => {
      const next = new Set(prev);
      if (next.has(persona)) next.delete(persona);
      else next.add(persona);
      try { localStorage.setItem("onpoint-followed-personas", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Load ALL reacted/liked IDs + submitted look IDs from localStorage
  useEffect(() => {
    try {
      const liked = localStorage.getItem("onpoint-community-likes");
      setAllLikedIds(liked ? new Set(JSON.parse(liked)) : new Set());
      const reacted = new Set<string>();
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("onpoint-community-reacts:")) reacted.add(key.replace("onpoint-community-reacts:", ""));
      }
      setAllReactedIds(reacted);
      const submitted = localStorage.getItem("onpoint-my-submitted-looks");
      setSubmittedIds(submitted ? new Set(JSON.parse(submitted)) : new Set());
    } catch { /* ignore */ }
  }, []);

  const fetchLooks = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (view === "browse") {
        if (personaFilter) params.set("persona", personaFilter);
        params.set("sort", sortMode);
      }

      const res = await fetch(`/api/community/looks?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      const fullFetched = (data.looks || []) as CommunityLook[];
      setAllFetchedLooks(fullFetched);
      lastLookCountRef.current = fullFetched.length;

      let rawLooks = fullFetched;
      if (activeTopic) rawLooks = rawLooks.filter((l) => l.topics.includes(activeTopic));
      if (showFollowedOnly) rawLooks = rawLooks.filter((l) => l.persona && followedPersonas.has(l.persona.toLowerCase()));

      if (view === "reactions") {
        const matched = rawLooks.filter((l) => allLikedIds.has(l.id) || allReactedIds.has(l.id));
        setLooks(matched);
        setLookOfTheWeek(null);
      } else if (view === "saved") {
        const matched = rawLooks.filter((l) => bookmarkedIds.has(l.id));
        setLooks(matched);
        setLookOfTheWeek(null);
      } else if (view === "moderation") {
        const matched = rawLooks.filter((l) => reportedIds.has(l.id));
        setLooks(matched);
        setLookOfTheWeek(null);
      } else {
        setLooks(rawLooks);
        setLookOfTheWeek(data.lookOfTheWeek || null);
      }

      if (data.lastCreatedAt) {
        const prev = localStorage.getItem(LAST_SEEN_KEY);
        if (prev && data.lastCreatedAt > prev) onNewLooksStatus?.(true);
        localStorage.setItem(LAST_SEEN_KEY, data.lastCreatedAt);
      }

      if (submittedIds.size > 0 && data.looks) {
        const submittedLooks = (data.looks as CommunityLook[]).filter((l) => submittedIds.has(l.id));
        const hasNewEngagement = submittedLooks.some((l) => l.likes > 0 || Object.keys(l.reactions).length > 0);
        if (hasNewEngagement) {
          const seenKey = "onpoint-engagement-seen";
          const lastSeen = localStorage.getItem(seenKey);
          if (!lastSeen || Date.now() - parseInt(lastSeen, 10) > 3600000) {
            setHasEngagement(true);
            localStorage.setItem(seenKey, String(Date.now()));
          }
        }
      }
    } catch {
      setError(true);
      setLooks([]);
      setLookOfTheWeek(null);
      setAllFetchedLooks([]);
    } finally {
      setLoading(false);
    }
  }, [personaFilter, sortMode, view, allLikedIds, allReactedIds, submittedIds, activeTopic, showFollowedOnly, followedPersonas, onNewLooksStatus, bookmarkedIds, reportedIds]);

  useEffect(() => { fetchLooks(); }, [fetchLooks]);
  useEffect(() => { onNewLooksStatus?.(false); }, [onNewLooksStatus]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("onpoint-community-likes");
      if (stored) setLikedLooks(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }, []);

  // ── Auto-refresh polling ──
  useEffect(() => {
    if (view !== "browse") return;
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/community/looks?sort=${sortMode}${personaFilter ? `&persona=${personaFilter}` : ""}`);
        if (!res.ok) return;
        const data = await res.json();
        if ((data.looks || []).length > lastLookCountRef.current) setHasNewData(true);
      } catch { /* silent */ }
    }, 30000);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [view, sortMode, personaFilter]);

  useEffect(() => { if (showSearch && searchInputRef.current) searchInputRef.current.focus(); }, [showSearch]);

  const handleLike = useCallback(async (lookId: string) => {
    if (likingIds.has(lookId)) return;
    setLikingIds((prev) => new Set(prev).add(lookId));
    try {
      const res = await fetch("/api/community/looks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lookId }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLooks((prev) => prev.map((l) => (l.id === lookId ? { ...l, likes: data.likes } : l)));
      setLookOfTheWeek((prev) => prev?.id === lookId ? { ...prev, likes: data.likes } : prev);
      setLikedLooks((prev) => { const next = new Set(prev); next.add(lookId); try { localStorage.setItem("onpoint-community-likes", JSON.stringify([...next])); } catch { /* ignore */ } return next; });
      setAllLikedIds((prev) => new Set(prev).add(lookId));
    } catch { /* fail */ }
    finally { setLikingIds((prev) => { const next = new Set(prev); next.delete(lookId); return next; }); }
  }, [likingIds]);

  const handleClearReactions = useCallback(() => {
    try {
      localStorage.removeItem("onpoint-community-likes");
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key?.startsWith("onpoint-community-reacts:")) toRemove.push(key); }
      toRemove.forEach((key) => localStorage.removeItem(key));
    } catch { /* ignore */ }
    setLikedLooks(new Set());
    setAllLikedIds(new Set());
    setAllReactedIds(new Set());
    setLooks([]);
  }, []);

  const handleReact = useCallback(async (lookId: string, emoji: string) => {
    if (reactingIds.has(lookId)) return;
    setReactingIds((prev) => new Set(prev).add(lookId));
    try {
      const res = await fetch("/api/community/looks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lookId, reaction: emoji }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const updateReactions = (prev: CommunityLook) => prev.id === lookId ? { ...prev, reactions: data.reactions } : prev;
      setLooks((prev) => prev.map(updateReactions));
      setLookOfTheWeek((prev) => prev?.id === lookId ? { ...prev, reactions: data.reactions } : prev);
      setAllReactedIds((prev) => new Set(prev).add(lookId));
    } catch { /* fail */ }
    finally { setReactingIds((prev) => { const next = new Set(prev); next.delete(lookId); return next; }); }
  }, [reactingIds]);

  const handleBookmark = useCallback((lookId: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lookId)) next.delete(lookId); else next.add(lookId);
      try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ── Report handler ──
  const handleReport = useCallback((lookId: string) => {
    setReportedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lookId)) next.delete(lookId); else next.add(lookId);
      try { localStorage.setItem(REPORTED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ── Clear all reports ──
  const handleClearReports = useCallback(() => {
    try { localStorage.removeItem(REPORTED_KEY); } catch { /* ignore */ }
    setReportedIds(new Set());
    setLooks([]);
  }, []);

  const handleNewDataClick = useCallback(() => { setHasNewData(false); fetchLooks(); }, [fetchLooks]);

  // ── Client-side search filter ──
  const displayLooks = React.useMemo(() => {
    if (!searchQuery || view !== "browse") return looks;
    return looks.filter((l: CommunityLook) => matchesSearch(l, searchQuery));
  }, [looks, searchQuery, view]);

  // ── Derived ──
  const totalLikes = displayLooks.reduce((sum, l) => sum + l.likes, 0);

  const headerTitle = view === "reactions" ? "My Reactions" : view === "saved" ? "Saved Looks" : view === "moderation" ? "Moderation" : "Trending";
  const headerSubtitle = view === "reactions"
    ? "Looks you've liked or reacted to"
    : view === "saved"
      ? "Looks you've bookmarked for later"
      : view === "moderation"
        ? "Review and manage reported looks"
        : "Anonymized looks from the OnPoint community";
  const headerIcon = view === "reactions"
    ? <HeartHandshake className="w-4 h-4 text-rose-400" />
    : view === "saved"
      ? <Bookmark className="w-4 h-4 text-sky-400" />
      : view === "moderation"
        ? <ShieldAlert className="w-4 h-4 text-rose-400" />
        : <Globe className="w-4 h-4 text-primary" />;

  const hasDisplayLooks = displayLooks.length > 0;
  const hasLooks = looks.length > 0;

  const isGrid = layoutMode === "grid" && view === "browse" && !searchQuery;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">{headerIcon}</div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{headerTitle}</h2>
            <p className="text-xs text-muted-foreground">{headerSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Layout toggle (browse only, no search) */}
          {view === "browse" && !searchQuery && (
            <button
              onClick={() => setLayoutMode(isGrid ? "list" : "grid")}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              title={isGrid ? "List view" : "Grid view"}
            >
              {isGrid ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            </button>
          )}
          {view === "browse" && (
            <button
              onClick={() => { setShowSearch(!showSearch); if (!showSearch) setLayoutMode("list"); }}
              className={`p-2 rounded-lg transition-all ${showSearch || searchQuery ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              <Search className="w-4 h-4" />
            </button>
          )}
          <button onClick={fetchLooks} disabled={loading}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && view === "browse" && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="relative">
          <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search looks by headline, takeaways, or topics..."
            className="w-full rounded-xl border border-border bg-card/60 px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
            ><X className="w-4 h-4" /></button>
          )}
        </motion.div>
      )}

      {/* Engagement notification */}
      {view === "browse" && <EngagementBanner hasEngagement={hasEngagement} onDismiss={() => setHasEngagement(false)} />}

      {/* View toggle */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setView("browse")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${view === "browse" ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "bg-muted/40 text-muted-foreground hover:text-foreground"}`}
        ><Globe className="w-3.5 h-3.5" /> Browse</button>
        <button onClick={() => setView("reactions")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${view === "reactions" ? "bg-rose-500/20 text-rose-500 ring-1 ring-rose-500/30" : "bg-muted/40 text-muted-foreground hover:text-foreground"}`}
        ><BookHeart className="w-3.5 h-3.5" /> Reactions
          {allLikedIds.size + allReactedIds.size > 0 && <span className="ml-0.5 rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-500 tabular-nums">{allLikedIds.size + allReactedIds.size}</span>}
        </button>
        <button onClick={() => setView("saved")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${view === "saved" ? "bg-sky-500/20 text-sky-500 ring-1 ring-sky-500/30" : "bg-muted/40 text-muted-foreground hover:text-foreground"}`}
        ><Bookmark className="w-3.5 h-3.5" /> Saved
          {bookmarkedIds.size > 0 && <span className="ml-0.5 rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-500 tabular-nums">{bookmarkedIds.size}</span>}
        </button>
        <button onClick={() => setView("moderation")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${view === "moderation" ? "bg-rose-500/20 text-rose-500 ring-1 ring-rose-500/30" : "bg-muted/40 text-muted-foreground hover:text-foreground"}`}
        ><Flag className="w-3.5 h-3.5" /> Reports
          {reportedIds.size > 0 && <span className="ml-0.5 rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-500 tabular-nums">{reportedIds.size}</span>}
        </button>
      </div>

      {/* New data indicator */}
      {hasNewData && view === "browse" && (
        <motion.button initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onClick={handleNewDataClick}
          className="w-full rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-primary hover:bg-primary/15 transition-all animate-pulse"
        ><Sparkles className="w-3.5 h-3.5" /> New looks available — refresh to see them</motion.button>
      )}

      {/* Filter & Sort bar */}
      {view === "browse" && !loading && !error && hasLooks && !searchQuery && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setPersonaFilter(null)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${!personaFilter ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}
            >All</button>
            {PERSONAS.map((p) => {
              const isFollowed = followedPersonas.has(p);
              const isActive = personaFilter === p;
              return (
                <div key={p} className="flex items-center gap-0.5">
                  <button onClick={() => setPersonaFilter(isActive ? null : p)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium capitalize transition-all ${isActive ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}
                  >{p}</button>
                  <button onClick={() => toggleFollowPersona(p)} title={isFollowed ? `Unfollow ${p}` : `Follow ${p}`}
                    className={`rounded-full p-1 transition-all ${isFollowed ? "text-primary hover:text-primary/70" : "text-muted-foreground/30 hover:text-muted-foreground/70"}`}
                  >{isFollowed ? <UserCheck className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}</button>
                </div>
              );
            })}
            {followedPersonas.size > 0 && (
              <button onClick={() => setShowFollowedOnly(!showFollowedOnly)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${showFollowedOnly ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}
              ><UserCheck className="w-3 h-3 inline mr-0.5" /> Followed only</button>
            )}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => setSortMode("trending")}
              className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-all ${sortMode === "trending" ? "bg-accent/20 text-accent" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
            ><Flame className="w-3 h-3 inline mr-0.5" /> Trending</button>
            <button onClick={() => setSortMode("latest")}
              className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-all ${sortMode === "latest" ? "bg-accent/20 text-accent" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
            ><Clock className="w-3 h-3 inline mr-0.5" /> Latest</button>
          </div>
        </div>
      )}

      {/* Look of the Week (list view only) */}
      {!isGrid && !loading && !error && lookOfTheWeek && !searchQuery && (
        <LookOfTheWeekCard look={lookOfTheWeek} likedLooks={likedLooks} onLike={handleLike} onReact={handleReact} onBookmark={handleBookmark} bookmarkedIds={bookmarkedIds} />
      )}

      {/* Trending Topics (list view only) */}
      {!isGrid && view === "browse" && !loading && !error && hasLooks && !searchQuery && (
        <TrendingTopics looks={looks} activeTopic={activeTopic} onTopicToggle={(t) => setActiveTopic(t)} />
      )}

      {/* Leaderboard (list view only) */}
      {!isGrid && view === "browse" && !loading && !error && allFetchedLooks.length >= 3 && !searchQuery && (
        <Leaderboard looks={allFetchedLooks} />
      )}

      {/* Stats bar */}
      {!loading && (hasDisplayLooks || (view !== "browse" && hasLooks)) && (
        <div className="flex items-center gap-4 px-1 text-xs text-muted-foreground/70">
          {view === "reactions" ? (
            <>
              <span className="flex items-center gap-1"><HeartHandshake className="w-3 h-3 text-rose-400" />{looks.length} reacted look{looks.length !== 1 ? "s" : ""}</span>
              <button onClick={handleClearReactions} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground/50 hover:text-rose-400 hover:bg-rose-500/10 transition-all"><Trash2 className="w-3 h-3" /><span className="text-[10px]">Clear all</span></button>
            </>
          ) : view === "saved" ? (
            <>
              <span className="flex items-center gap-1"><Bookmark className="w-3 h-3 text-sky-400" />{looks.length} saved look{looks.length !== 1 ? "s" : ""}</span>
              <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-warning" />{totalLikes} total likes</span>
            </>
          ) : view === "moderation" ? (
            <>
              <span className="flex items-center gap-1"><Flag className="w-3 h-3 text-rose-400" />{looks.length} reported look{looks.length !== 1 ? "s" : ""}</span>
              <button onClick={handleClearReports} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground/50 hover:text-rose-400 hover:bg-rose-500/10 transition-all"><Trash2 className="w-3 h-3" /><span className="text-[10px]">Clear all</span></button>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-warning" />{totalLikes} total likes</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{displayLooks.length} look{displayLooks.length !== 1 ? "s" : ""}{searchQuery ? " found" : isGrid ? " in grid" : " trending"}</span>
            </>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && <CommunitySkeleton />}

      {/* Error state */}
      {!loading && error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-warning/20 bg-warning/5 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">Couldn&apos;t load community looks right now.</p>
          <Button variant="outline" size="sm" onClick={fetchLooks}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try Again</Button>
        </motion.div>
      )}

      {/* Empty states */}
      {!loading && !error && looks.length === 0 && view === "reactions" && (
        <CommunityEmpty onTryOn={() => onNavigate("try-on")} view={view} onBackToBrowse={() => setView("browse")} />
      )}
      {!loading && !error && looks.length === 0 && view === "saved" && (
        <CommunityEmpty onTryOn={() => onNavigate("try-on")} view={view} onBackToBrowse={() => setView("browse")} />
      )}
      {!loading && !error && looks.length === 0 && view === "moderation" && (
        <CommunityEmpty onTryOn={() => onNavigate("try-on")} view={view} onBackToBrowse={() => setView("browse")} />
      )}

      {/* Filter-aware empty state (browse) */}
      {!loading && !error && !hasDisplayLooks && view === "browse" && allFetchedLooks.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-warning/20 bg-warning/5 p-6 text-center">
          <Hash className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-sm font-bold text-foreground mb-2">
            {searchQuery ? "No looks match your search" : activeTopic && showFollowedOnly ? "No looks match both filters" : activeTopic ? "No looks match this topic" : "No looks from followed personas"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
            {searchQuery ? "Try a different keyword or clear the search." : activeTopic && showFollowedOnly ? "Try clearing one filter to broaden results." : activeTopic ? "Try selecting a different topic or clear the filter." : `Looks shared by ${[...followedPersonas].join(", ")} haven't appeared yet.`}
          </p>
          <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setActiveTopic(null); setShowFollowedOnly(false); }}>
            <Globe className="w-3.5 h-3.5 mr-1.5" /> Show all looks
          </Button>
        </motion.div>
      )}

      {/* No data at all */}
      {!loading && !error && !hasLooks && allFetchedLooks.length === 0 && view === "browse" && (
        <CommunityEmpty onTryOn={() => onNavigate("try-on")} view={view} onBackToBrowse={() => setView("browse")} />
      )}

      {/* My Reactions top summary card */}
      {view === "reactions" && !loading && !error && hasLooks && <TopReactionsCard looks={looks} />}

      {/* Looks — Grid layout */}
      {!loading && !error && isGrid && hasDisplayLooks && (
        <div className="grid grid-cols-2 gap-2">
          {displayLooks.map((look, i) => (
            <CommunityCardGrid
              key={look.id}
              look={look}
              likedLooks={likedLooks}
              onLike={handleLike}
              onBookmark={handleBookmark}
              onReport={handleReport}
              bookmarkedIds={bookmarkedIds}
              reportedIds={reportedIds}
              searchQuery={undefined}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Looks — List layout */}
      {!loading && !error && !isGrid && (hasDisplayLooks || (view !== "browse" && hasLooks)) && (
        <div className="space-y-2.5">
          {(searchQuery ? displayLooks : lookOfTheWeek ? displayLooks.filter((l) => l.id !== lookOfTheWeek.id) : displayLooks).map((look, i) => (
            <CommunityCard
              key={look.id}
              look={look}
              likedLooks={likedLooks}
              onLike={handleLike}
              onReact={handleReact}
              onBookmark={handleBookmark}
              onReport={view === "browse" ? handleReport : undefined}
              bookmarkedIds={bookmarkedIds}
              reportedIds={reportedIds}
              searchQuery={view === "browse" ? searchQuery : undefined}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Encourage submission */}
      {!loading && hasLooks && view === "browse" && !searchQuery && !isGrid && (
        <div className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageCircle className="w-3.5 h-3.5 text-primary" />
            <span>Share your next look anonymously with the community.</span>
          </div>
          <button onClick={() => onNavigate("try-on")} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
            Try On <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
