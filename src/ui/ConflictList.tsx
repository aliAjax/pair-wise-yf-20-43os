import type { RehearsalSnapshot, ShowScript } from "../domain/types";

interface Props {
  script: ShowScript;
  snapshot: RehearsalSnapshot | null;
}

/** 冲突清单：只列本次预演已推进到的冲突（预演在第一处即停） */
export function ConflictList({ script, snapshot }: Props) {
  const cueById = new Map(script.cues.map((c) => [c.id, c]));
  const pointById = new Map(script.points.map((p) => [p.id, p]));

  if (!snapshot || snapshot.conflicts.length === 0) {
    return (
      <div className="conflict-empty">
        {snapshot?.state === "completed"
          ? "整场预演通过：同点重叠、同点/异点安全间距均无冲突。"
          : "尚未执行预演，暂无冲突记录。"}
      </div>
    );
  }

  return (
    <ol className="conflict-list">
      {snapshot.conflicts.map((conflict, index) => {
        const cue = cueById.get(conflict.cueId);
        const other = cueById.get(conflict.otherCueId);
        const point = pointById.get(conflict.pointId);
        const isStop = snapshot.stopCueId === conflict.cueId;
        return (
          <li key={index} className={`conflict-item ${isStop ? "is-stop" : ""}`}>
            <div className="conflict-head">
              <span className={`kind kind-${conflict.kind}`}>
                {conflict.kind === "overlap" ? "前一枚未结束" : "安全间距不足"}
              </span>
              {isStop && <span className="stop-tag">预演停在此节点</span>}
            </div>
            <p>{conflict.message}</p>
            <small>
              节点 #{cue?.code ?? conflict.cueId}
              {other ? ` 对 #${other.code}` : ""}
              {point ? ` · ${point.name}` : ""}
            </small>
          </li>
        );
      })}
    </ol>
  );
}
