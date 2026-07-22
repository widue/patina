import { useEffect, useRef } from "react";
import type {
  AppSettings,
  ColorScheme,
  ThemeMode,
} from "../../shared/settings/appSettings.ts";
import {
  markCurrentMainWindowReady,
  readCurrentMainWindowGeneration,
} from "../../platform/desktop/windowControlGateway.ts";
import { isDocumentThemeApplied, useAppThemeMode } from "./useAppThemeMode.ts";

interface ColorSchemePreview {
  light: ColorScheme;
  dark: ColorScheme;
}

interface UseMainWindowReadyOptions {
  appearanceResolved: boolean;
  appSettings: AppSettings;
  themeModePreview: ThemeMode | null;
  colorSchemePreview: ColorSchemePreview | null;
}

const MAX_READY_ATTEMPTS = 2;

export function useMainWindowReady({
  appearanceResolved,
  appSettings,
  themeModePreview,
  colorSchemePreview,
}: UseMainWindowReadyOptions) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pendingGenerationRef = useRef<number | null>(null);
  const confirmedGenerationRef = useRef<number | null>(null);
  const themeMode = themeModePreview ?? appSettings.themeMode;
  const colorSchemeLight = colorSchemePreview?.light ?? appSettings.colorSchemeLight;
  const colorSchemeDark = colorSchemePreview?.dark ?? appSettings.colorSchemeDark;
  useAppThemeMode(themeMode, colorSchemeLight, colorSchemeDark);

  useEffect(() => {
    if (!appearanceResolved) return undefined;

    const generation = readCurrentMainWindowGeneration();
    if (generation === null) {
      console.error("main-window generation is unavailable; readiness will fall back to watchdog");
      return undefined;
    }
    if (
      pendingGenerationRef.current === generation
      || confirmedGenerationRef.current === generation
    ) {
      return undefined;
    }

    let active = true;
    let firstFrameId: number | null = null;
    let stableFrameId: number | null = null;
    let retryFrameId: number | null = null;
    let resolveRetryFrame: (() => void) | null = null;

    const reportReady = async () => {
      pendingGenerationRef.current = generation;
      for (let attempt = 1; attempt <= MAX_READY_ATTEMPTS; attempt += 1) {
        if (!active) {
          pendingGenerationRef.current = null;
          return;
        }
        try {
          const result = await markCurrentMainWindowReady(generation);
          if (result.generation === generation) {
            confirmedGenerationRef.current = generation;
          }
          pendingGenerationRef.current = null;
          return;
        } catch (error) {
          if (attempt === MAX_READY_ATTEMPTS || !active) {
            pendingGenerationRef.current = null;
            console.error("main-window ready handshake failed; watchdog will provide recovery", error);
            return;
          }

          await new Promise<void>((resolve) => {
            resolveRetryFrame = resolve;
            retryFrameId = window.requestAnimationFrame(() => {
              retryFrameId = null;
              resolveRetryFrame = null;
              resolve();
            });
          });
        }
      }
    };

    firstFrameId = window.requestAnimationFrame(() => {
      stableFrameId = window.requestAnimationFrame(() => {
        const frame = frameRef.current;
        if (
          !active
          || !frame?.isConnected
          || !isDocumentThemeApplied(themeMode, colorSchemeLight, colorSchemeDark)
        ) {
          return;
        }

        void reportReady();
      });
    });

    return () => {
      active = false;
      if (firstFrameId !== null) window.cancelAnimationFrame(firstFrameId);
      if (stableFrameId !== null) window.cancelAnimationFrame(stableFrameId);
      if (retryFrameId !== null) {
        window.cancelAnimationFrame(retryFrameId);
        retryFrameId = null;
        resolveRetryFrame?.();
        resolveRetryFrame = null;
      }
    };
  }, [appearanceResolved, colorSchemeDark, colorSchemeLight, frameRef, themeMode]);

  return frameRef;
}
