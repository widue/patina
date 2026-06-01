import { type CSSProperties, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Clock3, Search } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { UI_TEXT } from "../../../shared/copy/uiText.ts";
import {
  buildDataAppTrendViewModel,
  buildDataTrendViewModel,
  buildActivityHeatmap,
  buildYearOptions,
  getCachedDataHeatmapSessions,
  getCachedEarliestSessionStartTime,
  type DataAppOption,
  type DataAppTrendViewModel,
  type AggregateSessionRecord,
  type HeatmapSelection,
  loadDataHeatmapSnapshot,
} from "../services/dataReadModel.ts";
import QuietChartTooltip from "../../../shared/components/QuietChartTooltip";
import QuietPageHeader from "../../../shared/components/QuietPageHeader";
import QuietTooltip from "../../../shared/components/QuietTooltip";
import type { TrackerHealthSnapshot } from "../../../shared/types/tracking";
import {
  formatChartHours,
  formatDuration,
} from "../../history/services/historyFormatting";
import { resolveTrendDateFromChartEvent } from "../services/dataChartInteraction.ts";
import type { DataTrendSnapshot } from "../services/dataTrendSnapshot.ts";
import type { DataTrendRangeSelection } from "../services/dataTrendRange.ts";
import { useDataTrendSnapshot } from "../hooks/useDataTrendSnapshot.ts";
import DataTrendRangeControl from "./DataTrendRangeControl.tsx";

interface Props {
  icons: Record<string, string>;
  refreshKey?: number;
  trackerHealth: TrackerHealthSnapshot;
  loadDataTrendSnapshot: (selection: DataTrendRangeSelection, nowMs?: number) => Promise<DataTrendSnapshot>;
  mappingVersion?: number;
  onOpenHistoryDate?: (dateKey: string) => void;
}

function getAppInitial(appName: string) {
  const trimmed = appName.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

function getDataAppOptionDisplayKey(app: DataAppOption) {
  return `${app.appName.trim().toLowerCase().replace(/\s+/g, " ")}|${app.exeName.trim().toLowerCase()}`;
}

function dedupeDataAppOptions(options: DataAppOption[]) {
  const merged = new Map<string, DataAppOption>();

  for (const app of options) {
    const key = getDataAppOptionDisplayKey(app);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, { ...app });
      continue;
    }

    existing.totalDuration += app.totalDuration;
    existing.percentage += app.percentage;
    existing.averageDuration += app.averageDuration;
    existing.activeDayCount = Math.max(existing.activeDayCount, app.activeDayCount);
  }

  return Array.from(merged.values()).sort((left, right) => right.totalDuration - left.totalDuration);
}

const DATA_TREND_X_AXIS_MIN_TICK_GAP = 24;

