import { useMemo } from "react";
import { formatTime } from "../domain/time";
import type {
  IgnitionCue,
  LaunchPoint,
  RehearsalSnapshot,
  ShowScript,
} from "../domain/types";

interface Props {
  script: ShowScript;
  snapshot: RehearsalSnapshot | null;
}

const TICK_MS = 30_000;
const PX_PER_SECOND = 3.2;

/** 时间轴：每个燃放点位一条泳道；块颜色/形态完全取自最近预演快照 */
export function TimelineView({ script, snapshot }: Props) {
  const widthMs = useMemo(() => {
    const maxEnd = Math.max(
      script.musicDurationMs,
      ...script.cues.map((c) => {
        const model = script.models.find((m) => m.id === c.modelId);
        return c.ignitionMs + (model?.durationMs ?? 0);
      })
    );
    return Math.ceil(maxEnd / TICK_MS) * TICK_MS;
  }, [script]);

  const widthPx = (widthMs / 1000) * PX_PER_SECOND + 80;
  const ticks = Array.from({ length: widthMs / TICK_MS + 1 }, (_, i) => i * TICK_MS);
  const entryByCue = new Map(snapshot?.entries.map((e) => [e.cueId, e]) ?? []);
  const cueById = new Map(script.cues.map((c) => [c.id, c]));

  return (
    <div className="timeline" style={{ width: widthPx }}>
      <div className="timeline-ruler" style={{ width: widthPx }}>
        {ticks.map((t) => (
          <span key={t} className="tick" style={{ left: (t / 1000) * PX_PER_SECOND }}>
            {formatTime(t)}
          </span>
        ))}
        <span
          className="tick music-end"
          style={{ left: (script.musicDurationMs / 1000) * PX_PER_SECOND }}
        >
          乐终 {formatTime(script.musicDurationMs)}
        </span>
      </div>

      {script.points.map((point: LaunchPoint) => {
        const cues = script.cues.filter((c) => c.pointId === point.id);
        return (
          <div className="lane" key={point.id}>
            <div className="lane-label">{point.name}</div>
            <div className="lane-track" style={{ width: widthPx - 130 }}>
              {ticks.map((t) => (
                <i key={t} className="gridline" style={{ left: (t / 1000) * PX_PER_SECOND }} />
              ))}
              <i
                className="gridline music"
                style={{ left: (script.musicDurationMs / 1000) * PX_PER_SECOND }}
              />
              {cues.map((cue: IgnitionCue) => {
                const model = script.models.find((m) => m.id === cue.modelId);
                const duration = model?.durationMs ?? 0;
                const entry = entryByCue.get(cue.id);
                const status = entry?.status ?? "pending";
                return (
                  <div
                    key={cue.id}
                    className={`cue-block ${status} ${
                      snapshot?.stopCueId === cue.id ? "is-stop" : ""
                    } ${snapshot?.forcedStartCueId === cue.id ? "is-dirty" : ""}`}
                    style={{
                      left: (cue.ignitionMs / 1000) * PX_PER_SECOND,
                      width: Math.max(26, (duration / 1000) * PX_PER_SECOND),
                    }}
                    title={`#${cue.code} ${model?.name ?? ""} · ${formatTime(
                      cue.ignitionMs
                    )} 起 · ${(duration / 1000).toFixed(0)}s · ${statusLabel(status)}`}
                  >
                    <b>#{cue.code}</b>
                    <span>{formatTime(cue.ignitionMs)}</span>
                    {snapshot?.forcedStartCueId === cue.id && <em className="dirty-dot" />}
                  </div>
                );
              })}
              {snapshot?.conflicts.map((conflict) => {
                const other = cueById.get(conflict.otherCueId);
                if (!other || other.pointId !== point.id) return null;
                return (
                  <i
                    key={`${conflict.cueId}-${conflict.otherCueId}`}
                    className="conflict-range"
                    style={{
                      left: (other.ignitionMs / 1000) * PX_PER_SECOND,
                      width: 4,
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function statusLabel(status: string): string {
  return status === "played" ? "已燃放" : status === "conflict" ? "冲突停止" : "未推进";
}
