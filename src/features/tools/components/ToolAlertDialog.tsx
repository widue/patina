import { AlarmClock, BellRing, TimerReset } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import QuietDialog from "../../../shared/components/QuietDialog.tsx";
import { UI_TEXT } from "../../../shared/copy/index.ts";
import type { ToolAlert } from "../../../shared/types/tools.ts";
import { useToolAlerts } from "../hooks/useToolAlerts.ts";
import { ToolsRuntimeService } from "../services/toolsRuntimeService.ts";

function formatAlertTime(timestampMs: number) {
  return new Date(timestampMs).toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function alertIcon(alert: ToolAlert): ReactNode {
  if (alert.kind === "countdown") return <TimerReset size={17} />;
  if (alert.kind === "pomodoro") return <AlarmClock size={17} />;
  return <BellRing size={17} />;
}

export default function ToolAlertDialog() {
  const { alerts, dismissAlert } = useToolAlerts();
  const pomodoroAlert = alerts.find((a) => a.kind === "pomodoro") ?? null;
  const [pausingPomodoro, setPausingPomodoro] = useState(false);
  const title = pomodoroAlert?.title.trim() || UI_TEXT.tools.notificationStatus;
  const message = pomodoroAlert?.body.trim() || UI_TEXT.tools.defaultReminderLabel;
  const occurredAtLabel = pomodoroAlert
    ? UI_TEXT.tools.alertOccurredAt(formatAlertTime(pomodoroAlert.occurredAt))
    : "";
  const handlePausePomodoro = useCallback(async () => {
    if (!pomodoroAlert || pausingPomodoro) return;

    setPausingPomodoro(true);
    try {
      await ToolsRuntimeService.pausePomodoro();
      dismissAlert(pomodoroAlert.id);
    } catch (error) {
      console.warn("pause pomodoro from alert failed", error);
    } finally {
      setPausingPomodoro(false);
    }
  }, [pomodoroAlert, dismissAlert, pausingPomodoro]);

  return (
    <QuietDialog
      open={Boolean(pomodoroAlert)}
      title={title}
      closeOnBackdrop={false}
      onClose={() => pomodoroAlert && dismissAlert(pomodoroAlert.id)}
      surfaceClassName="tools-alert-dialog-surface"
      actions={(
        <>
          <button
            type="button"
            className="qp-button-secondary qp-dialog-action disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void handlePausePomodoro()}
            disabled={pausingPomodoro}
          >
            {pausingPomodoro ? UI_TEXT.tools.alertPausingPomodoro : UI_TEXT.tools.alertPausePomodoro}
          </button>
          <button
            type="button"
            className="qp-button-primary qp-dialog-action"
            onClick={() => pomodoroAlert && dismissAlert(pomodoroAlert.id)}
          >
            {UI_TEXT.tools.alertDismiss}
          </button>
        </>
      )}
    >
      {pomodoroAlert && (
        <div className="tools-alert-dialog-body">
          <div className="tools-alert-dialog-icon" aria-hidden="true">
            {alertIcon(pomodoroAlert)}
          </div>
          <div className="tools-alert-dialog-copy">
            <p className="tools-alert-dialog-message">{message}</p>
            <p className="tools-alert-dialog-time">{occurredAtLabel}</p>
          </div>
        </div>
      )}
    </QuietDialog>
  );
}
