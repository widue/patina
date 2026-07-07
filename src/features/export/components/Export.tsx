import { ArrowDownToLine, FileDown, Loader2, ListOrdered } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import QuietPageHeader from "../../../shared/components/QuietPageHeader";
import type { QuietToastTone } from "../../../shared/components/QuietToast";
import { UI_TEXT } from "../../../shared/copy/index";
import {
  countInclusiveDays,
  getPresetDateInputs,
  resolveExportTimeRange,
  type ExportFormat,
  type TimeRangePreset,
} from "../services/exportRange";
import { exportData, pickExportSaveFile, EXPORT_FIELD_KEYS } from "../services/exportService";
import ExportFieldConfigDialog from "./ExportFieldConfigDialog";

interface Props {
  onToast?: (message: string, tone?: QuietToastTone) => void;
  embedded?: boolean;
}

function getRecommendation(
  preset: TimeRangePreset,
  customStart: string,
  customEnd: string,
): { format: ExportFormat; label: string } | null {
  if (preset === "today") {
    return { format: "csv", label: UI_TEXT.export.recommendationDaily };
  }
  if (preset === "thisWeek" || preset === "thisMonth") {
    return { format: "sqlite", label: UI_TEXT.export.recommendationMonthly };
  }
  if (preset === "thisYear") {
    return { format: "parquet", label: UI_TEXT.export.recommendationYearly };
  }
  if (preset === "custom" && customStart && customEnd) {
    const days = countInclusiveDays(customStart, customEnd);
    if (days === null) return null;
    if (days <= 3) {
      return { format: "csv", label: UI_TEXT.export.recommendationCustomShort };
    }
    if (days >= 365) {
      return { format: "parquet", label: UI_TEXT.export.recommendationCustomLong };
    }
    if (days >= 30) {
      return { format: "sqlite", label: UI_TEXT.export.recommendationCustomMedium };
    }
    return { format: "csv", label: UI_TEXT.export.recommendationCustomShort };
  }
  return null;
}

const FORMAT_INFO: { format: ExportFormat; label: string; hint: string }[] = [
  { format: "csv", label: UI_TEXT.export.formatCSV, hint: UI_TEXT.export.formatCSVHint },
  { format: "sqlite", label: UI_TEXT.export.formatSQLite, hint: UI_TEXT.export.formatSQLiteHint },
  { format: "parquet", label: UI_TEXT.export.formatParquet, hint: UI_TEXT.export.formatParquetHint },
];

