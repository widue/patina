import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { UI_TEXT } from "../../../shared/copy/uiText.ts";
import {
  selectDataTrendDraftDate,
  startOfLocalDay,
  toLocalDateKey,
  type DataTrendPickerMode,
  type DataTrendRangeDraft,
  type DataTrendRangeSelection,
} from "../services/dataTrendRange.ts";
import {
  buildMondayFirstCalendarGrid,
} from "../../../shared/lib/localDate.ts";

interface Props {
  anchor: HTMLElement;
  mode: DataTrendPickerMode;
  onApply: (selection: DataTrendRangeSelection) => void;
  onClose: () => void;
  onDraftLabelChange: (label: string) => void;
}

function getPopoverPosition(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(236, window.innerWidth - 24);
  const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12);
  const estimatedHeight = 344;
  const top = rect.bottom + 8 + estimatedHeight <= window.innerHeight
    ? rect.bottom + 8
    : Math.max(12, rect.top - estimatedHeight - 8);
  return { left, top, width };
}

function getDraftLabel(draft: DataTrendRangeDraft) {
  return draft.range?.label ?? UI_TEXT.data.pickerModes[draft.mode];
}

function getDraftSummary(draft: DataTrendRangeDraft) {
  if (draft.range) return `${draft.range.startDateKey} - ${draft.range.endDateKey}`;
  if (draft.mode === "custom" && draft.firstDateKey) return UI_TEXT.data.pickEndDate;
  return draft.mode === "custom" ? UI_TEXT.data.pickStartDate : UI_TEXT.data.pickDate;
}

export default function DataTrendRangePicker({ anchor, mode, onApply, onClose, onDraftLabelChange }: Props) {
  const [draft, setDraft] = useState<DataTrendRangeDraft>({
    mode,
    firstDateKey: null,
    range: null,
  });
  const [calendarMonth, setCalendarMonth] = useState(() => startOfLocalDay(new Date()));
  const [position, setPosition] = useState(() => getPopoverPosition(anchor));
  const today = startOfLocalDay(new Date());
  const calendarDays = useMemo(() => buildMondayFirstCalendarGrid(calendarMonth), [calendarMonth]);
  const canGoNextMonth = calendarMonth.getFullYear() < today.getFullYear()
    || calendarMonth.getMonth() < today.getMonth();

  useEffect(() => {
    const updatePosition = () => setPosition(getPopoverPosition(anchor));
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !anchor.parentElement?.contains(target) && !document.querySelector(".data-range-picker")?.contains(target)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchor, onClose]);

  useEffect(() => {
    setDraft({ mode, firstDateKey: null, range: null });
  }, [mode]);

  useEffect(() => {
    onDraftLabelChange(getDraftLabel(draft));
  }, [draft, onDraftLabelChange]);

  return createPortal((
    <section
      className="data-range-picker"
      style={{ left: position.left, top: position.top, width: position.width }}
      role="dialog"
      aria-label={UI_TEXT.data.rangePickerTitle}
    >
      <header className="data-range-picker-header">
        <strong>{getDraftSummary(draft)}</strong>
      </header>

      <div className="data-range-picker-month">
        <button
          type="button"
          className="qp-control data-range-picker-arrow"
          onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
          aria-label={UI_TEXT.accessibility.data.previousPickerMonth}
        >
          <ChevronLeft size={14} />
        </button>
        <strong>{UI_TEXT.date.yearMonthLabel(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1)}</strong>
        <button
          type="button"
          className="qp-control data-range-picker-arrow"
          disabled={!canGoNextMonth}
          onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
          aria-label={UI_TEXT.accessibility.data.nextPickerMonth}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="data-range-picker-grid data-range-picker-weekdays">
        {UI_TEXT.date.weekdaysShort.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className="data-range-picker-grid">
        {calendarDays.map((date) => {
          const dateKey = toLocalDateKey(date);
          const isFuture = date > today;
          const isOutsideMonth = date.getMonth() !== calendarMonth.getMonth();
          const isInRange = Boolean(
            draft.range
            && dateKey >= draft.range.startDateKey
            && dateKey <= draft.range.endDateKey,
          );
          const isBoundary = dateKey === draft.range?.startDateKey
            || dateKey === draft.range?.endDateKey
            || dateKey === draft.firstDateKey;
          return (
            <button
              key={dateKey}
              type="button"
              className={[
                "data-range-picker-day",
                isOutsideMonth ? "data-range-picker-day-muted" : "",
                isInRange ? "data-range-picker-day-in-range" : "",
                isBoundary ? "data-range-picker-day-selected" : "",
              ].filter(Boolean).join(" ")}
              disabled={isFuture}
              data-range-picker-date={dateKey}
              onClick={() => setDraft((current) => selectDataTrendDraftDate(current, dateKey))}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {draft.mode === "custom" && draft.range && draft.range.dayCount < 7 ? (
        <p className="data-range-picker-hint">{UI_TEXT.data.shortRangeHint}</p>
      ) : null}

      <footer className="data-range-picker-footer">
        <button type="button" className="qp-button-secondary data-range-picker-action" onClick={onClose}>{UI_TEXT.common.cancel}</button>
        <button
          type="button"
          className="qp-button-primary data-range-picker-action"
          disabled={!draft.range}
          onClick={() => {
            if (draft.range) onApply(draft.range.selection);
          }}
        >
          {UI_TEXT.data.applyRange}
        </button>
      </footer>
    </section>
  ), document.body);
}