export default function Data({
  icons,
  refreshKey = 0,
  loadDataTrendSnapshot,
  mappingVersion = 0,
  onOpenHistoryDate,
}: Props) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const [selectedTrendRange, setSelectedTrendRange] = useState<DataTrendRangeSelection>({ kind: "rolling", days: 7 });
  const [selectedAppTrendRange, setSelectedAppTrendRange] = useState<DataTrendRangeSelection>({ kind: "rolling", days: 7 });
  const [selectedAppKey, setSelectedAppKey] = useState<string | null>(null);
  const [appSearchQuery, setAppSearchQuery] = useState("");
  const initialCachedHeatmapSessions = getCachedDataHeatmapSessions("recent", Date.now());
  const overviewTrend = useDataTrendSnapshot({
    selection: selectedTrendRange,
    refreshKey,
    loadSnapshot: loadDataTrendSnapshot,
  });
  const appTrend = useDataTrendSnapshot({
    selection: selectedAppTrendRange,
    refreshKey,
    loadSnapshot: loadDataTrendSnapshot,
  });
  const [selectedHeatmapView, setSelectedHeatmapView] = useState<HeatmapSelection>("recent");
  const [earliestStartTime, setEarliestStartTime] = useState<number | null>(
    getCachedEarliestSessionStartTime() ?? null,
  );
  const [yearSessions, setYearSessions] = useState<AggregateSessionRecord[]>(
    () => initialCachedHeatmapSessions ?? [],
  );
  const [yearSessionsView, setYearSessionsView] = useState<HeatmapSelection | null>(
    initialCachedHeatmapSessions ? "recent" : null,
  );
  const [heatmapLoading, setHeatmapLoading] = useState(!initialCachedHeatmapSessions);
  const nowMs = overviewTrend.nowMs;
  const lastAppTrendViewModelRef = useRef<{
    refreshKey: number;
    viewModel: DataAppTrendViewModel;
  } | null>(null);
  const hasFetchedHeatmapOnceRef = useRef(Boolean(initialCachedHeatmapSessions));
  const activeTrendDateRef = useRef<string | null>(null);
  const activeAppTrendDateRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadYear = async () => {
      const nowForRange = Date.now();
      const cachedSessions = getCachedDataHeatmapSessions(selectedHeatmapView, nowForRange);

      if (cachedSessions) {
        setYearSessions(cachedSessions);
        setYearSessionsView(selectedHeatmapView);
        hasFetchedHeatmapOnceRef.current = true;
        setHeatmapLoading(false);
      } else {
        setHeatmapLoading(true);
      }

      try {
        const snapshot = await loadDataHeatmapSnapshot(selectedHeatmapView, nowForRange);
        if (cancelled) return;

        setEarliestStartTime(snapshot.earliestStartTime);
        setYearSessions(snapshot.sessions);
        setYearSessionsView(selectedHeatmapView);
        hasFetchedHeatmapOnceRef.current = true;

        if (snapshot.earliestStartTime) {
          const earliestYear = new Date(snapshot.earliestStartTime).getFullYear();
          if (selectedHeatmapView !== "recent" && selectedHeatmapView < earliestYear) {
            setSelectedHeatmapView(earliestYear);
          }
        }
      } finally {
        if (!cancelled) {
          setHeatmapLoading(false);
        }
      }
    };

    void loadYear();
    return () => {
      cancelled = true;
    };
  }, [selectedHeatmapView, refreshKey]);

  const trendViewModel = useMemo(() => {
    if (!overviewTrend.snapshot) return null;
    return buildDataTrendViewModel(overviewTrend.snapshot.sessions, overviewTrend.snapshot.range, overviewTrend.nowMs);
  }, [mappingVersion, overviewTrend.nowMs, overviewTrend.snapshot]);
  const appTrendViewModel = useMemo(() => {
    if (!appTrend.snapshot) return null;
    return buildDataAppTrendViewModel(appTrend.snapshot.sessions, appTrend.snapshot.range, appTrend.nowMs, selectedAppKey);
  }, [appTrend.nowMs, appTrend.snapshot, mappingVersion, selectedAppKey]);
  if (appTrendViewModel) {
    lastAppTrendViewModelRef.current = { refreshKey, viewModel: appTrendViewModel };
  }
  const visibleAppTrendViewModel = appTrendViewModel
    ?? (lastAppTrendViewModelRef.current?.refreshKey === refreshKey
      ? lastAppTrendViewModelRef.current.viewModel
      : null);
  const selectedAppTrendApp = visibleAppTrendViewModel?.selectedApp;

  useEffect(() => {
    if (selectedAppKey !== null) return;

    const defaultAppKey = appTrendViewModel?.selectedApp?.appKey;
    if (defaultAppKey) {
      setSelectedAppKey(defaultAppKey);
    }
  }, [appTrendViewModel?.selectedApp?.appKey, selectedAppKey]);

  const filteredAppOptions = useMemo(() => {
    if (!visibleAppTrendViewModel) return [];
    const query = appSearchQuery.trim().toLowerCase();
    const options = dedupeDataAppOptions(visibleAppTrendViewModel.appOptions);
    if (!query) return options;
    return options.filter((app) => (
      app.appName.toLowerCase().includes(query)
      || app.exeName.toLowerCase().includes(query)
    ));
  }, [appSearchQuery, visibleAppTrendViewModel]);
  const heatmapRows = useMemo(() => (
    buildActivityHeatmap(yearSessions, selectedHeatmapView, nowMs)
  ), [nowMs, selectedHeatmapView, yearSessions]);
  const heatmapPlaceholderRows = useMemo(() => (
    buildActivityHeatmap([], selectedHeatmapView, nowMs)
  ), [nowMs, selectedHeatmapView]);
  const hasHeatmapRowsForSelectedView = yearSessionsView === selectedHeatmapView;
  const shouldShowHeatmapSkeleton = heatmapLoading || !hasHeatmapRowsForSelectedView;
  const visibleHeatmapRows = shouldShowHeatmapSkeleton ? heatmapPlaceholderRows : heatmapRows;
  const selectedHeatmapViewKey = String(selectedHeatmapView);
  const yearOptions = useMemo(
    () => buildYearOptions(earliestStartTime, currentYear),
    [currentYear, earliestStartTime],
  );
  const heatmapViewOptions = useMemo<HeatmapSelection[]>(
    () => ["recent", ...yearOptions],
    [yearOptions],
  );
  const selectedHeatmapViewIndex = heatmapViewOptions.findIndex((option) => option === selectedHeatmapView);
  const canSelectOlderHeatmapView = selectedHeatmapViewIndex >= 0
    && selectedHeatmapViewIndex < heatmapViewOptions.length - 1;
  const canSelectNewerHeatmapView = selectedHeatmapViewIndex > 0;
  const selectAdjacentHeatmapView = (delta: number) => {
    if (selectedHeatmapViewIndex < 0) return;
    const nextView = heatmapViewOptions[selectedHeatmapViewIndex + delta];
    if (nextView !== undefined) {
      setHeatmapLoading(true);
      setSelectedHeatmapView(nextView);
    }
  };
  const selectedHeatmapViewLabel = selectedHeatmapView === "recent"
    ? UI_TEXT.data.recentYear
    : String(selectedHeatmapView);
  const canOpenTrendHistory = trendViewModel?.granularity === "day" && Boolean(onOpenHistoryDate);
  const canOpenAppTrendHistory = visibleAppTrendViewModel?.granularity === "day" && Boolean(onOpenHistoryDate);
  const handleTrendMouseMove = (event: unknown) => {
    activeTrendDateRef.current = canOpenTrendHistory && trendViewModel
      ? resolveTrendDateFromChartEvent(event, trendViewModel.chartData)
      : null;
  };
  const handleTrendDoubleClick = () => {
    const dateKey = activeTrendDateRef.current;
    if (dateKey && canOpenTrendHistory) {
      onOpenHistoryDate?.(dateKey);
    }
  };
  const handleAppTrendMouseMove = (event: unknown) => {
    activeAppTrendDateRef.current = canOpenAppTrendHistory && visibleAppTrendViewModel
      ? resolveTrendDateFromChartEvent(event, visibleAppTrendViewModel.chartData)
      : null;
  };
  const handleAppTrendDoubleClick = () => {
    const dateKey = activeAppTrendDateRef.current;
    if (dateKey && canOpenAppTrendHistory) {
      onOpenHistoryDate?.(dateKey);
    }
  };
  const preventChartTextSelection = (event: MouseEvent<HTMLDivElement>, canOpenHistory: boolean) => {
    if (canOpenHistory && event.detail > 1) {
      event.preventDefault();
    }
  };
  const handleTrendDoubleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!canOpenTrendHistory) {
      return;
    }

    event.preventDefault();
    handleTrendDoubleClick();
  };
  const handleAppTrendDoubleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!canOpenAppTrendHistory) {
      return;
    }

    event.preventDefault();
    handleAppTrendDoubleClick();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 md:gap-5 overflow-y-auto pr-1 custom-scrollbar">
      <QuietPageHeader
        icon={<BarChart3 size={18} />}
        title={UI_TEXT.data.title}
        subtitle={UI_TEXT.data.subtitle}
      />

      <div className="data-dashboard-grid">
      <div className="data-overview-grid">
        <div className="qp-panel p-5 md:p-6 data-trend-panel">
          <div className="data-trend-header">
            <h3 className="font-semibold text-[var(--qp-text-primary)] text-sm">
              {UI_TEXT.data.activityTrend}
            </h3>
            <div className="data-trend-inline-metrics" aria-label={UI_TEXT.accessibility.data.trendSummary}>
              <div className="data-trend-inline-metric">
                <Clock3 size={13} aria-hidden />
                <span>{trendViewModel?.metricLabels.total ?? UI_TEXT.data.weeklyTotal}</span>
                <strong>{trendViewModel ? formatDuration(trendViewModel.totalDuration) : "-"}</strong>
              </div>
              <div className="data-trend-inline-metric">
                <CalendarDays size={13} aria-hidden />
                <span>{trendViewModel?.metricLabels.average ?? UI_TEXT.data.dailyAverage}</span>
                <strong>{trendViewModel ? formatDuration(trendViewModel.averageDuration) : "-"}</strong>
              </div>
            </div>
            <DataTrendRangeControl
              ariaLabel={UI_TEXT.accessibility.data.trendRange}
              selection={selectedTrendRange}
              onChange={setSelectedTrendRange}
            />
          </div>
          <div className="pt-4">
            {(overviewTrend.loading && !overviewTrend.hasFetchedOnce) || !trendViewModel ? (
              <div
                className="data-trend-chart data-chart-placeholder flex items-center justify-center text-[var(--qp-text-tertiary)] text-xs"
                aria-busy="true"
              >
                {UI_TEXT.history.loading}
              </div>
            ) : (
              <div
                className={`data-trend-chart ${canOpenTrendHistory ? "data-chart-openable" : ""}`}
                onMouseDownCapture={(event) => {
                  preventChartTextSelection(event, canOpenTrendHistory);
                }}
                onDoubleClickCapture={handleTrendDoubleClickCapture}
              >
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  initialDimension={{ width: 760, height: 168 }}
                >
                <AreaChart
                  data={trendViewModel.chartData}
                  margin={{ top: 8, right: 22, left: -18, bottom: 0 }}
                  onMouseMove={handleTrendMouseMove}
                  onMouseLeave={() => {
                    activeTrendDateRef.current = null;
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--qp-chart-grid)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--qp-text-tertiary)" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={DATA_TREND_X_AXIS_MIN_TICK_GAP}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--qp-text-tertiary)" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    ticks={trendViewModel.chartAxis.ticks}
                    domain={[0, trendViewModel.chartAxis.domainMax]}
                    tickFormatter={(value) => formatChartHours(Number(value))}
                  />
                  <QuietChartTooltip
                    formatter={(value) => [
                      formatDuration(Number(value) * 3600000),
                      UI_TEXT.data.duration,
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    stroke="var(--qp-accent-default)"
                    strokeWidth={2}
                    fill="var(--qp-accent-default)"
                    fillOpacity={0.12}
                    dot={{ fill: "var(--qp-accent-default)", r: 3 }}
                  isAnimationActive={false}
                />
              </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="qp-panel p-5 md:p-6 data-heatmap-panel">
          <div className="data-heatmap-panel-header">
            <div>
              <h3 className="font-semibold text-[var(--qp-text-primary)] text-sm">{UI_TEXT.data.activityHeatmap}</h3>
              <p className="mt-1 text-[11px] text-[var(--qp-text-tertiary)]">
                {selectedHeatmapViewLabel} · {UI_TEXT.data.activityHeatmapHint}
              </p>
            </div>
            <div className="data-heatmap-header-actions">
              <div className="hidden items-center gap-1.5 text-[10px] font-medium text-[var(--qp-text-tertiary)] sm:flex">
                <span>{UI_TEXT.data.less}</span>
                <span className="data-heatmap-swatch data-heatmap-level-0" />
                <span className="data-heatmap-swatch data-heatmap-level-1" />
                <span className="data-heatmap-swatch data-heatmap-level-2" />
                <span className="data-heatmap-swatch data-heatmap-level-3" />
                <span className="data-heatmap-swatch data-heatmap-level-4" />
                <span>{UI_TEXT.data.more}</span>
              </div>
              <div className="data-heatmap-range-control" aria-label={UI_TEXT.accessibility.data.heatmapRange}>
                <button
                  type="button"
                  onClick={() => selectAdjacentHeatmapView(1)}
                  disabled={!canSelectOlderHeatmapView}
                  className="qp-control data-heatmap-range-arrow"
                  aria-label={UI_TEXT.accessibility.data.earlierRange}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  className="qp-status data-heatmap-range-label"
                  disabled
                >
                  {selectedHeatmapViewLabel}
                </button>
                <button
                  type="button"
                  onClick={() => selectAdjacentHeatmapView(-1)}
                  disabled={!canSelectNewerHeatmapView}
                  className="qp-control data-heatmap-range-arrow"
                  aria-label={UI_TEXT.accessibility.data.newerRange}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          <div
            className={`data-heatmap data-heatmap-calendar mt-5 ${heatmapLoading ? "data-heatmap-loading-state" : ""}`}
            aria-busy={heatmapLoading}
          >
              <div className="data-heatmap-content">
                {shouldShowHeatmapSkeleton ? (
                  <div
                    className="data-heatmap-skeleton"
                    aria-hidden
                    style={{ "--data-heatmap-week-count": visibleHeatmapRows.length } as CSSProperties}
                  />
                ) : (
                  <div
                    className="data-heatmap-scroll"
                    style={{ "--data-heatmap-week-count": visibleHeatmapRows.length } as CSSProperties}
                  >
                    <div className="data-heatmap-months" aria-hidden>
                      <span />
                      {visibleHeatmapRows.map((week) => (
                        <span key={`${selectedHeatmapViewKey}:${week.key}`}>{week.monthLabel}</span>
                      ))}
                    </div>
                    <div className="data-heatmap-body" aria-label={UI_TEXT.data.activityHeatmap}>
                      <div className="data-heatmap-weekdays" aria-hidden>
                        {UI_TEXT.date.heatmapWeekdays.map((weekday, index) => (
                          <span key={`${weekday}-${index}`}>{weekday}</span>
                        ))}
                      </div>
                      <div className="data-heatmap-weeks">
                        {visibleHeatmapRows.map((week) => (
                          <div key={`${selectedHeatmapViewKey}:${week.key}`} className="data-heatmap-week">
                            {week.cells.map((cell) => {
                              const isUnavailable = cell.isFuture || cell.isOutsideYear;
                              const canOpenHistoryDate = !isUnavailable && Boolean(onOpenHistoryDate);
                              return (
                                <QuietTooltip
                                  key={`${selectedHeatmapViewKey}:${cell.key}`}
                                  label={cell.label}
                                  placement="top"
                                  disabled={isUnavailable}
                                  className={`data-heatmap-tooltip-anchor ${
                                    isUnavailable ? "data-heatmap-tooltip-anchor-unavailable" : ""
                                  }`}
                                >
                                  <span
                                    className={`data-heatmap-cell ${
                                      canOpenHistoryDate ? "data-heatmap-cell-openable" : ""
                                    } ${
                                      cell.isFuture ? "data-heatmap-cell-future" : ""
                                    } ${cell.isOutsideYear ? "data-heatmap-cell-outside" : ""}`}
                                    onDoubleClick={() => {
                                      if (canOpenHistoryDate) {
                                        onOpenHistoryDate?.(cell.date);
                                      }
                                    }}
                                    data-history-date={canOpenHistoryDate ? cell.date : undefined}
                                    style={{ "--heatmap-intensity": cell.intensity } as CSSProperties}
                                  />
                                </QuietTooltip>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>

      <div className="qp-panel p-5 md:p-6 data-app-panel">
        <div className="data-app-panel-header">
          <div>
            <h3 className="font-semibold text-[var(--qp-text-primary)] text-sm">
              {UI_TEXT.data.appTrend}
            </h3>
          </div>
          <div className="data-app-header-actions">
            {selectedAppTrendApp || !visibleAppTrendViewModel ? (
              <div className={`data-app-selected-status ${selectedAppTrendApp ? "" : "data-app-selected-status-empty"}`}>
                {selectedAppTrendApp && icons[selectedAppTrendApp.exeName] ? (
                  <img
                    src={icons[selectedAppTrendApp.exeName]}
                    alt=""
                    draggable={false}
                  />
                ) : selectedAppTrendApp ? (
                  getAppInitial(selectedAppTrendApp.appName)
                ) : (
                  ""
                )}
              </div>
            ) : null}
            <DataTrendRangeControl
              ariaLabel={UI_TEXT.accessibility.data.appTrendRange}
              selection={selectedAppTrendRange}
              onChange={setSelectedAppTrendRange}
            />
          </div>
        </div>

        {(appTrend.loading && !appTrend.hasFetchedOnce) || !visibleAppTrendViewModel ? (
          <div className="data-app-loading text-[var(--qp-text-tertiary)] text-xs">
            {UI_TEXT.history.loading}
          </div>
        ) : visibleAppTrendViewModel.appOptions.length === 0 ? (
          <div className="data-app-loading text-[var(--qp-text-tertiary)] text-xs">
            {UI_TEXT.data.appTrendEmpty}
          </div>
        ) : (
          <div className="data-app-grid">
            <div className="data-app-sidebar">
              <label className="data-app-search">
                <Search size={14} aria-hidden />
                <input
                  value={appSearchQuery}
                  onChange={(event) => setAppSearchQuery(event.target.value)}
                  placeholder={UI_TEXT.data.appSearchPlaceholder}
                  aria-label={UI_TEXT.data.appSearchPlaceholder}
                />
              </label>
              <div className="data-app-list" aria-label={UI_TEXT.data.appTrendAppList}>
                {filteredAppOptions.length === 0 ? (
                  <div className="data-app-empty text-[var(--qp-text-tertiary)] text-xs">
                    {UI_TEXT.data.appTrendNoMatch}
                  </div>
                ) : filteredAppOptions.map((app) => {
                  const isSelected = visibleAppTrendViewModel.selectedApp?.appKey === app.appKey;
                  return (
                    <button
                      key={app.appKey}
                      type="button"
                      className={`data-app-option ${isSelected ? "data-app-option-selected" : ""}`}
                      onClick={() => setSelectedAppKey(app.appKey)}
                      aria-pressed={isSelected}
                    >
                      <span className="data-app-option-icon" aria-hidden>
                        {icons[app.exeName] ? (
                          <img src={icons[app.exeName]} alt="" draggable={false} />
                        ) : (
                          getAppInitial(app.appName)
                        )}
                      </span>
                      <span className="data-app-option-main">
                        <span className="data-app-option-name">{app.appName}</span>
                        <span className="data-app-option-meta">{Math.round(app.percentage)}% · {app.exeName}</span>
                      </span>
                      <span className="data-app-option-duration">
                        {formatDuration(app.totalDuration)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="data-app-chart-column">
              <div className="data-app-metric-strip">
                <div className="data-app-metric">
                  <span>{UI_TEXT.data.appTrendTotal}</span>
                  <strong>{formatDuration(visibleAppTrendViewModel.selectedApp?.totalDuration ?? 0)}</strong>
                </div>
                <div className="data-app-metric">
                  <span>{visibleAppTrendViewModel.granularity === "month" ? UI_TEXT.data.monthlyAverage : UI_TEXT.data.appTrendAverage}</span>
                  <strong>{formatDuration(visibleAppTrendViewModel.selectedApp?.averageDuration ?? 0)}</strong>
                </div>
                <div className="data-app-metric">
                  <span>{UI_TEXT.data.appTrendActiveDays}</span>
                  <strong>{visibleAppTrendViewModel.selectedApp?.activeDayCount ?? 0}</strong>
                </div>
                <div className="data-app-metric">
                  <span>{UI_TEXT.data.appTrendPeakDay}</span>
                  <strong>{visibleAppTrendViewModel.peakDay ? formatDuration(visibleAppTrendViewModel.peakDay.duration) : "-"}</strong>
                </div>
              </div>
              <div
                className={`data-app-chart ${canOpenAppTrendHistory ? "data-chart-openable" : ""}`}
                onMouseDownCapture={(event) => {
                  preventChartTextSelection(event, canOpenAppTrendHistory);
                }}
                onDoubleClickCapture={handleAppTrendDoubleClickCapture}
              >
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  initialDimension={{ width: 620, height: 172 }}
                >
                  <AreaChart
                    data={visibleAppTrendViewModel.chartData}
                    margin={{ top: 10, right: 18, left: -20, bottom: 0 }}
                    onMouseMove={handleAppTrendMouseMove}
                    onMouseLeave={() => {
                      activeAppTrendDateRef.current = null;
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--qp-border-subtle)" strokeOpacity={0.58} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--qp-text-tertiary)" }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                      minTickGap={DATA_TREND_X_AXIS_MIN_TICK_GAP}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--qp-text-tertiary)" }}
                      axisLine={false}
                      tickLine={false}
                      ticks={visibleAppTrendViewModel.chartAxis.ticks}
                      domain={[0, visibleAppTrendViewModel.chartAxis.domainMax]}
                      tickFormatter={(value) => formatChartHours(Number(value))}
                    />
                    <QuietChartTooltip
                      formatter={(value) => [
                        formatDuration(Number(value) * 3600000),
                        UI_TEXT.data.appTrendUsage,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="hours"
                      stroke="var(--qp-accent-default)"
                      strokeWidth={2}
                      fill="var(--qp-accent-default)"
                      fillOpacity={0.1}
                      dot={{ fill: "var(--qp-accent-default)", r: 2.5 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}
      </div>
      </div>
    </div>
  );
}
