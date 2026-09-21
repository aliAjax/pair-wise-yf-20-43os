import { useMemo, useState } from "react";
import "./styles.css";
import {
  createSeedScript,
  formatMs,
  pointDistance,
  type FireworkNode,
  type ShowScript,
} from "./domain/model";
import { runRehearsal, type RehearsalOutcome, type RehearsalRun } from "./domain/rehearsal";
import {
  clearSnapshot,
  hashScript,
  loadSnapshot,
  saveSnapshot,
  type RehearsalSnapshot,
} from "./storage/snapshotStore";
import { Timeline } from "./components/Timeline";
import { PointMap } from "./components/PointMap";
import { ConflictList } from "./components/ConflictList";
import { NodeEditor } from "./components/NodeEditor";

const project = {
  id: "hxyfront-62008",
  sourceNo: 10,
  port: 62008,
  title: "烟花燃放脚本编排",
};

const PRODUCT_FILTERS = ["礼花弹", "罗马烛光", "扇形架", "冷焰火"];

/** 多次改动时，取点火时间最早的节点作为必须重跑的起点 */
function earliestNodeId(script: ShowScript, a: string | null, b: string): string {
  if (!a) return b;
  const na = script.nodes.find((n) => n.id === a);
  const nb = script.nodes.find((n) => n.id === b);
  if (!na || !nb) return b;
  return na.fireAtMs <= nb.fireAtMs ? a : b;
}

