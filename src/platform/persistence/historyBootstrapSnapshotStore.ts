import {
  clearHistoryBootstrapSnapshotPayload as clearHistoryBootstrapSnapshotPayloadViaCommand,
  saveHistoryBootstrapSnapshotPayload as saveHistoryBootstrapSnapshotPayloadViaCommand,
} from "./persistenceWriteRuntimeGateway.ts";
import { getDB } from "./sqlite.ts";

const HISTORY_BOOTSTRAP_SNAPSHOT_KEY = "history.bootstrap_snapshot.v1";

export async function loadHistoryBootstrapSnapshotPayload(): Promise<string | null> {
  const db = await getDB();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = ? LIMIT 1",
    [HISTORY_BOOTSTRAP_SNAPSHOT_KEY],
  );

  return rows[0]?.value ?? null;
}

export async function saveHistoryBootstrapSnapshotPayload(payload: string): Promise<void> {
  await saveHistoryBootstrapSnapshotPayloadViaCommand(payload);
}

export async function clearHistoryBootstrapSnapshotPayload(): Promise<void> {
  await clearHistoryBootstrapSnapshotPayloadViaCommand();
}
