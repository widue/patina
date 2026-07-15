import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AppClassification } from "../../../shared/classification/appClassification.ts";
import QuietTooltip from "../../../shared/components/QuietTooltip.tsx";
import { UI_TEXT } from "../../../shared/copy/index.ts";
import { formatDuration, formatTime } from "../services/historyFormatting.ts";
import type {
  HistoryTimelineDisplayMode,
  HistoryTimelineSegment,
  HistoryTimelineViewModel,
} from "../services/historyTimelineViewModel.ts";

const MAX_LEGEND_ITEMS = 7;

interface Props {
  viewModel: HistoryTimelineViewModel;
  mode: HistoryTimelineDisplayMode;
  iconThemeColors: Record<string, string>;
  title?: string | null;
  titleAction?: ReactNode;
  actions?: ReactNode;
  variant?: "default" | "expanded" | "lane";
  showHeader?: boolean;
  showAxis?: boolean;
  showEmptyMessage?: boolean;
  emptyMessage?: string;
  interactionActive?: boolean;
}

type TimelineMetricVariable =
  "--history-horizontal-timeline-segment-height";
type TimelineStyle = CSSProperties
  & Record<"--segment-left" | "--segment-width" | "--segment-color", string>
  & Partial<Record<TimelineMetricVariable, string>>;
type TrackStyle = CSSProperties & Partial<Record<TimelineMetricVariable, string>>;
type TooltipContentStyle = CSSProperties & Record<"--tooltip-color", string>;

function resolveSegmentColor(
  segment: HistoryTimelineSegment,
  mode: HistoryTimelineDisplayMode,
  iconThemeColors: Record<string, string>,
) {
  if (mode === "category") {
    return AppClassification.getCategoryColor(segment.category);
  }

  const overrideColor = AppClassification.getUserOverride(segment.appKey)?.color
    ?? AppClassification.getUserOverride(segment.exeName)?.color;
  const mapped = AppClassification.mapApp(segment.appKey, { appName: segment.displayName });

  return overrideColor
    ?? iconThemeColors[segment.appKey]
    ?? iconThemeColors[segment.exeName]
    ?? mapped.color;
}

function resolveLegendColor(
  item: { key: string; category: HistoryTimelineSegment["category"]; exeName: string },
  mode: HistoryTimelineDisplayMode,
  iconThemeColors: Record<string, string>,
) {
  if (mode === "category") {
    return AppClassification.getCategoryColor(item.category);
  }

  const overrideColor = AppClassification.getUserOverride(item.key)?.color
    ?? AppClassification.getUserOverride(item.exeName)?.color;
  const mapped = AppClassification.mapApp(item.key);

  return overrideColor
    ?? iconThemeColors[item.key]
    ?? iconThemeColors[item.exeName]
    ?? mapped.color;
}

function getSegmentLabel(segment: HistoryTimelineSegment, mode: HistoryTimelineDisplayMode) {
  return mode === "category" ? segment.categoryLabel : segment.displayName;
}

function getViewportWidth() {
  return typeof window === "undefined" ? 0 : window.innerWidth;
}

function getTimelineMetrics(variant: Props["variant"], viewportWidth: number) {
  if (variant !== "default") {
    return null;
  }

  if (viewportWidth >= 1900) {
    return {
      trackHeight: "72px",
      segmentHeight: "54px",
    };
  }

  if (viewportWidth >= 1600) {
    return {
      trackHeight: "60px",
      segmentHeight: "45px",
    };
  }

  return null;
}

function formatTimelineTime(timeMs: number, viewModel: HistoryTimelineViewModel) {
  return timeMs === viewModel.dayEndMs ? "24:00" : formatTime(timeMs);
}

