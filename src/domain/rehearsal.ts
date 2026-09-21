import { distance, formatTime, roundMeters } from "./time";
import type {
  FireworkModel,
  IgnitionCue,
  LaunchPoint,
  RehearsalConflict,
  RehearsalEntry,
  RehearsalRejection,
  RehearsalSnapshot,
  ShowScript,
} from "./types";

/**
 * 整场预演前置校验（对整份原稿执行，与重跑起点无关）：
 * - 音乐时间点越界
 * - 段落已移除（音乐时间点或点火节点引用了不存在的段落）
 * 任一条不通过，整次预演拒绝（原稿不动、不出快照）。
 */
export function runPreflight(script: ShowScript): RehearsalRejection[] {
  const issues: RehearsalRejection[] = [];
  const segmentIds = new Set(script.segments.map((s) => s.id));
  const musicIds = new Set(script.musicCues.map((k) => k.id));

  for (const cue of script.musicCues) {
    if (cue.timeMs < 0 || cue.timeMs > script.musicDurationMs) {
      issues.push({
        kind: "music-out-of-range",
        cueId: cue.id,
        segmentId: cue.segmentId,
        message: `音乐时间点「${cue.label}」为 ${formatTime(cue.timeMs)}，超出音乐总时长 ${formatTime(
          script.musicDurationMs
        )}，整次预演拒绝。`,
      });
    }
    if (!segmentIds.has(cue.segmentId)) {
      issues.push({
        kind: "segment-missing",
        cueId: cue.id,
        segmentId: cue.segmentId,
        message: `音乐时间点「${cue.label}」绑定的段落已移除，整次预演拒绝。`,
      });
    }
  }

  for (const cue of script.cues) {
    if (!segmentIds.has(cue.segmentId)) {
      issues.push({
        kind: "segment-missing",
        cueId: cue.id,
        segmentId: cue.segmentId,
        message: `点火节点 #${cue.code} 所属段落已移除，整次预演拒绝。`,
      });
    }
    if (!musicIds.has(cue.musicCueId)) {
      issues.push({
        kind: "segment-missing",
        cueId: cue.id,
        message: `点火节点 #${cue.code} 对应的音乐时间点不存在，整次预演拒绝。`,
      });
    }
  }

  return issues;
}

