import { useMemo } from "react";
import type {
  FireworkModel,
  IgnitionCue,
  RehearsalSnapshot,
  ShowScript,
} from "../domain/types";

interface Props {
  script: ShowScript;
  snapshot: RehearsalSnapshot | null;
}

// 场地 120m x 80m，下方为观众区
const FIELD_W = 120;
const FIELD_H = 80;
const PAD = 8;
const SCALE = 7;
const W = (FIELD_W + PAD * 2) * SCALE;
const H = (FIELD_H + PAD * 2 + 10) * SCALE;

function x(mx: number): number {
  return (mx + PAD) * SCALE;
}
function y(my: number): number {
  return (my + PAD) * SCALE;
}

/** 角度：0/360 为正北（场地外/观众反方向），顺时针绘制方向箭头 */
function angleVector(angle: number): { dx: number; dy: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { dx: Math.cos(rad), dy: Math.sin(rad) };
}

export function PointMapView({ script, snapshot }: Props) {
  const entryByCue = useMemo(
    () => new Map(snapshot?.entries.map((e) => [e.cueId, e]) ?? []),
    [snapshot]
  );
  const pointById = new Map(script.points.map((p) => [p.id, p]));
  const modelById = new Map(script.models.map((m) => [m.id, m]));

  // 点位状态聚合：冲突 > 已燃放 > 未推进
  const pointStatus = useMemo(() => {
    const map = new Map<string, "conflict" | "played" | "pending">();
    for (const cue of script.cues) {
      const status = entryByCue.get(cue.id)?.status ?? "pending";
      const prev = map.get(cue.pointId);
      const rank = { conflict: 3, played: 2, pending: 1 } as const;
      if (!prev || rank[status] > rank[prev]) map.set(cue.pointId, status);
    }
    return map;
  }, [script.cues, entryByCue]);

  // 每个点位取最近一次活动型号画安全圆
  const pointLastCue = useMemo(() => {
    const map = new Map<string, IgnitionCue>();
    for (const cue of script.cues) {
      const prev = map.get(cue.pointId);
      if (!prev || cue.ignitionMs > prev.ignitionMs) map.set(cue.pointId, cue);
    }
    return map;
  }, [script]);

  return (
    <svg className="point-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="燃放点位平面图">
      <rect x={x(0)} y={y(0)} width={FIELD_W * SCALE} height={FIELD_H * SCALE} className="field" />
      {Array.from({ length: 5 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={x(i * 30)}
          y1={y(0)}
          x2={x(i * 30)}
          y2={y(FIELD_H)}
          className="field-grid"
        />
      ))}
      {Array.from({ length: 3 }, (_, i) => (
        <line
          key={`h${i}`}
          x1={x(0)}
          y1={y(i * 40)}
          x2={x(FIELD_W)}
          y2={y(i * 40)}
          className="field-grid"
        />
      ))}
      <rect x={x(0)} y={y(FIELD_H)} width={FIELD_W * SCALE} height={10 * SCALE} className="audience" />
      <text x={x(FIELD_W / 2)} y={y(FIELD_H) + 28} textAnchor="middle" className="audience-text">
        观众区
      </text>

      {/* 安全距离圆 */}
      {script.points.map((point) => {
        const cue = pointLastCue.get(point.id);
        const model: FireworkModel | undefined = cue ? modelById.get(cue.modelId) : undefined;
        if (!model) return null;
        return (
          <circle
            key={`safe-${point.id}`}
            cx={x(point.x)}
            cy={y(point.y)}
            r={model.safetyRadius * SCALE}
            className={`safe-radius ${pointStatus.get(point.id) ?? "pending"}`}
          />
        );
      })}

      {/* 发射方向（取各点位上每个已燃放节点的方向小箭头） */}
      {script.cues.map((cue) => {
        const entry = entryByCue.get(cue.id);
        if (entry?.status !== "played") return null;
        const point = pointById.get(cue.pointId);
        if (!point) return null;
        const { dx, dy } = angleVector(cue.angle);
        const r = 13;
        return (
          <line
            key={`dir-${cue.id}`}
            x1={x(point.x) - dx * r}
            y1={y(point.y) - dy * r}
            x2={x(point.x) - dx * (r + 9)}
            y2={y(point.y) - dy * (r + 9)}
            className="direction"
            markerEnd="url(#arrowhead)"
          />
        );
      })}

      {/* 冲突连线 */}
      {snapshot?.conflicts.map((conflict, index) => {
        const cue = script.cues.find((c) => c.id === conflict.cueId);
        const other = script.cues.find((c) => c.id === conflict.otherCueId);
        const p1 = cue ? pointById.get(cue.pointId) : undefined;
        const p2 = other ? pointById.get(other.pointId) : undefined;
        if (!p1 || !p2 || p1.id === p2.id) {
          // 同点冲突：在点位上画警示圈
          const p = p1 ?? pointById.get(conflict.pointId);
          if (!p) return null;
          return (
            <circle
              key={index}
              cx={x(p.x)}
              cy={y(p.y)}
              r={22}
              className="conflict-ring"
            />
          );
        }
        const mx = (x(p1.x) + x(p2.x)) / 2;
        const my = (y(p1.y) + y(p2.y)) / 2;
        return (
          <g key={index}>
            <line x1={x(p1.x)} y1={y(p1.y)} x2={x(p2.x)} y2={y(p2.y)} className="conflict-line" />
            <circle cx={mx} cy={my} r={11} className="conflict-badge" />
            <text x={mx} y={my + 4} textAnchor="middle" className="conflict-badge-text">
              !
            </text>
          </g>
        );
      })}

      {/* 点位 */}
      {script.points.map((point) => {
        const status = pointStatus.get(point.id) ?? "pending";
        const isStop = snapshot?.stopCueId
          ? script.cues.find((c) => c.id === snapshot.stopCueId)?.pointId === point.id
          : false;
        return (
          <g key={point.id} className={`point ${status}`}>
            <circle cx={x(point.x)} cy={y(point.y)} r={13} className={`point-dot ${isStop ? "stop" : ""}`} />
            <text x={x(point.x)} y={y(point.y) + 4} textAnchor="middle" className="point-text">
              {point.name.charAt(0)}
            </text>
            <text x={x(point.x)} y={y(point.y) - 20} textAnchor="middle" className="point-label">
              {point.name}
            </text>
          </g>
        );
      })}

      <defs>
        <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" className="arrowhead" />
        </marker>
      </defs>
    </svg>
  );
}
