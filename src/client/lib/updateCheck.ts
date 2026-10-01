const RELOADED_FOR_KEY = "initiativeTracker.reloadedFor";

export interface UpdateCheckDeps {
  currentBuildId: string;
  fetchBuildId: () => Promise<string | null>;
  reload: () => void;
  storage: Pick<Storage, "getItem" | "setItem">;
}

/**
 * Reloads the page when the server is serving a newer build than the one running here.
 * Phones resume old tabs (and installed home-screen apps) without reloading, so without
 * this a deploy would never reach them. Reloads at most once per new build, so a stale
 * cache can't cause a reload loop. Returns whether it reloaded.
 */
export async function checkForUpdate(deps: UpdateCheckDeps): Promise<boolean> {
  let latest: string | null;
  try {
    latest = await deps.fetchBuildId();
  } catch {
    return false; // offline or server restarting: try again on the next reconnect
  }
  if (!latest || latest === deps.currentBuildId) return false;
  try {
    if (deps.storage.getItem(RELOADED_FOR_KEY) === latest) return false;
    deps.storage.setItem(RELOADED_FOR_KEY, latest);
  } catch {
    return false; // without storage we can't guard against loops, so don't risk it
  }
  deps.reload();
  return true;
}

async function fetchBuildId(): Promise<string | null> {
  const res = await fetch("/version.json", { cache: "no-store" });
  if (!res.ok) return null; // e.g. the Vite dev server, which has no version.json
  const body = (await res.json()) as { buildId?: unknown };
  return typeof body.buildId === "string" ? body.buildId : null;
}

/** Checks /version.json against this bundle's build and reloads if a newer one is live. */
export function reloadIfOutdated(): Promise<boolean> {
  return checkForUpdate({
    currentBuildId: __BUILD_ID__,
    fetchBuildId,
    reload: () => location.reload(),
    storage: sessionStorage,
  });
}
