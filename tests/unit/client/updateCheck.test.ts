import { describe, it, expect, vi } from "vitest";
import { checkForUpdate, type UpdateCheckDeps } from "../../../src/client/lib/updateCheck";

function deps(latest: string | null | Error, stored: Record<string, string> = {}) {
  const storage = {
    getItem: (k: string) => stored[k] ?? null,
    setItem: (k: string, v: string) => {
      stored[k] = v;
    },
  };
  const reload = vi.fn();
  const d: UpdateCheckDeps = {
    currentBuildId: "build-1",
    fetchBuildId: () => (latest instanceof Error ? Promise.reject(latest) : Promise.resolve(latest)),
    reload,
    storage,
  };
  return { d, reload, stored };
}

describe("checkForUpdate", () => {
  it("does nothing when the server serves the same build", async () => {
    const { d, reload } = deps("build-1");
    expect(await checkForUpdate(d)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads when a newer build is live", async () => {
    const { d, reload } = deps("build-2");
    expect(await checkForUpdate(d)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads at most once per new build, so a stale cache can't loop", async () => {
    const stored: Record<string, string> = {};
    const first = deps("build-2", stored);
    await checkForUpdate(first.d);
    const second = deps("build-2", stored);
    expect(await checkForUpdate(second.d)).toBe(false);
    expect(second.reload).not.toHaveBeenCalled();
    const third = deps("build-3", stored); // a later deploy still gets picked up
    expect(await checkForUpdate(third.d)).toBe(true);
  });

  it("does nothing when offline or when there's no version file", async () => {
    for (const latest of [new Error("offline"), null]) {
      const { d, reload } = deps(latest);
      expect(await checkForUpdate(d)).toBe(false);
      expect(reload).not.toHaveBeenCalled();
    }
  });

  it("won't reload without storage, since it couldn't guard against loops", async () => {
    const { d, reload } = deps("build-2");
    d.storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    };
    expect(await checkForUpdate(d)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
