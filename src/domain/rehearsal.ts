/**
 * 冲突校验：整场预演的推进引擎。
 * - 先做一次整体校验，音乐时间点越界或段落已移除 -> 整次预演拒绝；
 * - 然后按点火时间推进，同一燃放点位前一枚尚未结束或安全间距不足时，
 *   立即停在冲突节点；
 * - 支持从指定节点重跑：起点之前的节点视为已按原稿燃放完毕，
 *   仅用于恢复各点位的占用状态。
 */

import {
  effectiveRadiusM,
  formatMs,
  nodeEndMs,
  pointDistance,
  requiredGapMs,
  type FireworkNode,
  type ShowScript,
} from "./model";

export type ConflictKind = "overlap" | "gap" | "distance";

export interface Conflict {
  nodeId: string;
  kind: ConflictKind;
  pointId: string;
  relatedNodeId?: string;
  message: string;
}

export interface RehearsalEvent {
  nodeId: string;
  pointId: string;
  segmentId: string;
  fireAtMs: number;
  endAtMs: number;
  status: "fired" | "conflict";
}

export interface RehearsalRun {
  status: "completed" | "blocked";
  /** null 表示自开场起的整场预演 */
  startedFromNodeId: string | null;
  events: RehearsalEvent[];
  conflicts: Conflict[];
  stoppedAtMs: number | null;
}

export type RehearsalOutcome = RehearsalRun | { status: "rejected"; reasons: string[] };

/** 整体校验：任一问题都导致整次预演被拒绝 */
export function validateScript(script: ShowScript, fromNodeId?: string): string[] {
  const reasons: string[] = [];
  const segmentIds = new Set(script.segments.map((s) => s.id));
  const pointIds = new Set(script.points.map((p) => p.id));

  for (const cue of script.musicCues) {
    if (cue.atMs < 0 || cue.atMs > script.musicDurationMs) {
      reasons.push(
        `音乐时间点「${cue.label}」越界（${formatMs(cue.atMs)}，曲目总长 ${formatMs(script.musicDurationMs)}）`
      );
    }
    if (cue.segmentId && !segmentIds.has(cue.segmentId)) {
      reasons.push(`音乐时间点「${cue.label}」引用的段落已移除`);
    }
  }

  for (const node of script.nodes) {
    if (!segmentIds.has(node.segmentId)) {
      reasons.push(`节点 ${node.id} 所属段落已移除`);
    }
    if (!pointIds.has(node.pointId)) {
      reasons.push(`节点 ${node.id} 的燃放点位不存在`);
    }
  }

  if (fromNodeId && !script.nodes.some((n) => n.id === fromNodeId)) {
    reasons.push(`重跑起点节点 ${fromNodeId} 已不存在`);
  }

  return reasons;
}

/**
 * 执行预演。纯函数，不修改 script。
 * @param fromNodeId 传入时从该节点重跑，否则自开场整场预演
 */
export function runRehearsal(script: ShowScript, fromNodeId: string | null = null): RehearsalOutcome {
  const reasons = validateScript(script, fromNodeId ?? undefined);
  if (reasons.length > 0) {
    return { status: "rejected", reasons };
  }

  const ordered = [...script.nodes].sort(
    (a, b) => a.fireAtMs - b.fireAtMs || a.id.localeCompare(b.id)
  );
  const startIndex = fromNodeId ? ordered.findIndex((n) => n.id === fromNodeId) : 0;
  const pointName = new Map(script.points.map((p) => [p.id, p.name]));
  const pointById = new Map(script.points.map((p) => [p.id, p]));

  const events: RehearsalEvent[] = [];
  const conflicts: Conflict[] = [];
  const lastByPoint = new Map<string, { node: FireworkNode; endAtMs: number }>();
  const fired: Array<{ node: FireworkNode; endAtMs: number }> = [];

  // 重跑起点之前的节点视为已按原稿燃放完毕，仅恢复点位占用状态
  for (let i = 0; i < startIndex; i++) {
    const node = ordered[i];
    const endAtMs = nodeEndMs(node);
    lastByPoint.set(node.pointId, { node, endAtMs });
    fired.push({ node, endAtMs });
  }

  const stopAt = (node: FireworkNode, conflict: Conflict): RehearsalRun => {
    events.push({
      nodeId: node.id,
      pointId: node.pointId,
      segmentId: node.segmentId,
      fireAtMs: node.fireAtMs,
      endAtMs: nodeEndMs(node),
      status: "conflict",
    });
    conflicts.push(conflict);
    return {
      status: "blocked",
      startedFromNodeId: fromNodeId,
      events,
      conflicts,
      stoppedAtMs: node.fireAtMs,
    };
  };

  for (let i = startIndex; i < ordered.length; i++) {
    const node = ordered[i];
    const endAtMs = nodeEndMs(node);
    const here = pointName.get(node.pointId) ?? node.pointId;

    // 同一燃放点位：前一枚尚未结束
    const prev = lastByPoint.get(node.pointId);
    if (prev) {
      if (node.fireAtMs < prev.endAtMs) {
        return stopAt(node, {
          nodeId: node.id,
          kind: "overlap",
          pointId: node.pointId,
          relatedNodeId: prev.node.id,
          message: `${here} 上一枚 ${prev.node.id} 持续至 ${formatMs(prev.endAtMs)}，本枚 ${formatMs(node.fireAtMs)} 点火时前一枚尚未结束`,
        });
      }
      // 同一燃放点位：安全间隔不足
      const gap = node.fireAtMs - prev.endAtMs;
      const need = requiredGapMs(node);
      if (gap < need) {
        return stopAt(node, {
          nodeId: node.id,
          kind: "gap",
          pointId: node.pointId,
          relatedNodeId: prev.node.id,
          message: `${here} 距上一枚 ${prev.node.id} 结束仅 ${formatMs(gap)}，小于所需安全间隔 ${formatMs(need)}`,
        });
      }
    }

    // 不同点位：发射窗口重叠时，点位间距必须满足双方有效安全半径
    for (const other of fired) {
      if (other.node.pointId === node.pointId) continue;
      const overlaps = node.fireAtMs < other.endAtMs && other.node.fireAtMs < endAtMs;
      if (!overlaps) continue;
      const pa = pointById.get(node.pointId);
      const pb = pointById.get(other.node.pointId);
      if (!pa || !pb) continue;
      const dist = pointDistance(pa, pb);
      const need = Math.max(effectiveRadiusM(node), effectiveRadiusM(other.node));
      if (dist < need) {
        return stopAt(node, {
          nodeId: node.id,
          kind: "distance",
          pointId: node.pointId,
          relatedNodeId: other.node.id,
          message: `与「${pointName.get(other.node.pointId) ?? other.node.pointId}」的 ${other.node.id} 发射窗口重叠，点位间距 ${dist.toFixed(1)}m 小于所需安全距离 ${need.toFixed(1)}m`,
        });
      }
    }

    events.push({
      nodeId: node.id,
      pointId: node.pointId,
      segmentId: node.segmentId,
      fireAtMs: node.fireAtMs,
      endAtMs,
      status: "fired",
    });
    lastByPoint.set(node.pointId, { node, endAtMs });
    fired.push({ node, endAtMs });
  }

  return {
    status: "completed",
    startedFromNodeId: fromNodeId,
    events,
    conflicts,
    stoppedAtMs: null,
  };
}
