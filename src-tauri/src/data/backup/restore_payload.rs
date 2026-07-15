use super::RestoreStrategy;
use crate::data::repositories;
use crate::domain::backup::BackupPayload;
use sqlx::{Pool, Sqlite};

pub(super) async fn restore_backup_payload(
    pool: &Pool<Sqlite>,
    payload: &BackupPayload,
    strategy: RestoreStrategy,
) -> Result<(), String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| format!("failed to start restore transaction: {error}"))?;
    match strategy {
        RestoreStrategy::Replace => {
            repositories::session_title_samples::clear_for_restore(&mut tx).await?;
            repositories::sessions::clear_for_restore(&mut tx).await?;
            repositories::settings::clear_for_restore(&mut tx).await?;
            repositories::icon_cache::clear_for_restore(&mut tx).await?;
            repositories::web_activity::clear_for_restore(&mut tx).await?;
            repositories::tools::clear_for_restore(&mut tx).await?;

            repositories::sessions::insert_for_restore(&mut tx, &payload.sessions).await?;
            let session_id_map =
                repositories::sessions::resolve_restore_session_id_map(&mut tx, &payload.sessions)
                    .await?;
            repositories::session_title_samples::insert_for_restore(
                &mut tx,
                &payload.title_samples,
                &session_id_map,
            )
            .await?;
            repositories::settings::insert_for_restore(&mut tx, &payload.settings).await?;
            repositories::icon_cache::insert_for_restore(&mut tx, &payload.icon_cache).await?;
            repositories::web_activity::insert_for_restore(&mut tx, &payload.web_activity_segments)
                .await?;
            repositories::web_activity::insert_favicon_cache_for_restore(
                &mut tx,
                &payload.web_favicon_cache,
            )
            .await?;
            repositories::tools::insert_for_restore(
                &mut tx,
                &payload.tool_reminders,
                &payload.tool_timers,
                &payload.tool_timer_laps,
                &payload.tool_pomodoro_runs,
                &payload.tool_daily_stats,
                &payload.tool_software_reminder_rules,
            )
            .await?;
        }
        RestoreStrategy::Merge => {
            repositories::sessions::insert_missing_for_restore(&mut tx, &payload.sessions).await?;
            let session_id_map =
                repositories::sessions::resolve_restore_session_id_map(&mut tx, &payload.sessions)
                    .await?;
            repositories::session_title_samples::insert_missing_for_restore(
                &mut tx,
                &payload.title_samples,
                &session_id_map,
            )
            .await?;
            repositories::settings::insert_missing_for_restore(&mut tx, &payload.settings).await?;
            repositories::icon_cache::insert_missing_for_restore(&mut tx, &payload.icon_cache)
                .await?;
            repositories::web_activity::insert_missing_for_restore(
                &mut tx,
                &payload.web_activity_segments,
            )
            .await?;
            repositories::web_activity::insert_missing_favicon_cache_for_restore(
                &mut tx,
                &payload.web_favicon_cache,
            )
            .await?;
            repositories::tools::insert_missing_for_restore(
                &mut tx,
                &payload.tool_reminders,
                &payload.tool_timers,
                &payload.tool_timer_laps,
                &payload.tool_pomodoro_runs,
                &payload.tool_daily_stats,
                &payload.tool_software_reminder_rules,
            )
            .await?;
        }
    }

    tx.commit()
        .await
        .map_err(|error| format!("failed to commit restore transaction: {error}"))?;
    Ok(())
}
