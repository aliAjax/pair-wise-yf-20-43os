import { effectiveRadiusM, type ShowScript } from "../domain/model";
import type { RehearsalRun } from "../domain/rehearsal";

interface PointMapProps {
  script: ShowScript;
  run: RehearsalRun | null;
  selectedNodeId: string | null;
}

/** 燃放点位平面图：坐标单位为米，选中节点时绘制其有效安全半径 */
export function PointMap({ script, run, selectedNodeId }: PointMapProps) {
  const conflictPoints = new Set(run?.conflicts.map((c) => c.pointId) ?? []);
  const firedPoints = new Set(
    run?.events.filter((e) => e.status === "fired").map((e) => e.pointId) ?? []
  );
  const selected = script.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedPoint = selected
    ? script.points.find((p) => p.id === selected.pointId) ?? null
    : null;

  return (
    <svg viewBox="0 0 120 80" className="point-map" role="img" aria-label="燃放点位平面图">
      <rect x="0" y="0" width="120" height="80" rx="2" className="map-bg" />
      {selected && selectedPoint && (
        <circle
          cx={selectedPoint.x}
          cy={selectedPoint.y}
          r={effectiveRadiusM(selected)}
          className="map-radius"
        />
      )}
      {script.points.map((p) => {
        const cls = [
          "map-point",
          conflictPoints.has(p.id) ? "conflict" : firedPoints.has(p.id) ? "fired" : "",
        ]
          .join(" ")
          .trim();
        return (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r={2.4} className={cls} />
            <text x={p.x + 3.6} y={p.y + 1.6} className="map-label">
              {p.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
