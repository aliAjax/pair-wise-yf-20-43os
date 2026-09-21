import { useEffect, useState } from "react";
import { formatTime, parseTime } from "../domain/time";
import type { ShowScript } from "../domain/types";

interface Props {
  script: ShowScript;
  onToggleSegment: (segmentId: string) => void;
  onMusicDuration: (ms: number) => void;
}

/** 段落管理 + 音乐时间点清单（越界标红）；音乐总时长可改，用于触发越界拒绝 */
export function SegmentPanel({ script, onToggleSegment, onMusicDuration }: Props) {
  const [durationText, setDurationText] = useState(formatTime(script.musicDurationMs));
  useEffect(() => {
    setDurationText(formatTime(script.musicDurationMs));
  }, [script.musicDurationMs]);

  const commitDuration = () => {
    const parsed = parseTime(durationText);
    if (parsed === null) {
      setDurationText(formatTime(script.musicDurationMs));
      return;
    }
    onMusicDuration(parsed);
  };

  const segmentById = new Map(
    [...script.segments, ...script.removedSegments].map((s) => [s.id, s])
  );

  return (
    <div className="segment-panel">
      <label className="music-duration">
        <span>音乐总时长</span>
        <input
          value={durationText}
          onChange={(e) => setDurationText(e.target.value)}
          onBlur={commitDuration}
          placeholder="mm:ss.mmm"
        />
      </label>

      <h3>节目段落</h3>
      <ul className="segment-list">
        {script.segments.map((segment) => (
          <li key={segment.id}>
            <span className="segment-name">{segment.name}</span>
            <span className="segment-time">起 {formatTime(segment.startMs)}</span>
            <button className="link-danger" onClick={() => onToggleSegment(segment.id)}>
              移除段落
            </button>
          </li>
        ))}
      </ul>

      {script.removedSegments.length > 0 && (
        <>
          <h3 className="removed-title">已移除（恢复后可再预演）</h3>
          <ul className="segment-list removed">
            {script.removedSegments.map((segment) => (
              <li key={segment.id}>
                <span className="segment-name">{segment.name}</span>
                <button className="link" onClick={() => onToggleSegment(segment.id)}>
                  恢复段落
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>音乐时间点</h3>
      <ul className="cue-point-list">
        {script.musicCues.map((cue) => {
          const outOfRange = cue.timeMs > script.musicDurationMs;
          const missing = !script.segments.some((s) => s.id === cue.segmentId);
          return (
            <li key={cue.id} className={outOfRange || missing ? "bad" : ""}>
              <span>{cue.label}</span>
              <time>{formatTime(cue.timeMs)}</time>
              <small>{segmentById.get(cue.segmentId)?.name ?? "段落缺失"}</small>
              {outOfRange && <em className="flag">越界</em>}
              {missing && <em className="flag">段落已移除</em>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
