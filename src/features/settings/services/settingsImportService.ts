import {
  commitCanonicalImport,
  deleteImportBatch,
  destructureExternalData,
  listImportBatches,
  pickCanonicalImportFile,
  pickExternalImportFile,
  previewCanonicalImport,
} from "../../../platform/persistence/importRuntimeGateway.ts";

export type {
  DestructureReport,
  ImportBatch,
  ImportCommitReport,
  ImportDeleteReport,
  ImportPreview,
  ImportPreviewError,
} from "../../../platform/persistence/importRuntimeGateway.ts";

export const SettingsImportService = {
  commitCanonicalImport,
  deleteImportBatch,
  destructureExternalData,
  listImportBatches,
  pickCanonicalImportFile,
  pickExternalImportFile,
  previewCanonicalImport,
};