export default function HistoryHorizontalTimeline({
  viewModel,
  mode,
  iconThemeColors,
  title,
  titleAction,
  actions,
  variant = "default",
  showHeader = true,
  showAxis = true,
  showEmptyMessage = true,
  emptyMessage,
  interactionActive = false,
}: Props) {
  const copy = UI_TEXT.history.horizontalTimeline;
  const headingTitle = title === undefined ? copy.defaultTitle : title;
  const resolvedEmptyMessage = emptyMessage ?? copy.emptyDay;
  const [viewportWidth, setViewportWidth] = useState(getViewportWidth);
  useEffect(() => {
    if (variant !== "default") {
      return undefined;
    }

    const handleResize = () => setViewportWidth(getViewportWidth());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [variant]);

  const timelineMetrics = getTimelineMetrics(variant, viewportWidth);
  const trackStyle: TrackStyle | undefined = timelineMetrics
    ? {
      height: timelineMetrics.trackHeight,
      "--history-horizontal-timeline-segment-height": timelineMetrics.segmentHeight,
    }
    : undefined;
  const visibleLegendItems = viewModel.legendItems.slice(0, MAX_LEGEND_ITEMS);
  const hiddenLegendItems = viewModel.legendItems.slice(MAX_LEGEND_ITEMS);
  const hiddenLegendCount = Math.max(0, viewModel.legendItems.length - visibleLegendItems.length);
  const hiddenLegendLabel = copy.remainingLegendItems(hiddenLegendCount);
  const hiddenLegendHint = copy.remainingLegendItemsHint(
    hiddenLegendItems.map((item) => item.label),
  );
  const hiddenLegendTooltip = (
    <span
      className="history-horizontal-timeline-legend-more-tooltip"
      data-hidden-legend-count={hiddenLegendCount}
      data-hidden-legend-layout={hiddenLegendCount >= 8 ? "double" : "single"}
      aria-hidden="true"
    >
      {hiddenLegendItems.map((item) => (
        <span key={item.key} className="history-horizontal-timeline-legend-more-tooltip-item">
          <span
            className="history-horizontal-timeline-legend-more-tooltip-dot"
            style={{ backgroundColor: resolveLegendColor(item, mode, iconThemeColors) }}
          />
          <span className="history-horizontal-timeline-legend-more-tooltip-label">
            {item.label}
          </span>
        </span>
      ))}
    </span>
  );
  return (
    <section
      className={`history-horizontal-timeline history-horizontal-timeline-${mode} history-horizontal-timeline-${variant}`}
      data-history-timeline-mode={mode}
      data-history-timeline-zoom-hours={viewModel.zoomHours}
      data-history-timeline-window-start={viewModel.viewportStartMs}
      data-history-timeline-window-end={viewModel.viewportEndMs}
      aria-label={copy.ariaLabel}
    >
      {showHeader && (
        <header className="history-horizontal-timeline-header">
          {(headingTitle || titleAction) && (
            <div className="history-horizontal-timeline-title-row">
              {headingTitle && (
                <h3 className="history-horizontal-timeline-title font-semibold text-[var(--qp-text-primary)] text-sm">
                  {headingTitle}
                </h3>
              )}
              {titleAction}
            </div>
          )}
          <div className="history-horizontal-timeline-meta">
            {visibleLegendItems.length > 0 && (
              <div className="history-horizontal-timeline-legend">
                {visibleLegendItems.map((item) => (
                  <span key={item.key} className="history-horizontal-timeline-legend-item">
                    <span
                      className="history-horizontal-timeline-legend-dot"
                      style={{ backgroundColor: resolveLegendColor(item, mode, iconThemeColors) }}
                      aria-hidden="true"
                    />
                    <span className="history-horizontal-timeline-legend-label">{item.label}</span>
                  </span>
                ))}
                {hiddenLegendCount > 0 && (
                  <QuietTooltip
                    label={hiddenLegendTooltip}
                    placement="top"
                    className="history-horizontal-timeline-legend-more-anchor"
                    tooltipClassName="history-horizontal-timeline-legend-more-popover"
                  >
                    <span
                      className="history-horizontal-timeline-legend-more"
                      tabIndex={0}
                      aria-label={hiddenLegendHint}
                      data-history-timeline-legend-more={hiddenLegendCount}
                    >
                      {hiddenLegendLabel}
                    </span>
                  </QuietTooltip>
                )}
              </div>
            )}
            {actions && (
              <div className="history-horizontal-timeline-actions">
                {actions}
              </div>
            )}
          </div>
        </header>
      )}

      <div className="history-horizontal-timeline-canvas">
        <div className="history-horizontal-timeline-track" style={trackStyle}>
          {viewModel.segments.map((segment) => {
            const segmentColor = resolveSegmentColor(segment, mode, iconThemeColors);
            const segmentStyle: TimelineStyle = {
              "--segment-left": `${segment.startRatio * 100}%`,
              "--segment-width": `${segment.widthRatio * 100}%`,
              "--segment-color": segmentColor,
              ...(timelineMetrics
                ? {
                  "--history-horizontal-timeline-segment-height": timelineMetrics.segmentHeight,
                }
                : {}),
            };
            const label = getSegmentLabel(segment, mode);
            const ariaLabel = `${copy.ariaLabel} ${label} ${formatTimelineTime(
              segment.startTime,
              viewModel,
            )} - ${formatTimelineTime(segment.endTime, viewModel)} ${formatDuration(segment.duration)}`;
            const tooltipContentStyle: TooltipContentStyle = {
              "--tooltip-color": segmentColor,
            };

            return (
              <QuietTooltip
                key={segment.id}
                label={(
                  <div className="history-horizontal-timeline-tooltip-content" style={tooltipContentStyle}>
                    <div className="history-horizontal-timeline-tooltip-title">
                      <span className="history-horizontal-timeline-tooltip-dot" aria-hidden="true" />
                      <span className="history-horizontal-timeline-tooltip-label">{label}</span>
                    </div>
                    <div className="history-horizontal-timeline-tooltip-time">
                      {formatTimelineTime(segment.startTime, viewModel)}
                      {" - "}
                      {formatTimelineTime(segment.endTime, viewModel)}
                      <span aria-hidden="true"> · </span>
                      {formatDuration(segment.duration)}
                    </div>
                  </div>
                )}
                placement="top"
                disabled={interactionActive}
                hideOnPointerDown={variant !== "expanded"}
                className="history-horizontal-timeline-segment"
                tooltipClassName="history-horizontal-timeline-tooltip"
                style={segmentStyle}
              >
                <span aria-label={ariaLabel} />
              </QuietTooltip>
            );
          })}
          {viewModel.segments.length === 0 && showEmptyMessage && (
            <span className="history-horizontal-timeline-empty">
              {resolvedEmptyMessage}
            </span>
          )}
        </div>
        {showAxis && (
          <div className="history-horizontal-timeline-axis" aria-hidden="true">
            {viewModel.axisTicks.map((tick) => (
              <span key={tick.label} style={{ left: `${tick.ratio * 100}%` }}>
                {tick.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