export default function Export({ onToast, embedded }: Props) {
  const [timePreset, setTimePreset] = useState<TimeRangePreset>("thisMonth");
  const [customRange, setCustomRange] = useState(() => getPresetDateInputs("thisMonth"));
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [exportPath, setExportPath] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([...EXPORT_FIELD_KEYS]);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const customStart = customRange.startDateKey;
  const customEnd = customRange.endDateKey;

  const recommendation = useMemo(
    () => getRecommendation(timePreset, customStart, customEnd),
    [timePreset, customStart, customEnd],
  );
  const resolvedTimeRange = useMemo(
    () => resolveExportTimeRange({ preset: timePreset, customStart, customEnd }),
    [timePreset, customStart, customEnd],
  );
  const timeRangeErrorMessage = resolvedTimeRange.error === "missingCustomRange"
    ? UI_TEXT.export.timeRangeMissing
    : resolvedTimeRange.error === "invalidCustomRange"
      ? UI_TEXT.export.timeRangeInvalid
      : null;

  const handlePresetChange = useCallback((preset: TimeRangePreset) => {
    setTimePreset(preset);
    setExportResult(null);
    if (preset !== "custom") {
      setCustomRange(getPresetDateInputs(preset));
    }
  }, []);

  const handlePickPath = useCallback(async () => {
    const path = await pickExportSaveFile(format, exportPath || undefined);
    if (path) {
      setExportPath(path);
      setExportResult(null);
    }
  }, [format, exportPath]);

  const handleExport = useCallback(async () => {
    if (!exportPath) return;
    if (selectedFields.length === 0) {
      setExportResult({ ok: false, message: UI_TEXT.export.configFieldsEmpty });
      onToast?.(UI_TEXT.export.configFieldsEmpty, "warning");
      return;
    }
    if (timeRangeErrorMessage) {
      setExportResult({ ok: false, message: timeRangeErrorMessage });
      onToast?.(timeRangeErrorMessage, "warning");
      return;
    }
    setExporting(true);
    setExportResult(null);
    try {
      const result = await exportData({
        format,
        outputPath: exportPath,
        startTime: resolvedTimeRange.startTime,
        endTime: resolvedTimeRange.endTime,
        selectedFields,
      });
      const message = `${UI_TEXT.export.exportDone(result.rowCount)}`;
      setExportResult({ ok: true, message });
      onToast?.(message, "success");
    } catch (error) {
      const msg = `${UI_TEXT.export.exportFailed}: ${error}`;
      setExportResult({ ok: false, message: msg });
      onToast?.(msg, "warning");
    } finally {
      setExporting(false);
    }
  }, [exportPath, format, onToast, resolvedTimeRange.endTime, resolvedTimeRange.startTime, selectedFields, timeRangeErrorMessage]);

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 md:gap-5">
      {!embedded && (
        <QuietPageHeader
          icon={<ArrowDownToLine size={18} />}
          title={UI_TEXT.export.title}
          subtitle={UI_TEXT.export.subtitle}
        />
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        <div className="grid grid-cols-1 gap-4 md:gap-5">

          {/* Time Range */}
          <div className="qp-panel rounded-[12px] p-4 md:p-5">
            <p className="text-sm font-semibold text-[var(--qp-text-primary)] mb-3">
              {UI_TEXT.export.timeRangeLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              {(["today", "thisWeek", "thisMonth", "thisYear", "custom"] as TimeRangePreset[]).map(
                (preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetChange(preset)}
                    disabled={exporting}
                    className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ring-1 ring-inset ${
                      timePreset === preset
                        ? "bg-[var(--qp-accent-muted)] text-[var(--qp-accent-default)] ring-[var(--qp-accent-default)]/30"
                        : "bg-[var(--qp-bg-elevated)] text-[var(--qp-text-secondary)] hover:text-[var(--qp-text-primary)] ring-[var(--qp-border-subtle)] hover:ring-[var(--qp-border-strong)]"
                    }`}
                  >
                    {UI_TEXT.export[`timeRangePreset${preset.charAt(0).toUpperCase() + preset.slice(1)}` as keyof typeof UI_TEXT.export] as string}
                  </button>
                ),
              )}
            </div>
            {timePreset === "custom" && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--qp-text-tertiary)]">{UI_TEXT.export.timeRangeCustomStart}</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => {
                      setCustomRange((prev) => ({ ...prev, startDateKey: e.target.value }));
                      setExportResult(null);
                    }}
                    disabled={exporting}
                    className="qp-input rounded-[8px] px-2 py-1 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--qp-text-tertiary)]">{UI_TEXT.export.timeRangeCustomEnd}</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => {
                      setCustomRange((prev) => ({ ...prev, endDateKey: e.target.value }));
                      setExportResult(null);
                    }}
                    disabled={exporting}
                    className="qp-input rounded-[8px] px-2 py-1 text-xs"
                  />
                </div>
              </div>
            )}
            {timeRangeErrorMessage && (
              <p className="mt-2 text-xs text-[var(--qp-danger)]">{timeRangeErrorMessage}</p>
            )}
          </div>

          {/* Format Selection */}
          <div className="qp-panel rounded-[12px] p-4 md:p-5">
            <p className="text-sm font-semibold text-[var(--qp-text-primary)] mb-3">
              {UI_TEXT.export.formatLabel}
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {FORMAT_INFO.map(({ format: fmt, label, hint }) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => { setFormat(fmt); setExportResult(null); }}
                  disabled={exporting}
                    className={`block w-full border rounded-[10px] p-3 text-left transition-colors disabled:opacity-50 ${
                    format === fmt
                      ? "border-[var(--qp-accent-default)] bg-[var(--qp-accent-muted)]"
                      : "border-[var(--qp-border-subtle)] bg-[var(--qp-bg-elevated)] hover:border-[var(--qp-border-strong)]"
                  }`}
                >
                  <p className="text-sm font-semibold text-[var(--qp-text-primary)]">{label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--qp-text-tertiary)]">{hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          {recommendation && (
            <div className="qp-panel rounded-[12px] p-4 md:p-5 border border-[var(--qp-accent-default)]/20 bg-[var(--qp-accent-muted)]/50">
              <p className="text-xs font-semibold text-[var(--qp-accent-default)] uppercase tracking-[0.06em] mb-1">
                {UI_TEXT.export.recommendationTitle}
              </p>
              <p className="text-sm text-[var(--qp-text-secondary)]">{recommendation.label}</p>
            </div>
          )}

          {/* Fields config */}
          <div className="qp-panel rounded-[12px] p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--qp-text-primary)]">
                  {UI_TEXT.export.configFields}
                </p>
                <p className={`text-xs mt-0.5 ${
                  selectedFields.length === 0
                    ? "text-[var(--qp-danger)]"
                    : "text-[var(--qp-text-tertiary)]"
                }`}>
                  {UI_TEXT.export.configFieldsCount(selectedFields.length, 11)}
                </p>
                {selectedFields.length === 0 && (
                  <p className="mt-1 text-xs text-[var(--qp-danger)]">{UI_TEXT.export.configFieldsEmpty}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowFieldConfig(true)}
                disabled={exporting}
                className="qp-button-secondary rounded-[8px] px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <ListOrdered size={14} />
                {UI_TEXT.export.configFields}
              </button>
            </div>
          </div>

          {/* Export Action */}
          <div className="qp-panel rounded-[12px] p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <FileDown size={14} className="text-[var(--qp-text-tertiary)] shrink-0" />
                  <input
                    value={exportPath}
                    onChange={(e) => { setExportPath(e.target.value); setExportResult(null); }}
                    placeholder={UI_TEXT.export.pathPlaceholder}
                    disabled={exporting}
                    className="qp-input flex-1 min-w-0 px-2 py-1.5 text-sm rounded-[8px]"
                  />
                  <button
                    type="button"
                    onClick={() => void handlePickPath()}
                    disabled={exporting}
                    className="qp-button-secondary shrink-0 rounded-[8px] px-3 py-1.5 text-xs font-semibold"
                  >
                    {UI_TEXT.export.browse}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={exporting || !exportPath || selectedFields.length === 0 || Boolean(timeRangeErrorMessage)}
                className="qp-button-primary rounded-[8px] px-4 py-1.5 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {exporting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {UI_TEXT.export.exporting}
                  </>
                ) : (
                  UI_TEXT.export.exportAction
                )}
              </button>
            </div>
            {exportResult && (
              <p className={`mt-3 text-sm leading-relaxed ${exportResult.ok ? "text-[var(--qp-success)]" : "text-[var(--qp-danger)]"}`}>
                {exportResult.message}
              </p>
            )}
          </div>

        </div>
      </div>

      <ExportFieldConfigDialog
        open={showFieldConfig}
        selectedFields={selectedFields}
        uiText={UI_TEXT}
        onClose={() => setShowFieldConfig(false)}
        onConfirm={(fields) => {
          setSelectedFields(fields);
          setExportResult(null);
          setShowFieldConfig(false);
        }}
      />
    </div>
  );
}
