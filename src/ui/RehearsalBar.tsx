import { formatTime } from "../domain/time";
import type {
  IgnitionCue,
  RehearsalSnapshot,
  ShowScript,
} from "../domain/types";
import type { LastRejection } from "../state/useStudio";

interface Props {
  script: ShowScript;
  snapshot: RehearsalSnapshot | null;
  rejection: LastRejection | null;
  dirtyCue: IgnitionCue | null;
  onRun: (startCueId: string | null) => void;
  onResetDemo: () => void;
}

function formatRanAt(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

/** 预演控制条：整场预演 / 从已调整节点重跑；并展示最近快照信息 */
export function RehearsalBar({ script, snapshot, rejection, dirtyCue, onRun, onResetDemo }: Props) {
  const played = snapshot?.entries.filter((e) => e.status === "played").length ?? 0;
  const conflictCount = snapshot?.conflicts.length ?? 0;

  return (
    <div className="rehearsal-bar">
      <div className="rehearsal-actions">
        <button
          className="primary"
          onClick={() => onRun(null)}
          title={dirtyCue ? `节点 #${dirtyCue.code} 已调整，只能从该节点重跑` : "从第一枚开始按点火时间推进整场预演"}
        >
          ▶ 整场预演
        </button>
        <button
          className="rerun"
          disabled={!dirtyCue}
          onClick={() => dirtyCue && onRun(dirtyCue.id)}
          title={dirtyCue ? `保留 #${dirtyCue.code} 之前的结果，从该节点重新推进` : "角度或点位调整后才能从节点重跑"}
        >
          ↻ 从节点 #{dirtyCue?.code ?? "—"} 重跑
        </button>
        <button className="ghost" onClick={onResetDemo}>
          恢复示例脚本
        </button>
      </div>

      <div className="snapshot-meta">
        {snapshot ? (
          <>
            <span className={`snap-state state-${snapshot.state}`}>
              {snapshot.state === "completed" ? "✓ 整场通过" : "⛔ 冲突停止"}
            </span>
            <span>
              最近预演 {formatRanAt(snapshot.ranAt)} · 起于节点 #
              {snapshot.startCueId ? script.cues.find((c) => c.id === snapshot.startCueId)?.code : "01"}
            </span>
            <span>
              已燃放 {played}/{script.cues.length} · 冲突 {conflictCount} · 时间轴止于{" "}
              {formatTime(snapshot.endMs)}
            </span>
            <span className="snap-hint">快照已保存，刷新页面可恢复</span>
          </>
        ) : (
          <span className="snap-hint">尚无预演快照，点击“整场预演”开始。</span>
        )}
      </div>

      {rejection && (
        <div className={`rejection rejection-${rejection.rejection.kind}`} role="alert">
          <b>整次预演已拒绝</b>
          <span>{rejection.rejection.message}</span>
        </div>
      )}
    </div>
  );
}
