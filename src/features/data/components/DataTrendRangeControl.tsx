import { useRef, useState } from "react";
import QuietRangeControl from "../../../shared/components/QuietRangeControl.tsx";
import { UI_TEXT } from "../../../shared/copy/index.ts";
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
  const anchorRef = useRef<HTMLButtonElement | null>(null);
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
    <>
      <QuietRangeControl
        ref={anchorRef}
        className="data-trend-range-control"
        labelClassName="data-trend-range-label data-trend-range-trigger"
        ariaLabel={ariaLabel}
        label={open ? pickerLabel : label}
        labelAriaLabel={UI_TEXT.accessibility.data.openTrendRangePicker}
        previousAriaLabel={open
          ? UI_TEXT.accessibility.data.previousPickerMode
          : isSpecial ? UI_TEXT.accessibility.data.resetTrendRange : UI_TEXT.accessibility.data.shorterTrendRange}
        nextAriaLabel={open
          ? UI_TEXT.accessibility.data.nextPickerMode
          : isSpecial ? UI_TEXT.accessibility.data.resetTrendRange : UI_TEXT.accessibility.data.longerTrendRange}
        previousDisabled={open ? pickerModeIndex === 0 : !isSpecial && rollingIndex === 0}
        nextDisabled={open ? pickerModeIndex === DATA_TREND_PICKER_MODES.length - 1 : !isSpecial && rollingIndex === DATA_ROLLING_TREND_RANGES.length - 1}
        expanded={open}
        onPrevious={() => selectAdjacent(-1)}
        onNext={() => selectAdjacent(1)}
        onLabelClick={() => {
          setPickerMode("custom");
          setPickerLabel(UI_TEXT.data.pickerModes.custom);
          setOpen((current) => !current);
        }}
      />
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
    </>
  );
}
