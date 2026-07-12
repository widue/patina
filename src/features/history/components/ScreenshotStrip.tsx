import { Camera, ChevronLeft, ChevronRight, X, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  queryScreenshotsPaginated,
  countScreenshots,
  getScreenshotData,
} from "../services/historyScreenshots.ts";
import type { ScreenshotEntry } from "../services/historyScreenshots.ts";

const PAGE_SIZE = 50;

interface Props {
  date: Date;
}

export default function ScreenshotStrip({ date }: Props) {
  const [screenshots, setScreenshots] = useState<ScreenshotEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [viewerId, setViewerId] = useState<number | null>(null);
  const [viewerData, setViewerData] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const currentPageRef = useRef(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getDayRange = useCallback(() => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
  }, [date]);

  const loadFirstPage = useCallback(async () => {
    const { start, end } = getDayRange();
    setLoading(true);
    setScreenshots([]);
    setHasMore(false);
    currentPageRef.current = 1;
    try {
      const [countResult, pageResult] = await Promise.all([
        countScreenshots(start, end),
        queryScreenshotsPaginated(start, end, 1, PAGE_SIZE),
      ]);
      setTotalCount(countResult);
      setScreenshots(pageResult.items);
      setHasMore(pageResult.hasMore);
      currentPageRef.current = 1;
    } catch {
      setScreenshots([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [getDayRange]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const { start, end } = getDayRange();
    const nextPage = currentPageRef.current + 1;
    setLoadingMore(true);
    try {
      const result = await queryScreenshotsPaginated(start, end, nextPage, PAGE_SIZE);
      setScreenshots((prev) => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      currentPageRef.current = nextPage;
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, getDayRange]);

  useEffect(() => {
    if (!expanded) return;
    loadFirstPage();
  }, [date, expanded, loadFirstPage]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || loadingMore || !hasMore) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    if (scrollWidth - scrollLeft - clientWidth < 200) {
      loadMore();
    }
  }, [loadingMore, hasMore, loadMore]);

  const handleView = useCallback(async (id: number) => {
    setViewerId(id);
    setViewerData(null);
    setViewerLoading(true);
    try {
      const data = await getScreenshotData(id);
      setViewerData(data);
    } catch {
      setViewerId(null);
    } finally {
      setViewerLoading(false);
    }
  }, []);

  const currentIndex = viewerId != null
    ? screenshots.findIndex((s) => s.id === viewerId)
    : -1;

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      handleView(screenshots[currentIndex - 1].id);
    }
  }, [currentIndex, screenshots, handleView]);

  const handleNext = useCallback(() => {
    if (currentIndex < screenshots.length - 1) {
      handleView(screenshots[currentIndex + 1].id);
    } else if (hasMore && !loadingMore) {
      loadMore().then(() => {
        const nextIdx = currentIndex + 1;
        if (nextIdx < screenshots.length) {
          handleView(screenshots[nextIdx].id);
        }
      });
    }
  }, [currentIndex, screenshots, handleView, hasMore, loadingMore, loadMore]);

  useEffect(() => {
    if (viewerId == null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setViewerId(null);
        setViewerData(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewerId, handlePrev, handleNext]);

  if (!expanded) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--qp-text-tertiary)] hover:text-[var(--qp-text-secondary)] transition-colors"
        onClick={() => setExpanded(true)}
        title="View screenshots for this day"
      >
        <Camera size={13} />
        Screenshots
      </button>
    );
  }

  return (
    <div className="border-t border-[var(--qp-border)] mt-2 pt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-[var(--qp-text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
          <Camera size={12} />
          Screenshots
          {totalCount > 0 && (
            <span className="font-normal">({totalCount})</span>
          )}
        </span>
        <button
          type="button"
          className="text-[var(--qp-text-tertiary)] hover:text-[var(--qp-text-secondary)]"
          onClick={() => { setExpanded(false); setViewerId(null); setViewerData(null); }}
        >
          <X size={13} />
        </button>
      </div>

      {loading && (
        <div className="text-[10px] text-[var(--qp-text-tertiary)] py-2 flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" />
          Loading...
        </div>
      )}

      {!loading && totalCount === 0 && (
        <div className="text-[10px] text-[var(--qp-text-tertiary)] py-2 italic">
          No screenshots for this day. Enable in Settings → Tracking.
        </div>
      )}

      {!loading && totalCount > 0 && (
        <>
          {/* Thumbnails strip */}
          <div
            ref={scrollContainerRef}
            className="flex gap-1.5 overflow-x-auto pb-1"
            onScroll={handleScroll}
          >
            {screenshots.map((s) => (
              <LazyThumbnail
                key={s.id}
                screenshot={s}
                isActive={viewerId === s.id}
                onClick={() => handleView(s.id)}
              />
            ))}
            {loadingMore && (
              <div className="shrink-0 flex items-center justify-center w-[120px] text-[var(--qp-text-tertiary)]">
                <Loader2 size={16} className="animate-spin" />
              </div>
            )}
          </div>

          {hasMore && !loadingMore && (
            <div className="text-[10px] text-[var(--qp-text-tertiary)] mt-1 text-center">
              Scroll right to load more ({screenshots.length}/{totalCount})
            </div>
          )}

          {/* Full image viewer */}
          {viewerId != null && (
            <div className="relative mt-2 rounded overflow-hidden border border-[var(--qp-border)] bg-black/5">
              {viewerLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20">
                  <Loader2 size={24} className="animate-spin text-white" />
                </div>
              )}
              {viewerData && (
                <img
                  src={`data:image/webp;base64,${viewerData}`}
                  alt="Screenshot full view"
                  className="w-full h-auto max-h-[50vh] object-contain"
                />
              )}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <button
                  type="button"
                  className="px-2 py-1 rounded bg-black/50 text-white text-[10px] hover:bg-black/70 disabled:opacity-30"
                  disabled={currentIndex <= 0}
                  onClick={handlePrev}
                  title="Previous (←)"
                >
                  <ChevronLeft size={12} />
                </button>
                <span className="text-[10px] text-white bg-black/50 px-2 py-0.5 rounded">
                  {currentIndex + 1} / {totalCount}
                  {" · "}
                  {screenshots[currentIndex] && new Date(screenshots[currentIndex].capturedAt).toLocaleTimeString()}
                </span>
                <button
                  type="button"
                  className="px-2 py-1 rounded bg-black/50 text-white text-[10px] hover:bg-black/70 disabled:opacity-30"
                  disabled={currentIndex >= totalCount - 1}
                  onClick={handleNext}
                  title="Next (→)"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface LazyThumbnailProps {
  screenshot: ScreenshotEntry;
  isActive: boolean;
  onClick: () => void;
}

function LazyThumbnail({ screenshot, isActive, onClick }: LazyThumbnailProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { root: el.parentElement?.parentElement, threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      className={`shrink-0 rounded overflow-hidden border-2 transition-colors ${
        isActive
          ? "border-[var(--qp-accent)]"
          : "border-transparent hover:border-[var(--qp-border)]"
      }`}
      onClick={onClick}
      title={new Date(screenshot.capturedAt).toLocaleTimeString()}
    >
      {visible ? (
        <img
          src={`data:image/webp;base64,${screenshot.thumbnailBase64}`}
          alt={`Screenshot at ${new Date(screenshot.capturedAt).toLocaleTimeString()}`}
          className="block"
          style={{ width: "120px", height: "auto", aspectRatio: `${screenshot.width}/${screenshot.height}` }}
          loading="lazy"
        />
      ) : (
        <div
          className="bg-[var(--qp-bg-subtle)]"
          style={{ width: "120px", aspectRatio: `${screenshot.width}/${screenshot.height}` }}
        />
      )}
    </button>
  );
}
