import { GripVertical, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UI_TEXT } from "../../../shared/copy/index";
import { SHARED_FIELDS, SESSION_FIELDS, WEB_FIELDS } from "../services/exportService";

const HEADER_SESSION = "__header_session";
const HEADER_WEB = "__header_web";

const DEFAULT_ORDER: string[] = [
  ...SHARED_FIELDS,
  HEADER_SESSION,
  ...SESSION_FIELDS,
  HEADER_WEB,
  ...WEB_FIELDS,
];

const HEADER_SET = new Set([HEADER_SESSION, HEADER_WEB]);

function isHeader(k: string) {
  return HEADER_SET.has(k);
}

interface Props {
  open: boolean;
  selectedFields: string[];
  uiText: typeof UI_TEXT;
  onClose: () => void;
  onConfirm: (fields: string[]) => void;
}

const AUTO_SCROLL_SPEED = 8;
const AUTO_SCROLL_EDGE = 30;
const DRAG_THRESHOLD = 4;

export default function ExportFieldConfigDialog({ open, selectedFields, uiText, onClose, onConfirm }: Props) {
  const t = uiText.export;
  const [fields, setFields] = useState<string[]>(() => buildInitial(selectedFields));
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragState = useRef<{
    fromIdx: number;
    startY: number;
    pointerId: number;
    started: boolean;
    lastClientY: number;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setFields(buildInitial(selectedFields));
      setDraggingIndex(null);
      setDragOverIndex(null);
      dragState.current = null;
    }
  }, [open, selectedFields]);

  // ---- auto-scroll ----
  const autoScrollRef = useRef<number | null>(null);
  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  const tickAutoScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const state = dragState.current;
    if (!state || !state.started) return;
    const y = state.lastClientY ?? 0;
    const rel = y - rect.top;
    let scroll = 0;
    if (rel < AUTO_SCROLL_EDGE && el.scrollTop > 0) {
      scroll = -AUTO_SCROLL_SPEED;
    } else if (rel > rect.height - AUTO_SCROLL_EDGE && el.scrollTop < el.scrollHeight - el.clientHeight) {
      scroll = AUTO_SCROLL_SPEED;
    }
    if (scroll !== 0) {
      el.scrollTop += scroll;
    }
    autoScrollRef.current = requestAnimationFrame(tickAutoScroll);
  }, []);

  const startAutoScroll = useCallback(() => {
    stopAutoScroll();
    autoScrollRef.current = requestAnimationFrame(tickAutoScroll);
  }, [stopAutoScroll, tickAutoScroll]);

  // ---- compute drop index from cursor Y ----
  const getDropIndex = useCallback((clientY: number): number => {
    const container = containerRef.current;
    if (!container) return 0;
    for (let i = 0; i < fields.length; i++) {
      const key = fields[i];
      const el = itemElsRef.current.get(key);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return i;
      }
    }
    return fields.length;
  }, [fields]);

  // ---- clamped reorder ----
  const clampTarget = useCallback((fromIdx: number, to: number): number => {
    const moved = fields[fromIdx];
    if (isHeader(moved)) return fromIdx;

    const isSession = SESSION_FIELDS.includes(moved as any);
    const isWeb = WEB_FIELDS.includes(moved as any);

    // After removing fields[fromIdx], remaining list:
    const remaining = fields.filter((_, i) => i !== fromIdx);

    // "to" is in the original list's index space. Convert to "remaining" space.
    let target = fromIdx < to ? to - 1 : to;

    // Clamp: session fields must stay before WEB header
    if (isSession) {
      const webIdx = remaining.findIndex((k) => k === HEADER_WEB);
      if (webIdx >= 0 && target > webIdx) target = webIdx;
    }

    // Clamp: web fields must stay after SESSION header
    if (isWeb) {
      const sessIdx = remaining.findIndex((k) => k === HEADER_SESSION);
      const webIdx = remaining.findIndex((k) => k === HEADER_WEB);
      if (sessIdx >= 0 && target <= sessIdx) target = Math.max(webIdx, webIdx >= 0 ? webIdx : 0) + 1;
      if (webIdx >= 0 && target < webIdx) target = webIdx + 1;
    }

    // Clamp: shared fields (not session, not web) – stay at top, before session header
    if (!isSession && !isWeb && !isHeader(moved)) {
      const sessIdx = remaining.findIndex((k) => k === HEADER_SESSION);
      if (sessIdx >= 0 && target > sessIdx) target = sessIdx;
      if (target < 0) target = 0;
    }

    return Math.min(Math.max(0, target), remaining.length);
  }, [fields]);

  // ---- document-level pointer events ----
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const state = dragState.current;
      if (!state || state.pointerId !== e.pointerId) return;

      if (!state.started) {
        if (Math.abs(e.clientY - state.startY) < DRAG_THRESHOLD) return;
        state.started = true;
        setDraggingIndex(state.fromIdx);
        setDragOverIndex(state.fromIdx);
        startAutoScroll();
      }

      state.lastClientY = e.clientY;
      const to = getDropIndex(e.clientY);
      setDragOverIndex(to);
    };

    const onUp = (e: PointerEvent) => {
      const state = dragState.current;
      if (!state || state.pointerId !== e.pointerId) return;

      stopAutoScroll();
      dragState.current = null;

      if (!state.started) {
        setDraggingIndex(null);
        setDragOverIndex(null);
        return;
      }

      const to = getDropIndex(e.clientY);
      setDraggingIndex(null);
      setDragOverIndex(null);

      const clampedTo = clampTarget(state.fromIdx, to);
      if (clampedTo === state.fromIdx) return;

      setFields((prev) => {
        const next = prev.filter((_, i) => i !== state!.fromIdx);
        next.splice(clampedTo, 0, prev[state!.fromIdx]);
        return next;
      });
    };

    const onCancel = () => {
      const state = dragState.current;
      if (!state) return;
      stopAutoScroll();
      dragState.current = null;
      setDraggingIndex(null);
      setDragOverIndex(null);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      stopAutoScroll();
    };
  }, [getDropIndex, clampTarget, startAutoScroll, stopAutoScroll]);

  const handlePointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    if (isHeader(fields[idx])) return;
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture?.(e.pointerId);
    dragState.current = {
      fromIdx: idx,
      startY: e.clientY,
      pointerId: e.pointerId,
      started: false,
      lastClientY: e.clientY,
    };
  }, [fields]);

  const handleRemove = useCallback((idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const setItemRef = useCallback((key: string) => (el: HTMLDivElement | null) => {
    if (el) {
      itemElsRef.current.set(key, el);
    } else {
      itemElsRef.current.delete(key);
    }
  }, []);

  const handleReset = () => {
    setFields([...DEFAULT_ORDER]);
  };

  const handleConfirm = () => {
    onConfirm(fields.filter((k) => !isHeader(k)));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="qp-panel rounded-[16px] w-full max-w-lg mx-4 max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--qp-border-subtle)]">
          <h2 className="text-base font-semibold text-[var(--qp-text-primary)]">{t.configFieldsTitle}</h2>
          <button type="button" onClick={onClose} className="qp-button-ghost rounded-[8px] p-1">
            <X size={16} />
          </button>
        </div>

        <p className="px-5 pt-2 pb-1 text-xs text-[var(--qp-text-tertiary)]">{t.configFieldsHint}</p>

        <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3">
          {fields.map((key, idx) => {
            if (isHeader(key)) {
              const label = key === HEADER_SESSION ? t.groupApps : t.groupWeb;
              const mt = idx > 0 ? "mt-3" : "mt-0";
              return (
                <div key={key} className={`flex items-center gap-2 px-1 ${mt}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--qp-text-tertiary)]">
                    {label}
                  </p>
                  <div className="flex-1 h-px bg-[var(--qp-border-subtle)]" />
                </div>
              );
            }

            const field = (t.fields as Record<string, { label: string; desc: string }>)[key];
            if (!field) return null;
            const isDragging = draggingIndex === idx;
            const showInsertBefore =
              dragOverIndex === idx && draggingIndex !== null && draggingIndex !== idx;

            return (
              <div key={key} className="relative">
                {/* Insertion line */}
                <div
                  className={`absolute left-0 right-0 top-0 h-[2px] rounded-full z-10 pointer-events-none transition-all duration-200 ease-out ${
                    showInsertBefore ? "opacity-100 scale-x-100" : "opacity-0 scale-x-95"
                  }`}
                  style={{
                    backgroundColor: "var(--qp-accent-default)",
                    transform: showInsertBefore
                      ? "translateY(-50%) scaleX(1)"
                      : "translateY(-50%) scaleX(0.9)",
                    boxShadow: showInsertBefore
                      ? "0 0 12px 2px rgba(99, 102, 241, 0.35)"
                      : "none",
                  }}
                />
                <div
                  ref={setItemRef(key)}
                  onPointerDown={(e) => handlePointerDown(e, idx)}
                  className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 cursor-grab active:cursor-grabbing select-none transition-all duration-150 touch-none mt-1.5 ${
                    isDragging
                      ? "bg-[var(--qp-accent-muted)] border-[var(--qp-accent-default)]/50 scale-[0.98] opacity-80 shadow-lg z-20 relative"
                      : "bg-[var(--qp-bg-elevated)] border-[var(--qp-border-subtle)] hover:border-[var(--qp-border-strong)]"
                  }`}
                >
                  <GripVertical size={14} className="shrink-0 text-[var(--qp-text-tertiary)] pointer-events-none" />
                  <div className="flex-1 min-w-0 pointer-events-none">
                    <p className="text-xs font-medium text-[var(--qp-text-primary)]">{field.label}</p>
                    <p className="text-[11px] text-[var(--qp-text-tertiary)] truncate">{field.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="shrink-0 rounded-[6px] p-1 text-[var(--qp-text-tertiary)] hover:text-[var(--qp-danger)] hover:bg-[var(--qp-danger)]/10 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Insertion line after the last item */}
          <div className="relative mt-1.5">
            <div
              className={`absolute left-0 right-0 top-0 h-[2px] rounded-full z-10 pointer-events-none transition-all duration-200 ease-out ${
                dragOverIndex === fields.length && draggingIndex !== null && fields.length > 0
                  ? "opacity-100"
                  : "opacity-0"
              }`}
              style={{
                backgroundColor: "var(--qp-accent-default)",
                transform:
                  dragOverIndex === fields.length && draggingIndex !== null && fields.length > 0
                    ? "translateY(-50%) scaleX(1)"
                    : "translateY(-50%) scaleX(0.9)",
                boxShadow:
                  dragOverIndex === fields.length && draggingIndex !== null && fields.length > 0
                    ? "0 0 12px 2px rgba(99, 102, 241, 0.35)"
                    : "none",
              }}
            />
          </div>

          {/* Empty placeholder */}
          <div className="flex items-center gap-2 rounded-[10px] border border-dashed border-[var(--qp-border-subtle)] px-3 py-2 pointer-events-none mt-1.5">
            <div className="w-3.5 shrink-0" />
            <p className="text-xs text-[var(--qp-text-tertiary)] italic">
              <span className="opacity-50">+</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 pb-5 pt-3 border-t border-[var(--qp-border-subtle)]">
          <button
            type="button"
            onClick={handleReset}
            className="qp-button-ghost rounded-[8px] px-3 py-1.5 text-xs font-semibold text-[var(--qp-text-secondary)]"
          >
            {t.configFieldsReset}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="qp-button-secondary rounded-[8px] px-4 py-1.5 text-xs font-semibold"
            >
              {uiText.dialog.cancel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="qp-button-primary rounded-[8px] px-4 py-1.5 text-xs font-semibold"
            >
              {uiText.dialog.confirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildInitial(selectedFields: string[]): string[] {
  const sel = new Set(selectedFields);
  const out: string[] = [];

  // Shared fields (always at top)
  for (const f of SHARED_FIELDS) {
    if (sel.has(f)) out.push(f);
  }

  // Session-specific
  const hasSession = SESSION_FIELDS.some((f) => sel.has(f));
  if (hasSession) {
    out.push(HEADER_SESSION);
    for (const f of SESSION_FIELDS) {
      if (sel.has(f)) out.push(f);
    }
  }

  // Web-specific
  const hasWeb = WEB_FIELDS.some((f) => sel.has(f));
  if (hasWeb) {
    out.push(HEADER_WEB);
    for (const f of WEB_FIELDS) {
      if (sel.has(f)) out.push(f);
    }
  }

  return out;
}
