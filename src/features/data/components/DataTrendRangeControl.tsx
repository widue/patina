import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { UI_TEXT } from "../../../shared/copy/uiText.ts";
import {
  DATA_ROLLING_TREND_RANGES,
  DATA_TREND_PICKER_MODES,
  resolveDataTrendRange,
  type DataTrendPickerMode,
  type DataTrendRangeSelection,
} from "../services/dataTrendRange.ts";
import DataTrendRangePicker from "./DataTrendRangePicker.tsx";

interface Props {
  ariaLabel: string;
  selection: DataTrendRangeSelection;
  onChange: (selection: DataTrendRangeSelection) => void;
}

export default function DataTrendRangeControl({ ariaLabel, selection, onChange }: Props) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<DataTrendPickerMode>("custom");
  const [pickerLabel, setPickerLabel] = useState(UI_TEXT.data.pickerModes.custom);
  const rollingIndex = selection.kind === "rolling"
    ? DATA_ROLLING_TREND_RANGES.indexOf(selection.days)
    : -1;
  const isSpecial = selection.kind !== "rolling";
  const label = resolveDataTrendRange(selection).label;
  const pickerModeIndex = DATA_TREND_PICKER_MODES.indexOf(pickerMode);

  const selectAdjacent = (delta: number) => {
    if (open) {
      const mode = DATA_TREND_PICKER_MODES[pickerModeIndex + delta];
      if (mode) setPickerMode(mode);
      return;
    }
    if (isSpecial) {
      onChange({ kind: "rolling", days: 7 });
      return;
    }
    const days = DATA_ROLLING_TREND_RANGES[rollingIndex + delta];
    if (days) onChange({ kind: "rolling", days });
  };

  return (
    <div className="data-heatmap-range-control" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={() => selectAdjacent(-1)}
        disabled={open ? pickerModeIndex === 0 : !isSpecial && rollingIndex === 0}
        className="qp-control data-heatmap-range-arrow"
        aria-label={open
          ? UI_TEXT.accessibility.data.previousPickerMode
          : isSpecial ? UI_TEXT.accessibility.data.resetTrendRange : UI_TEXT.accessibility.data.shorterTrendRange}
      >
        <ChevronLeft size={14} />
      </button>
      <span
        ref={anchorRef}
        role="button"
        tabIndex={0}
        className="qp-status data-heatmap-range-label data-trend-range-label data-trend-range-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={UI_TEXT.accessibility.data.openTrendRangePicker}
        onClick={() => {
          setPickerMode("custom");
          setPickerLabel(UI_TEXT.data.pickerModes.custom);
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setPickerMode("custom");
            setPickerLabel(UI_TEXT.data.pickerModes.custom);
            setOpen((current) => !current);
          }
        }}
      >
        {open ? pickerLabel : label}
      </span>
      <button
        type="button"
        onClick={() => selectAdjacent(1)}
        disabled={open ? pickerModeIndex === DATA_TREND_PICKER_MODES.length - 1 : !isSpecial && rollingIndex === DATA_ROLLING_TREND_RANGES.length - 1}
        className="qp-control data-heatmap-range-arrow"
        aria-label={open
          ? UI_TEXT.accessibility.data.nextPickerMode
          : isSpecial ? UI_TEXT.accessibility.data.resetTrendRange : UI_TEXT.accessibility.data.longerTrendRange}
      >
        <ChevronRight size={14} />
      </button>
      {open && anchorRef.current ? (
        <DataTrendRangePicker
          anchor={anchorRef.current}
          mode={pickerMode}
          onDraftLabelChange={setPickerLabel}
          onClose={() => setOpen(false)}
          onApply={(nextSelection) => {
            onChange(nextSelection);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
