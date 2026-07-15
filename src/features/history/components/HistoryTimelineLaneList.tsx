import { AppClassification } from "../../../shared/classification/appClassification.ts";
import { formatDuration } from "../services/historyFormatting.ts";
import type {
  HistoryTimelineDisplayMode,
  HistoryTimelineLane,
  HistoryTimelineViewModel,
} from "../services/historyTimelineViewModel.ts";
import HistoryHorizontalTimeline from "./HistoryHorizontalTimeline.tsx";

interface Props {
  title: string;
  emptyMessage: string;
  viewModel: HistoryTimelineViewModel;
  mode: HistoryTimelineDisplayMode;
  appIcons: Record<string, string>;
  iconThemeColors: Record<string, string>;
  interactionActive: boolean;
}

function resolveLaneColor(
  lane: HistoryTimelineLane,
  mode: HistoryTimelineDisplayMode,
  iconThemeColors: Record<string, string>,
) {
  if (mode === "category") {
    return AppClassification.getCategoryColor(lane.category);
  }

  const overrideColor = AppClassification.getUserOverride(lane.appKey)?.color
    ?? AppClassification.getUserOverride(lane.exeName)?.color;
  const mapped = AppClassification.mapApp(lane.appKey, { appName: lane.label });

  return overrideColor
    ?? iconThemeColors[lane.appKey]
    ?? iconThemeColors[lane.exeName]
    ?? mapped.color;
}

export default function HistoryTimelineLaneList({
  title,
  emptyMessage,
  viewModel,
  mode,
  appIcons,
  iconThemeColors,
  interactionActive,
}: Props) {
  return (
    <section className="history-timeline-lanes" aria-label={title}>
      <h3 className="history-timeline-lanes-title">{title}</h3>
      <div
        className="history-timeline-lanes-scroll custom-scrollbar"
        data-history-timeline-lane-count={viewModel.lanes.length}
      >
        {viewModel.lanes.length === 0 ? (
          <p className="history-timeline-lanes-empty">{emptyMessage}</p>
        ) : (
          <div className="history-timeline-lanes-list" role="list">
            {viewModel.lanes.map((lane) => {
              const color = resolveLaneColor(lane, mode, iconThemeColors);
              const iconSrc = mode === "app"
                ? appIcons[lane.exeName] ?? appIcons[lane.appKey]
                : undefined;
              const laneViewModel: HistoryTimelineViewModel = {
                ...viewModel,
                segments: lane.segments,
                lanes: [lane],
                legendItems: [],
              };

              return (
                <div
                  key={lane.key}
                  className="history-timeline-lane-row"
                  role="listitem"
                  aria-label={`${lane.label} ${formatDuration(lane.duration)}`}
                >
                  <div className="history-timeline-lane-identity">
                    {iconSrc ? (
                      <img src={iconSrc} className="history-timeline-lane-icon" alt="" />
                    ) : (
                      <span
                        className="history-timeline-lane-dot"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="history-timeline-lane-label">{lane.label}</span>
                  </div>
                  <div className="history-timeline-lane-track">
                    <HistoryHorizontalTimeline
                      viewModel={laneViewModel}
                      mode={mode}
                      iconThemeColors={iconThemeColors}
                      title={null}
                      variant="lane"
                      showHeader={false}
                      showAxis={false}
                      showEmptyMessage={false}
                      interactionActive={interactionActive}
                    />
                  </div>
                  <span className="history-timeline-lane-duration">
                    {formatDuration(lane.duration)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
