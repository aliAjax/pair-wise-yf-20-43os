import { useCallback, useMemo, useRef, useState } from "react";
// useRef 用于在编辑回调中读取最新原稿，避免频繁重建回调
import { findEarliestDirty, runRehearsal } from "../domain/rehearsal";
import type {
  IgnitionCue,
  RehearsalRejection,
  RehearsalSnapshot,
  ShowScript,
} from "../domain/types";
import { loadSnapshot, saveSnapshot } from "../storage/snapshotStore";
import { loadScript, resetScript, saveScript } from "../storage/scriptStore";

/** 最近一次被拒绝的预演（不持久化，不出快照） */
export interface LastRejection {
  at: number;
  rejection: RehearsalRejection;
}

export function useStudio() {
  // 懒初始化：直接从 localStorage 恢复原稿与最近预演快照（刷新恢复）
  const initialScript = useMemo(() => loadScript(), []);
  const [script, setScript] = useState<ShowScript>(initialScript);
  const [snapshot, setSnapshot] = useState<RehearsalSnapshot | null>(() =>
    loadSnapshot(initialScript)
  );
  const [rejection, setRejection] = useState<LastRejection | null>(null);
  const scriptRef = useRef(script);
  scriptRef.current = script;

  const persist = useCallback((next: ShowScript) => {
    scriptRef.current = next;
    setScript(next);
    saveScript(next);
  }, []);

  /** 标记关键调整：角度或点位（以及点火时间等）修订后只能从该节点重跑 */
  const bumpRevision = useCallback((cue: IgnitionCue) => {
    return { ...cue, revision: cue.revision + 1 };
  }, []);

  const updateCue = useCallback(
    (cueId: string, patch: Partial<Pick<IgnitionCue, "pointId" | "angle" | "ignitionMs">>) => {
      const next: ShowScript = {
        ...scriptRef.current,
        cues: scriptRef.current.cues.map((c) =>
          c.id === cueId ? bumpRevision({ ...c, ...patch }) : c
        ),
      };
      persist(next);
    },
    [bumpRevision, persist]
  );

  const changeAngle = useCallback(
    (cueId: string, angle: number) => updateCue(cueId, { angle }),
    [updateCue]
  );

  const changePoint = useCallback(
    (cueId: string, pointId: string) => updateCue(cueId, { pointId }),
    [updateCue]
  );

  const changeIgnition = useCallback(
    (cueId: string, ignitionMs: number) => updateCue(cueId, { ignitionMs }),
    [updateCue]
  );

  /**
   * 移除 / 恢复段落。移除后，引用该段落的音乐时间点与点火节点将让下一次预演
   * 以 segment-missing 整场拒绝；段落对象保留在 removedSegments 中可恢复。
   */
  const toggleSegment = useCallback(
    (segmentId: string) => {
      const current = scriptRef.current;
      const active = current.segments.find((s) => s.id === segmentId);
      let next: ShowScript;
      if (active) {
        next = {
          ...current,
          segments: current.segments.filter((s) => s.id !== segmentId),
          removedSegments: [...current.removedSegments, active],
        };
      } else {
        const restored = current.removedSegments.find((s) => s.id === segmentId);
        if (!restored) return;
        next = {
          ...current,
          segments: [...current.segments, restored].sort((a, b) => a.startMs - b.startMs),
          removedSegments: current.removedSegments.filter((s) => s.id !== segmentId),
        };
      }
      persist(next);
    },
    [persist]
  );

  const setMusicDuration = useCallback(
    (ms: number) => {
      if (!Number.isFinite(ms) || ms < 0) return;
      persist({ ...scriptRef.current, musicDurationMs: Math.round(ms) });
    },
    [persist]
  );

  const run = useCallback(
    (startCueId: string | null) => {
      const current = scriptRef.current;
      const outcome = runRehearsal(current, snapshot, { startCueId });
      if (!outcome.ok) {
        setRejection({ at: Date.now(), rejection: outcome.rejection });
        return;
      }
      setSnapshot(outcome.snapshot);
      saveSnapshot(outcome.snapshot);
      setRejection(null);
    },
    [snapshot]
  );

  const restoreSeed = useCallback(() => {
    const seed = resetScript();
    persist(seed);
    const fresh = runRehearsal(seed, null, { startCueId: null });
    if (fresh.ok) {
      setSnapshot(fresh.snapshot);
      saveSnapshot(fresh.snapshot);
    }
    setRejection(null);
  }, [persist]);

  const dirtyCue = useMemo(
    () => findEarliestDirty(script, snapshot),
    [script, snapshot]
  );

  return {
    script,
    snapshot,
    rejection,
    dirtyCue,
    run,
    changeAngle,
    changePoint,
    changeIgnition,
    toggleSegment,
    setMusicDuration,
    restoreSeed,
  };
}
