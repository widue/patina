import { useCallback, type Dispatch, type SetStateAction } from "react";
import { ClassificationService } from "../../features/classification/services/classificationService.ts";
import { clearDashboardSnapshotCache } from "../../features/dashboard/services/dashboardSnapshotCache.ts";
import { clearDataBootstrapCache } from "../../features/data/services/dataCacheLifecycle.ts";
import { clearHistoryCachesAfterDataChange } from "../../features/history/services/historyCacheLifecycle.ts";
import { clearToolsPageCaches } from "../../features/tools/services/toolsCacheLifecycle.ts";
import {
  applyMappingOverridesReadModelRefresh,
  type ReadModelRefreshState,
} from "../services/readModelRefreshState.ts";

export function useImportClassificationCoordinator(
  setReadModelRefreshState: Dispatch<SetStateAction<ReadModelRefreshState>>,
) {
  const onImportedDataChanged = useCallback(() => {
    ClassificationService.invalidateBootstrapCache();
    clearDashboardSnapshotCache();
    void clearHistoryCachesAfterDataChange();
    clearToolsPageCaches();
    void clearDataBootstrapCache();
    setReadModelRefreshState(applyMappingOverridesReadModelRefresh);
  }, [setReadModelRefreshState]);
  const prepareImportCategories = useCallback(async (
    candidates: Parameters<typeof ClassificationService.prepareImportedCategoryCandidates>[0],
  ) => {
    const prepared = await ClassificationService.prepareImportedCategoryCandidates(candidates);
    return {
      mutations: prepared.mutations,
      applyRuntime: () => {
        prepared.applyRuntime();
        onImportedDataChanged();
      },
    };
  }, [onImportedDataChanged]);
  return { prepareImportCategories, onImportedDataChanged };
}
