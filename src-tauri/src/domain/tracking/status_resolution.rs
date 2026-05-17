use super::contracts::{
    SustainedParticipationDiagnosticsSnapshot, SustainedParticipationSignalEvaluationSnapshot,
    SustainedParticipationSignalSnapshot, SustainedParticipationState,
    SustainedParticipationStatusReason, TrackingStatusSnapshot,
};
use super::sustained_identity::{
    resolve_sustained_participation_kind, sustained_participation_app_identity,
};

#[allow(dead_code)]
pub struct TrackingStatusResolutionInput<'a> {
    pub exe_name: &'a str,
    pub process_path: &'a str,
    pub idle_time_ms: u32,
    pub is_afk: bool,
    pub continuity_window_secs: u64,
    pub sustained_participation_secs: u64,
    pub tracking_paused: bool,
    pub signal: &'a SustainedParticipationSignalSnapshot,
}

#[allow(dead_code)]
pub fn resolve_tracking_status(input: TrackingStatusResolutionInput<'_>) -> TrackingStatusSnapshot {
    let TrackingStatusResolutionInput {
        exe_name,
        process_path,
        idle_time_ms,
        is_afk,
        continuity_window_secs,
        sustained_participation_secs,
        tracking_paused,
        signal,
    } = input;

    if tracking_paused || exe_name.trim().is_empty() {
        return TrackingStatusSnapshot::default();
    }

    let continuity_active = !is_afk && u64::from(idle_time_ms) <= continuity_window_secs * 1000;
    let eligible_kind = resolve_sustained_participation_kind(exe_name, process_path, signal);
    let sustained_participation_active =
        eligible_kind.is_some() && u64::from(idle_time_ms) <= sustained_participation_secs * 1000;

    TrackingStatusSnapshot {
        is_tracking_active: continuity_active || sustained_participation_active,
        sustained_participation_eligible: eligible_kind.is_some(),
        sustained_participation_active,
        sustained_participation_kind: eligible_kind,
        sustained_participation_state: if sustained_participation_active {
            SustainedParticipationState::Active
        } else if signal.is_available {
            SustainedParticipationState::Candidate
        } else {
            SustainedParticipationState::Inactive
        },
        sustained_participation_signal_source: signal.signal_source,
        sustained_participation_reason: if sustained_participation_active {
            SustainedParticipationStatusReason::SignalMatched
        } else if signal.is_available && !signal.is_active {
            SustainedParticipationStatusReason::SignalInactive
        } else if signal.is_available {
            SustainedParticipationStatusReason::IdentityMismatch
        } else {
            SustainedParticipationStatusReason::NoSignal
        },
        sustained_participation_diagnostics: SustainedParticipationDiagnosticsSnapshot {
            state: if sustained_participation_active {
                SustainedParticipationState::Active
            } else if signal.is_available {
                SustainedParticipationState::Candidate
            } else {
                SustainedParticipationState::Inactive
            },
            reason: if sustained_participation_active {
                SustainedParticipationStatusReason::SignalMatched
            } else if signal.is_available && !signal.is_active {
                SustainedParticipationStatusReason::SignalInactive
            } else if signal.is_available {
                SustainedParticipationStatusReason::IdentityMismatch
            } else {
                SustainedParticipationStatusReason::NoSignal
            },
            window_identity: sustained_participation_app_identity(exe_name, process_path),
            effective_signal_source: signal.signal_source,
            last_match_at_ms: None,
            grace_deadline_ms: None,
            system_media: SustainedParticipationSignalEvaluationSnapshot::default(),
            audio_session: SustainedParticipationSignalEvaluationSnapshot::default(),
        },
    }
}
