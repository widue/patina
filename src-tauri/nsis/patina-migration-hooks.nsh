Var PatinaLegacyInstallDir
Var PatinaLegacyCleanupMarker

!define PATINA_LEGACY_CLEANUP_KEY "Software\timetracker\Patina"
!define PATINA_LEGACY_CLEANUP_VALUE "LegacyTimeTrackerCleanupCompleted"

; Keep this while direct upgrades from Time Tracker / Patina 1.5.0 are supported.
; Remove it only when the release policy drops that legacy upgrade path.
!macro NSIS_HOOK_PREINSTALL
  Call PatinaCleanupLegacyInstall
!macroend

Function PatinaCleanupLegacyInstall
  ReadRegStr $PatinaLegacyCleanupMarker HKCU "${PATINA_LEGACY_CLEANUP_KEY}" "${PATINA_LEGACY_CLEANUP_VALUE}"
  ${If} $PatinaLegacyCleanupMarker == "1"
    Return
  ${EndIf}

  ; The v1.5.0 rename changed the NSIS product name from Time Tracker to
  ; Patina, so the generated updater cannot see the old uninstall key.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Time Tracker"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "time_tracker"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TimeTracker"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "Time Tracker"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "time_tracker"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "TimeTracker"

  Delete "$SMPROGRAMS\Time Tracker.lnk"
  Delete "$SMPROGRAMS\Time Tracker\Time Tracker.lnk"
  Delete "$SMPROGRAMS\Time Tracker\time_tracker.lnk"
  RMDir "$SMPROGRAMS\Time Tracker"
  Delete "$DESKTOP\Time Tracker.lnk"

  StrCpy $PatinaLegacyInstallDir ""
  ReadRegStr $PatinaLegacyInstallDir HKCU "Software\timetracker\Time Tracker" ""
  ${If} $PatinaLegacyInstallDir == ""
    StrCpy $PatinaLegacyInstallDir "$LOCALAPPDATA\Time Tracker"
  ${EndIf}

  Delete /REBOOTOK "$PatinaLegacyInstallDir\time_tracker.exe"
  Delete /REBOOTOK "$PatinaLegacyInstallDir\Time Tracker.exe"
  Delete /REBOOTOK "$PatinaLegacyInstallDir\TimeTracker.exe"
  Delete /REBOOTOK "$PatinaLegacyInstallDir\uninstall.exe"
  RMDir /REBOOTOK "$PatinaLegacyInstallDir"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Time Tracker"
  DeleteRegKey HKCU "Software\timetracker\Time Tracker"
  WriteRegStr HKCU "${PATINA_LEGACY_CLEANUP_KEY}" "${PATINA_LEGACY_CLEANUP_VALUE}" "1"
FunctionEnd
