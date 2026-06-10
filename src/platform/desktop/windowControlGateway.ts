import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface CurrentWindowForegroundState {
  visible: boolean;
  focused: boolean;
  foregroundLike: boolean;
}

export async function minimizeCurrentWindow(): Promise<void> {
  await invoke("cmd_minimize_main_window");
}

export async function toggleCurrentWindowMaximized(): Promise<void> {
  await getCurrentWindow().toggleMaximize();
}

export async function closeCurrentWindow(): Promise<void> {
  await getCurrentWindow().close();
}

export async function startCurrentWindowDrag(): Promise<void> {
  await getCurrentWindow().startDragging();
}

export async function watchCurrentWindowMaximized(
  handler: (maximized: boolean) => void,
): Promise<() => void> {
  const currentWindow = getCurrentWindow();

  const syncMaximizedState = () => {
    void currentWindow.isMaximized()
      .then(handler)
      .catch((error) => {
        console.warn("read current window maximized state failed", error);
      });
  };

  syncMaximizedState();
  return currentWindow.onResized(syncMaximizedState);
}

export async function readCurrentWindowForegroundState(): Promise<CurrentWindowForegroundState> {
  try {
    const currentWindow = getCurrentWindow();
    const [visible, focused] = await Promise.all([
      currentWindow.isVisible(),
      currentWindow.isFocused(),
    ]);

    return {
      visible,
      focused,
      foregroundLike: visible || focused,
    };
  } catch (error) {
    console.warn("read current window foreground state failed", error);
    return {
      visible: true,
      focused: true,
      foregroundLike: true,
    };
  }
}

export async function watchCurrentWindowForegroundState(
  handler: (state: CurrentWindowForegroundState) => void,
): Promise<() => void> {
  const currentWindow = getCurrentWindow();

  const syncForegroundState = () => {
    void readCurrentWindowForegroundState().then(handler);
  };
  const unlisteners: Array<() => void> = [];

  syncForegroundState();

  try {
    unlisteners.push(await currentWindow.onFocusChanged(syncForegroundState));
    unlisteners.push(await currentWindow.onResized(syncForegroundState));
  } catch (error) {
    for (const unlisten of unlisteners.splice(0)) {
      unlisten();
    }
    console.warn("watch current window foreground state failed", error);
  }

  return () => {
    for (const unlisten of unlisteners.splice(0)) {
      unlisten();
    }
  };
}
