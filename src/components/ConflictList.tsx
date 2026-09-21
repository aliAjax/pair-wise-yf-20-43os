import type { ConflictKind, RehearsalOutcome, RehearsalRun } from "../domain/rehearsal";

const KIND_LABEL: Record<ConflictKind, string> = {
  overlap: "前一枚尚未结束",
  gap: "同点位安全间隔不足",
  distance: "点位间安全间距不足",
};

interface ConflictListProps {
  outcome: RehearsalOutcome | null;
  run: RehearsalRun | null;
  onLocate(nodeId: string): void;
}

/** 冲突清单：整次拒绝的原因 / 停在冲突节点的详情 / 通过结论 */
export function ConflictList({ outcome, run, onLocate }: ConflictListProps) {
  const rejected = outcome !== null && outcome.status === "rejected" ? outcome : null;

  return (
    <div className="conflicts">
      {rejected && (
        <div className="conflict-item danger">
          <b>整次预演被拒绝</b>
          <ul>
            {rejected.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {run && run.status === "blocked" &&
        run.conflicts.map((c) => (
          <div className="conflict-item danger" key={`${c.nodeId}-${c.kind}`}>
            <b>
              停在 {c.nodeId} · {KIND_LABEL[c.kind]}
            </b>
            <p>{c.message}</p>
            <button type="button" onClick={() => onLocate(c.nodeId)}>
              定位节点
            </button>
          </div>
        ))}

      {run && run.status === "completed" && (
        <div className="conflict-item ok">
          <b>预演通过，无冲突</b>
          <p>
            {run.startedFromNodeId ? `从节点 ${run.startedFromNodeId} 重跑` : "自开场起"}，共{" "}
            {run.events.length} 枚按点火时间顺利完成。
          </p>
        </div>
      )}

      {!run && !rejected && <p className="empty">尚未预演。点击「整场预演」开始推进。</p>}
    </div>
  );
}
