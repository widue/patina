import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef } from "react";
import { AlarmClock, BellRing, TimerReset, X } from "lucide-react";
import { useToolAlerts } from "../hooks/useToolAlerts.ts";
import type { ToolAlert } from "../../../shared/types/tools.ts";

const AUTO_DISMISS_MS = 6000;

function iconForAlert(alert: ToolAlert) {
  if (alert.kind === "countdown") return <TimerReset size={16} />;
  if (alert.kind === "pomodoro") return <AlarmClock size={16} />;
  return <BellRing size={16} />;
}

export default function NotificationToastStack() {
  const { alerts, dismissAlert } = useToolAlerts();
  const timersRef = useRef<Map<string, number>>(new Map());
  const hoveredRef = useRef<Set<string>>(new Set());
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  const clearTimer = useCallback((alertId: string) => {
    const id = timersRef.current.get(alertId);
    if (id != null) {
      window.clearTimeout(id);
      timersRef.current.delete(alertId);
    }
  }, []);

  const startTimer = useCallback((alertId: string) => {
    if (hoveredRef.current.has(alertId)) return;
    clearTimer(alertId);
    const timerId = window.setTimeout(() => {
      timersRef.current.delete(alertId);
      dismissAlert(alertId);
    }, AUTO_DISMISS_MS);
    timersRef.current.set(alertId, timerId);
  }, [clearTimer, dismissAlert]);

  useEffect(() => {
    for (const alert of alerts) {
      if (!timersRef.current.has(alert.id)) {
        startTimer(alert.id);
      }
    }
  }, [alerts, startTimer]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current.clear();
    };
  }, []);

  const handleDismiss = useCallback((alertId: string) => {
    clearTimer(alertId);
    dismissAlert(alertId);
  }, [clearTimer, dismissAlert]);

  const handleMouseEnter = useCallback((alertId: string) => {
    hoveredRef.current.add(alertId);
    clearTimer(alertId);
  }, [clearTimer]);

  const handleMouseLeave = useCallback((alertId: string) => {
    hoveredRef.current.delete(alertId);
    if (alertsRef.current.some((a) => a.id === alertId)) {
      startTimer(alertId);
    }
  }, [startTimer]);

  const toastAlerts = alerts.filter((a) => a.kind !== "pomodoro");
  if (toastAlerts.length === 0) return null;

  const content = (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toastAlerts.map((alert) => (
        <div
          key={alert.id}
          className="qp-toast-entry pointer-events-auto rounded-[var(--qp-radius-control)] border border-[var(--qp-border-subtle)] bg-[var(--qp-bg-panel)] p-2.5 shadow-[var(--qp-shadow-toast)]"
          onMouseEnter={() => handleMouseEnter(alert.id)}
          onMouseLeave={() => handleMouseLeave(alert.id)}
        >
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 shrink-0 text-[var(--qp-text-tertiary)]" aria-hidden="true">
              {iconForAlert(alert)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium leading-[1.4] text-[var(--qp-text-primary)]">
                {alert.title}
              </div>
              {alert.body && (
                <div className="mt-0.5 line-clamp-2 text-[12px] leading-[1.4] text-[var(--qp-text-secondary)]">
                  {alert.body}
                </div>
              )}
            </div>
            <button
              type="button"
              className="mt-0.5 shrink-0 p-0.5 text-[var(--qp-text-tertiary)] opacity-50 hover:opacity-100"
              onClick={() => handleDismiss(alert.id)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
