import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { UI_TEXT } from "../../../shared/copy/index.ts";
import { formatDuration, formatTime } from "../services/historyFormatting.ts";

export type TimelineDetailTitle = {
  title: string;
  startTime: number;
  endTime: number | null;
  duration?: number;
  isUntitled?: boolean;
};

export interface HistoryTimelineDetailsPopoverState {
  sessionId: number | string;
  titleSamples: TimelineDetailTitle[];
  left: number;
  top: number;
  anchorTop: number;
  anchorBottom: number;
  anchorCenterX: number;
  placement: "top" | "bottom";
}

interface HistoryTimelineDetailsPopoverProps {
  popover: HistoryTimelineDetailsPopoverState | null;
  popoverRef: RefObject<HTMLDivElement | null>;
}

function getTitleDetailDuration(sample: TimelineDetailTitle, nowMs: number) {
  if (typeof sample.duration === "number") {
    return Math.max(0, sample.duration);
  }

  const endTime = sample.endTime ?? nowMs;
  return Math.max(0, endTime - sample.startTime);
}

export default function HistoryTimelineDetailsPopover({
  popover,
  popoverRef,
}: HistoryTimelineDetailsPopoverProps) {
  const nowMs = Date.now();

  return createPortal(
    popover ? (
        <div
          ref={popoverRef}
          className={`history-activity-popover qp-motion-popover-enter history-activity-popover-${popover.placement}`}
          style={{
            left: popover.left,
            top: popover.top,
          }}
        >
          <div className="history-activity-popover-title">
            {UI_TEXT.history.titleDetails}
          </div>
          <div className="history-activity-popover-list">
            {popover.titleSamples.map((sample, index) => (
              <div
                key={`${popover.sessionId}-${index}-${sample.title}`}
                className="history-activity-popover-item"
              >
                <span className="history-activity-popover-item-title">
                  {sample.isUntitled ? UI_TEXT.history.webTimelineUntitledPage : sample.title}
                </span>
                <span className="history-activity-popover-item-time">
                  <span className="history-activity-popover-item-duration">
                    {formatDuration(getTitleDetailDuration(sample, nowMs))}
                  </span>
                  <span className="history-activity-popover-item-range">
                    {formatTime(sample.startTime)}
                    {sample.endTime ? ` - ${formatTime(sample.endTime)}` : ` ${UI_TEXT.history.untilNow}`}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null,
    document.body,
  );
}