/** 原稿相对最近快照发生过关键调整（角度/点位等）的最早节点 */
export function findEarliestDirty(
  script: ShowScript,
  snapshot: RehearsalSnapshot | null
): IgnitionCue | null {
  if (!snapshot) return null;
  const byId = new Map(snapshot.entries.map((e) => [e.cueId, e]));
  const ordered = [...script.cues].sort((a, b) => a.ignitionMs - b.ignitionMs);
  for (const cue of ordered) {
    const entry = byId.get(cue.id);
    if (!entry || entry.revision !== cue.revision) return cue;
  }
  return null;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

type CodeOf = (cueId: string) => string;

/** 同一点位：前一枚尚未结束，或安全间距（秒数=安全半径米数）不足 */
function checkSamePoint(
  cue: IgnitionCue,
  end: number,
  active: RehearsalEntry[],
  models: Map<string, FireworkModel>,
  cues: Map<string, IgnitionCue>,
  codeOf: CodeOf
): RehearsalConflict | null {
  const model = models.get(cue.modelId);
  if (!model) return null;
  const samePoint = active
    .filter((e) => e.pointId === cue.pointId)
    .sort((a, b) => b.endMs - a.endMs);

  for (const prev of samePoint) {
    if (overlaps(prev.startMs, prev.endMs, cue.ignitionMs, end)) {
      return {
        kind: "overlap",
        cueId: cue.id,
        otherCueId: prev.cueId,
        pointId: cue.pointId,
        message: `节点 #${cue.code} 于 ${formatTime(cue.ignitionMs)} 在同一点位点火时，前一枚 #${codeOf(
          prev.cueId
        )} 尚未结束（持续至 ${formatTime(prev.endMs)}）。`,
      };
    }
    const gap = cue.ignitionMs - prev.endMs;
    const prevCue = cues.get(prev.cueId);
    const prevModel = prevCue ? models.get(prevCue.modelId) : undefined;
    const requiredSeconds = Math.max(model.safetyRadius, prevModel?.safetyRadius ?? 0);
    if (gap >= 0 && gap < requiredSeconds * 1000) {
      return {
        kind: "spacing",
        cueId: cue.id,
        otherCueId: prev.cueId,
        pointId: cue.pointId,
        message: `节点 #${cue.code} 与同点前一枚 #${codeOf(prev.cueId)} 间隔 ${(gap / 1000).toFixed(
          1
        )}s，不足安全间距 ${requiredSeconds}s。`,
      };
    }
  }
  return null;
}

/** 异点点位：两枚燃放时间重叠且平面间距小于两枚安全半径之和 */
function checkCrossPoint(
  cue: IgnitionCue,
  end: number,
  active: RehearsalEntry[],
  cues: Map<string, IgnitionCue>,
  models: Map<string, FireworkModel>,
  points: Map<string, LaunchPoint>
): RehearsalConflict | null {
  const model = models.get(cue.modelId);
  const point = points.get(cue.pointId);
  if (!model || !point) return null;

  for (const prev of active) {
    if (prev.pointId === cue.pointId) continue;
    if (!overlaps(prev.startMs, prev.endMs, cue.ignitionMs, end)) continue;
    const prevCue = cues.get(prev.cueId);
    const prevModel = prevCue ? models.get(prevCue.modelId) : undefined;
    const prevPoint = points.get(prev.pointId);
    if (!prevCue || !prevModel || !prevPoint) continue;

    const required = model.safetyRadius + prevModel.safetyRadius;
    const actual = distance(point, prevPoint);
    if (actual < required) {
      return {
        kind: "spacing",
        cueId: cue.id,
        otherCueId: prev.cueId,
        pointId: prev.pointId,
        message: `节点 #${cue.code}（${point.name}）与 #${prevCue.code}（${
          prevPoint.name
        }）燃放重叠，点位间距 ${roundMeters(actual)}m，不足安全间距 ${required}m。`,
      };
    }
  }
  return null;
}

export interface RunOptions {
  /** 请求的重跑起点；null = 从头整场预演 */
  startCueId: string | null;
  ranAt?: number;
}

export type RunOutcome =
  | { ok: true; snapshot: RehearsalSnapshot }
  | { ok: false; rejection: RehearsalRejection; snapshot: RehearsalSnapshot | null };

/**
 * 按点火时间推进整场预演（纯函数，不修改原稿）。
 * - 前置校验失败：整次拒绝，返回拒绝原因，不覆盖最近快照
 * - 同点前一枚未结束 / 安全间距不足 / 异点间距不足：立即停在冲突节点
 * - 重跑：保留起点之前的旧 entries，仅从起点重新推进
 */
export function runRehearsal(
  script: ShowScript,
  previous: RehearsalSnapshot | null,
  options: RunOptions
): RunOutcome {
  const preflightIssues = runPreflight(script);
  if (preflightIssues.length > 0) {
    return { ok: false, rejection: preflightIssues[0], snapshot: previous };
  }

  const ordered = [...script.cues].sort((a, b) => {
    if (a.ignitionMs !== b.ignitionMs) return a.ignitionMs - b.ignitionMs;
    return a.code.localeCompare(b.code, "zh-CN");
  });
  const codeOf: CodeOf = (id) => ordered.find((c) => c.id === id)?.code ?? id;

  // 角度/点位等关键调整后，只能从最早被修改的节点重跑
  const dirty = findEarliestDirty(script, previous);
  if (dirty && options.startCueId !== dirty.id) {
    return {
      ok: false,
      snapshot: previous,
      rejection: {
        kind: "start-mismatch",
        cueId: dirty.id,
        message: `节点 #${dirty.code} 的角度或点位已调整，只能从该节点重跑。`,
      },
    };
  }
  if (!dirty && previous && options.startCueId !== null) {
    return {
      ok: false,
      snapshot: previous,
      rejection: {
        kind: "start-mismatch",
        message: "原稿自上次预演后没有关键调整，请执行整场预演。",
      },
    };
  }
  if (options.startCueId !== null && !previous) {
    return {
      ok: false,
      snapshot: null,
      rejection: {
        kind: "start-mismatch",
        cueId: options.startCueId,
        message: "还没有最近预演快照，无法从中间节点重跑，请先执行整场预演。",
      },
    };
  }

  const startCue = options.startCueId
    ? ordered.find((c) => c.id === options.startCueId) ?? null
    : null;
  const startIndex = startCue ? ordered.indexOf(startCue) : 0;

  const models = new Map(script.models.map((m) => [m.id, m]));
  const points = new Map(script.points.map((p) => [p.id, p]));
  const cuesById = new Map(script.cues.map((c) => [c.id, c]));

  // 重跑时沿用起点之前已燃放的结果；其中在起点时刻仍在持续的，进入活动集合
  const entries: RehearsalEntry[] = [];
  let endMs = 0;
  if (startCue) {
    const prevById = new Map(previous?.entries.map((e) => [e.cueId, e]) ?? []);
    for (const cue of ordered.slice(0, startIndex)) {
      const kept = prevById.get(cue.id);
      if (kept && kept.status === "played") {
        entries.push(kept);
        endMs = Math.max(endMs, kept.endMs);
      }
    }
  }

  const active: RehearsalEntry[] = entries.filter(
    (e) => e.endMs > (startCue?.ignitionMs ?? 0)
  );
  const conflicts: RehearsalConflict[] = [];
  let stopCueId: string | null = null;

  for (const cue of ordered.slice(startIndex)) {
    if (stopCueId) {
      entries.push({
        cueId: cue.id,
        pointId: cue.pointId,
        startMs: cue.ignitionMs,
        endMs: cue.ignitionMs + (models.get(cue.modelId)?.durationMs ?? 0),
        status: "pending",
        revision: cue.revision,
      });
      continue;
    }

    const start = cue.ignitionMs;
    const end = start + (models.get(cue.modelId)?.durationMs ?? 0);

    const conflict =
      checkSamePoint(cue, end, active, models, cuesById, codeOf) ??
      checkCrossPoint(cue, end, active, cuesById, models, points);

    if (conflict) {
      conflicts.push(conflict);
      stopCueId = cue.id;
      entries.push({
        cueId: cue.id,
        pointId: cue.pointId,
        startMs: start,
        endMs: end,
        status: "conflict",
        conflict,
        revision: cue.revision,
      });
      continue;
    }

    const entry: RehearsalEntry = {
      cueId: cue.id,
      pointId: cue.pointId,
      startMs: start,
      endMs: end,
      status: "played",
      revision: cue.revision,
    };
    entries.push(entry);
    active.push(entry);
    endMs = Math.max(endMs, end);
  }

  entries.sort((a, b) => {
    const ta = cuesById.get(a.cueId)?.ignitionMs ?? 0;
    const tb = cuesById.get(b.cueId)?.ignitionMs ?? 0;
    return ta - tb;
  });

  const snapshot: RehearsalSnapshot = {
    schemaVersion: 1,
    scriptVersion: script.version,
    state: stopCueId ? "stopped" : "completed",
    ranAt: options.ranAt ?? Date.now(),
    startCueId: startCue?.id ?? null,
    forcedStartCueId: dirty?.id ?? null,
    entries,
    conflicts,
    stopCueId,
    endMs: Math.max(endMs, script.musicDurationMs),
  };

  return { ok: true, snapshot };
}
