use super::support::log_tracker_error;
use crate::data::tracking_runtime::TrackingRuntimeDataStore;
use crate::domain::tracking::TRACKING_REASON_APP_EXCLUDED_SEALED;

pub(super) async fn seal_excluded_app_session(
    data: &TrackingRuntimeDataStore,
    exe_name: &str,
    now_ms: i64,
) -> Option<&'static str> {
    match data.end_active_session_for_exe(exe_name, now_ms).await {
        Ok(true) => Some(TRACKING_REASON_APP_EXCLUDED_SEALED),
        Ok(false) => None,
        Err(error) => {
            log_tracker_error(format!("failed to seal session for excluded app: {error}"));
            None
        }
    }
}