function App() {
  const [script, setScript] = useState<ShowScript>(createSeedScript);
  const [outcome, setOutcome] = useState<RehearsalOutcome | null>(null);
  const [snapshot, setSnapshot] = useState<RehearsalSnapshot | null>(() => loadSnapshot());
  const [dirtyFromNodeId, setDirtyFromNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<string | null>(null);

  // 展示用结果：本次运行优先，其次刷新恢复的快照
  const displayRun: RehearsalRun | null =
    outcome !== null && outcome.status !== "rejected" ? outcome : snapshot?.run ?? null;
  const snapshotStale = snapshot !== null && snapshot.scriptHash !== hashScript(script);

  const selectedNode = script.nodes.find((n) => n.id === selectedNodeId) ?? null;

  const minPointDistance = useMemo(() => {
    let min = Infinity;
    for (let i = 0; i < script.points.length; i++) {
      for (let j = i + 1; j < script.points.length; j++) {
        min = Math.min(min, pointDistance(script.points[i], script.points[j]));
      }
    }
    return min;
  }, [script.points]);

  const segmentIds = new Set(script.segments.map((s) => s.id));
  const hasOrphanRefs =
    script.nodes.some((n) => !segmentIds.has(n.segmentId)) ||
    script.musicCues.some((c) => c.segmentId !== null && !segmentIds.has(c.segmentId));

  const conflictCount =
    outcome !== null && outcome.status === "rejected"
      ? outcome.reasons.length
      : displayRun?.conflicts.length ?? 0;

  const runStatusText =
    outcome === null
      ? snapshot
        ? "已恢复最近预演快照"
        : "尚未预演"
      : outcome.status === "rejected"
        ? "整次预演被拒绝"
        : outcome.status === "blocked"
          ? `预演停在冲突节点 ${outcome.conflicts[0]?.nodeId ?? ""}`
          : "预演通过";

  /** 每次推进（通过或停在冲突节点）都落盘为最近快照；拒绝不产生快照 */
  const commitOutcome = (result: RehearsalOutcome) => {
    setOutcome(result);
    if (result.status !== "rejected") {
      const saved = saveSnapshot(result, script);
      if (saved) setSnapshot(saved);
    }
    setDirtyFromNodeId(null);
  };

  const handleRunFull = () => commitOutcome(runRehearsal(script));
  const handleRunFrom = (nodeId: string) => commitOutcome(runRehearsal(script, nodeId));

  const handleNodePatch = (nodeId: string, patch: Partial<FireworkNode>) => {
    setScript((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
    }));
    setDirtyFromNodeId((prev) => earliestNodeId(script, prev, nodeId));
  };

  const handleCueChange = (cueId: string, atMs: number) => {
    setScript((prev) => ({
      ...prev,
      musicCues: prev.musicCues.map((c) => (c.id === cueId ? { ...c, atMs } : c)),
    }));
  };

  const handleRemoveSegment = (segmentId: string) => {
    setScript((prev) => ({
      ...prev,
      segments: prev.segments.filter((s) => s.id !== segmentId),
    }));
  };

  const handleReset = () => {
    setScript(createSeedScript());
    setOutcome(null);
    setDirtyFromNodeId(null);
    setSelectedNodeId(null);
  };

  const handleClearSnapshot = () => {
    clearSnapshot();
    setSnapshot(null);
  };

  const segmentName = (segmentId: string | null) =>
    segmentId === null
      ? "全场"
      : script.segments.find((s) => s.id === segmentId)?.name ?? "段落已移除";

  const metrics: Array<[string, string]> = [
    ["节目段落", String(script.segments.length)],
    ["点火节点", String(script.nodes.length)],
    ["冲突提示", String(conflictCount)],
    ["点位最小间距", `${minPointDistance.toFixed(0)}m`],
  ];

  return (
    <main className="app">
      <section className="hero">
        <p>
          {project.id} · 源提示词{project.sourceNo} · Port {project.port}
        </p>
        <h1>{project.title}</h1>
        <span>
          {script.title} · 曲目总长 {formatMs(script.musicDurationMs)} ·{" "}
          按点火时间推进整场预演，同一点位前一枚未结束或安全间距不足时立即停在冲突节点，原稿不变。
        </span>
      </section>

      <section className="metrics">
        {metrics.map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>整场预演</p>
            <h2>推进控制</h2>
          </div>
          <div className="actions">
            <button
              type="button"
              className="primary"
              onClick={handleRunFull}
              disabled={dirtyFromNodeId !== null}
            >
              整场预演
            </button>
            <button
              type="button"
              onClick={() => selectedNodeId && handleRunFrom(selectedNodeId)}
              disabled={selectedNodeId === null}
            >
              从选中节点重跑
            </button>
            <button type="button" onClick={handleReset}>
              恢复原稿
            </button>
            <button type="button" onClick={handleClearSnapshot} disabled={snapshot === null}>
              清除快照
            </button>
          </div>
        </div>
        <div className="run-status">
          <span>{runStatusText}</span>
          {snapshot && (
            <span className="badge">快照 {new Date(snapshot.savedAt).toLocaleString()}</span>
          )}
          {snapshotStale && <span className="badge warn">脚本已变更，快照基于旧稿</span>}
          {dirtyFromNodeId && (
            <span className="badge warn">节点 {dirtyFromNodeId} 已调整，仅可从该节点重跑</span>
          )}
        </div>
        {outcome !== null && outcome.status === "rejected" && (
          <div className="banner-danger">
            预演被拒绝：{outcome.reasons[0]}
            {outcome.reasons.length > 1 ? ` 等 ${outcome.reasons.length} 项` : ""}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>时间轴</p>
            <h2>点火时间推进</h2>
          </div>
          <div className="legend">
            <span className="dot status-fired" /> 已燃放
            <span className="dot status-conflict" /> 冲突
            <span className="dot status-pending" /> 待燃放
            <span className="dot status-skipped" /> 此前已燃放
            <span className="cue-line" /> 音乐时间点
          </div>
        </div>
        <Timeline
          script={script}
          run={displayRun}
          selectedNodeId={selectedNodeId}
          productFilter={productFilter}
          onSelect={setSelectedNodeId}
        />
      </section>

      <section className="workspace">
        <aside className="panel">
          <h2>型号筛选</h2>
          <div className="chips">
            {PRODUCT_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={productFilter === f ? "chip-active" : ""}
                onClick={() => setProductFilter(productFilter === f ? null : f)}
              >
                {f}
              </button>
            ))}
          </div>

          <h2>节目段落</h2>
          <div className="segment-list">
            {script.segments.map((seg) => (
              <div key={seg.id} className="segment-row">
                <span>
                  {seg.name} · {formatMs(seg.startMs)}–{formatMs(seg.endMs)}
                </span>
                <button type="button" onClick={() => handleRemoveSegment(seg.id)}>
                  移除
                </button>
              </div>
            ))}
          </div>
          {hasOrphanRefs && (
            <p className="hint">段落已移除，引用它的节点与音乐时间点将导致整次预演被拒绝。</p>
          )}

          <h2>音乐时间点</h2>
          <p className="empty">曲目总长 {formatMs(script.musicDurationMs)}，单位：秒</p>
          {script.musicCues.map((cue) => {
            const outOfBounds = cue.atMs < 0 || cue.atMs > script.musicDurationMs;
            const segmentMissing = cue.segmentId !== null && !segmentIds.has(cue.segmentId);
            const danger = outOfBounds || segmentMissing;
            return (
              <label key={cue.id} className={`cue-row${danger ? " danger" : ""}`}>
                <span>
                  {cue.label} · {segmentName(cue.segmentId)}
                </span>
                <input
                  type="number"
                  step={0.1}
                  value={cue.atMs / 1000}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) handleCueChange(cue.id, Math.round(v * 1000));
                  }}
                />
                <small>
                  {formatMs(cue.atMs)}
                  {outOfBounds ? " · 越界，预演将被拒绝" : ""}
                  {segmentMissing ? " · 段落已移除，预演将被拒绝" : ""}
                </small>
              </label>
            );
          })}
        </aside>

        <section className="panel">
          <div className="heading">
            <div>
              <p>点位图</p>
              <h2>燃放点位平面图</h2>
            </div>
            <div className="legend">
              <span className="dot status-fired" /> 已燃放点位
              <span className="dot status-conflict" /> 冲突点位
            </div>
          </div>
          <PointMap script={script} run={displayRun} selectedNodeId={selectedNodeId} />
          <p className="empty">选中节点后显示其有效安全半径（随发射角度增大）。</p>
        </section>
      </section>

      <section className="workspace even">
        <section className="panel">
          <div className="heading">
            <div>
              <p>节点编辑</p>
              <h2>角度与点位调整</h2>
            </div>
          </div>
          <NodeEditor
            node={selectedNode}
            points={script.points}
            mustRunFromNodeId={dirtyFromNodeId}
            onPatch={handleNodePatch}
            onRunFrom={handleRunFrom}
          />
        </section>

        <section className="panel">
          <div className="heading">
            <div>
              <p>冲突清单</p>
              <h2>校验结果</h2>
            </div>
          </div>
          <ConflictList outcome={outcome} run={displayRun} onLocate={setSelectedNodeId} />
        </section>
      </section>
    </main>
  );
}

export default App;
