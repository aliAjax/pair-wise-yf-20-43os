import { formatMs, type ShowScript } from "../domain/model";
import type { RehearsalRun } from "../domain/rehearsal";

interface TimelineProps {
  script: ShowScript;
  run: RehearsalRun | null;
  selectedNodeId: string | null;
  productFilter: string | null;
  onSelect(nodeId: string): void;
}

/** 时间轴：段落带 + 音乐时间点刻度 + 按点火时间排布的节点 */
export function Timeline({ script, run, selectedNodeId, productFilter, onSelect }: TimelineProps) {
  const total = Math.max(script.musicDurationMs, 1);
  const pct = (ms: number) => `${Math.min(100, Math.max(0, (ms / total) * 100))}%`;

  const statusByNode = new Map<string, string>();
  run?.events.forEach((e) => statusByNode.set(e.nodeId, e.status));

  // 重跑起点之前的节点标记为 skipped（此前已按原稿燃放）
  const fromNode = run?.startedFromNodeId
    ? script.nodes.find((n) => n.id === run.startedFromNodeId) ?? null
    : null;

  const pointIndex = new Map(script.points.map((p, i) => [p.id, i]));
  const ordered = [...script.nodes].sort(
    (a, b) => a.fireAtMs - b.fireAtMs || a.id.localeCompare(b.id)
  );

  return (
    <div className="timeline">
      <div className="timeline-segments">
        {script.segments.map((seg) => (
          <span
            key={seg.id}
            className="timeline-segment"
            style={{ left: pct(seg.startMs), width: pct(seg.endMs - seg.startMs) }}
          >
            {seg.name}
          </span>
        ))}
      </div>
      <div className="timeline-track">
        {script.musicCues.map((cue) => (
          <span
            key={cue.id}
            className="timeline-cue"
            style={{ left: pct(cue.atMs) }}
            title={`${cue.label} · ${formatMs(cue.atMs)}`}
          />
        ))}
        {ordered.map((node) => {
          let status = statusByNode.get(node.id) ?? "pending";
          if (status === "pending" && fromNode && node.fireAtMs < fromNode.fireAtMs) {
            status = "skipped";
          }
          const dimmed = productFilter !== null && !node.product.includes(productFilter);
          const top = 8 + (pointIndex.get(node.pointId) ?? 0) * 13;
          const cls = [
            "marker",
            `status-${status}`,
            node.id === selectedNodeId ? "selected" : "",
            dimmed ? "dimmed" : "",
          ]
            .join(" ")
            .trim();
          return (
            <button
              key={node.id}
              type="button"
              aria-label={`节点 ${node.id}`}
              className={cls}
              style={{ left: pct(node.fireAtMs), top: `${top}px` }}
              title={`${node.id} · ${node.product} · ${formatMs(node.fireAtMs)} · ${node.pointId}`}
              onClick={() => onSelect(node.id)}
            />
          );
        })}
      </div>
      <div className="timeline-scale">
        <span>{formatMs(0)}</span>
        <span>{formatMs(total)}</span>
      </div>
    </div>
  );
}
