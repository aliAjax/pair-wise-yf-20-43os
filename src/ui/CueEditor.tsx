import { useEffect, useState } from "react";
import { formatTime, parseTime } from "../domain/time";
import type { IgnitionCue, RehearsalSnapshot, ShowScript } from "../domain/types";

interface Props {
  script: ShowScript;
  snapshot: RehearsalSnapshot | null;
  dirtyCueId: string | null;
  onChangeAngle: (cueId: string, angle: number) => void;
  onChangePoint: (cueId: string, pointId: string) => void;
  onChangeIgnition: (cueId: string, ms: number) => void;
}

export function CueEditor({
  script,
  snapshot,
  dirtyCueId,
  onChangeAngle,
  onChangePoint,
  onChangeIgnition,
}: Props) {
  const modelById = new Map(script.models.map((m) => [m.id, m]));
  const segmentById = new Map(script.segments.map((s) => [s.id, s]));
  const cueById = new Map(script.cues.map((c) => [c.id, c]));
  const entryByCue = new Map(snapshot?.entries.map((e) => [e.cueId, e]) ?? []);

  const ordered = [...script.cues].sort((a, b) => {
    if (a.ignitionMs !== b.ignitionMs) return a.ignitionMs - b.ignitionMs;
    return a.code.localeCompare(b.code, "zh-CN");
  });

  return (
    <div className="cue-table-wrap">
      <table className="cue-table">
        <thead>
          <tr>
            <th>#</th>
            <th>段落</th>
            <th>型号</th>
            <th>点位</th>
            <th>发射角度</th>
            <th>点火时间</th>
            <th>持续</th>
            <th>预演状态</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((cue) => (
            <CueRow
              key={cue.id}
              cue={cue}
              pointName={script.points.find((p) => p.id === cue.pointId)?.name ?? "?"}
              points={script.points}
              modelName={modelById.get(cue.modelId)?.name ?? "?"}
              durationMs={modelById.get(cue.modelId)?.durationMs ?? 0}
              segmentName={segmentById.get(cue.segmentId)?.name ?? "（段落已移除）"}
              segmentMissing={!segmentById.has(cue.segmentId)}
              status={entryByCue.get(cue.id)?.status ?? null}
              isStop={snapshot?.stopCueId === cue.id}
              isDirty={dirtyCueId === cue.id || snapshot?.forcedStartCueId === cue.id}
              hasEarlierDirty={Boolean(dirtyCueId)}
              dirtyCode={dirtyCueId ? cueById.get(dirtyCueId)?.code : undefined}
              onChangeAngle={onChangeAngle}
              onChangePoint={onChangePoint}
              onChangeIgnition={onChangeIgnition}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface RowProps {
  cue: IgnitionCue;
  pointName: string;
  points: ShowScript["points"];
  modelName: string;
  durationMs: number;
  segmentName: string;
  segmentMissing: boolean;
  status: "played" | "conflict" | "pending" | null;
  isStop: boolean;
  isDirty: boolean;
  hasEarlierDirty: boolean;
  dirtyCode?: string;
  onChangeAngle: (cueId: string, angle: number) => void;
  onChangePoint: (cueId: string, pointId: string) => void;
  onChangeIgnition: (cueId: string, ms: number) => void;
}

function CueRow({
  cue,
  points,
  modelName,
  durationMs,
  segmentName,
  segmentMissing,
  status,
  isStop,
  isDirty,
  hasEarlierDirty,
  dirtyCode,
  onChangeAngle,
  onChangePoint,
  onChangeIgnition,
}: RowProps) {
  const [angleText, setAngleText] = useState(String(cue.angle));
  const [timeText, setTimeText] = useState(formatTime(cue.ignitionMs));
  const [timeError, setTimeError] = useState(false);

  useEffect(() => {
    setAngleText(String(cue.angle));
    setTimeText(formatTime(cue.ignitionMs));
  }, [cue.angle, cue.ignitionMs]);

  const commitAngle = () => {
    const value = Number(angleText);
    if (Number.isInteger(value) && value >= 0 && value <= 359 && value !== cue.angle) {
      onChangeAngle(cue.id, value);
    } else {
      setAngleText(String(cue.angle));
    }
  };

  const commitTime = () => {
    const parsed = parseTime(timeText);
    if (parsed === null) {
      setTimeError(true);
      setTimeText(formatTime(cue.ignitionMs));
      return;
    }
    setTimeError(false);
    if (parsed !== cue.ignitionMs) onChangeIgnition(cue.id, parsed);
  };

  return (
    <tr className={isStop ? "row-stop" : isDirty ? "row-dirty" : ""}>
      <td className="cue-code">
        #{cue.code}
        {isDirty && <span className="dirty-flag" title="已调整，需从该节点重跑">改</span>}
      </td>
      <td className={segmentMissing ? "missing" : ""}>{segmentName}</td>
      <td>{modelName}</td>
      <td>
        <select
          value={cue.pointId}
          onChange={(e) => onChangePoint(cue.id, e.target.value)}
          title={hasEarlierDirty && !isDirty ? `需先从 #${dirtyCode} 重跑` : "更换燃放点位"}
        >
          {points.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <span className="angle-edit">
          <input
            value={angleText}
            onChange={(e) => setAngleText(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            onBlur={commitAngle}
            aria-label={`节点 ${cue.code} 发射角度`}
          />
          °
        </span>
      </td>
      <td>
        <input
          className={`time-input ${timeError ? "error" : ""}`}
          value={timeText}
          onChange={(e) => setTimeText(e.target.value)}
          onBlur={commitTime}
          placeholder="mm:ss.mmm"
          aria-label={`节点 ${cue.code} 点火时间`}
        />
      </td>
      <td>{(durationMs / 1000).toFixed(0)}s</td>
      <td>
        <span className={`status-pill ${status ?? "pending"}`}>
          {isStop ? "冲突停止" : status === "played" ? "已燃放" : status === "conflict" ? "冲突" : "未推进"}
        </span>
      </td>
    </tr>
  );
}
